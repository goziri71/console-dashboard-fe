import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as authService from '../services/auth'
import {
  extractAuthData,
  extractAuthenticatedSession,
  extractUserFromProfilePayload,
} from '../lib/authUser'
import {
  clearStoredAuth,
  getStoredAuth,
  storeAuthenticatedSession,
  updateStoredUser,
} from '../lib/authStorage'
import { getDeviceLabel } from '../lib/deviceLabel'

const AuthContext = createContext(null)
const IDLE_TIMEOUT_MS = 10 * 60 * 1000
const initialAuth = getStoredAuth()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(initialAuth.user)
  const [token, setToken] = useState(initialAuth.token)
  const [sessionID, setSessionID] = useState(initialAuth.sessionID)
  const [userKey, setUserKey] = useState(initialAuth.userKey)
  const [session, setSession] = useState(initialAuth.session)
  const [loading, setLoading] = useState(Boolean(initialAuth.token))
  const [deviceLabel] = useState(getDeviceLabel)

  useEffect(() => {
    localStorage.removeItem('sterllo_token')
    localStorage.removeItem('sterllo_user')
    localStorage.removeItem('sterllo_session_id')
    localStorage.removeItem('sterllo_user_key')
    localStorage.removeItem('sterllo_device_session')
  }, [])

  const clearSessionState = useCallback(() => {
    clearStoredAuth()
    setToken(null)
    setUser(null)
    setSessionID(null)
    setUserKey(null)
    setSession(null)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      clearSessionState()
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      } else {
        window.location.reload()
      }
    }
  }, [clearSessionState])

  const completeAuthentication = useCallback((payload) => {
    const authenticated = extractAuthenticatedSession(payload)
    if (!authenticated) {
      throw new Error('Authentication did not return a valid console session.')
    }
    storeAuthenticatedSession(authenticated)
    setToken(authenticated.token)
    setUser(authenticated.user)
    setSessionID(authenticated.sessionID)
    setUserKey(authenticated.userKey)
    setSession(authenticated.session)
    return authenticated
  }, [])

  const startCrosslink = useCallback(
    async (crosslinkToken) => {
      const res = await authService.loginWithCrosslink(crosslinkToken, deviceLabel)
      return extractAuthData(res)
    },
    [deviceLabel]
  )

  const confirmMfaEnrollment = useCallback(
    async (challengeToken, code) => {
      const res = await authService.confirmMfaEnrollment(challengeToken, code, deviceLabel)
      return extractAuthData(res)
    },
    [deviceLabel]
  )

  const verifyMfaChallenge = useCallback(
    async (challengeToken, credential) => {
      const res = await authService.verifyMfaChallenge(
        challengeToken,
        credential,
        deviceLabel
      )
      return extractAuthData(res)
    },
    [deviceLabel]
  )

  /** Whenever a token exists, GET /auth/profile is the source of truth for roles & permissions (guide §0.1). */
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    authService
      .getProfile()
      .then((res) => {
        if (cancelled) return
        const profile = extractUserFromProfilePayload(res)
        if (profile) {
          setUser(profile)
          updateStoredUser(profile)
        } else {
          setUser(null)
          updateStoredUser(null)
        }
      })
      .catch(() => {
        if (cancelled) return
        clearSessionState()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, clearSessionState])

  useEffect(() => {
    if (!token) return
    if (window.location.pathname === '/login') return

    let timeoutId = null
    let loggingOut = false
    let lastResetAt = 0

    const clearTimer = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    const triggerAutoLogout = async () => {
      if (loggingOut) return
      loggingOut = true
      try {
        await logout()
      } finally {
        loggingOut = false
      }
    }

    const resetTimer = () => {
      const now = Date.now()
      if (now - lastResetAt < 500) return
      lastResetAt = now
      clearTimer()
      timeoutId = window.setTimeout(triggerAutoLogout, IDLE_TIMEOUT_MS)
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true })
    })
    window.addEventListener('focus', resetTimer)
    const onVisibilityChange = () => {
      if (!document.hidden) resetTimer()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    resetTimer()

    return () => {
      clearTimer()
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer)
      })
      window.removeEventListener('focus', resetTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [token, logout])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        sessionID,
        userKey,
        session,
        loading,
        startCrosslink,
        confirmMfaEnrollment,
        verifyMfaChallenge,
        completeAuthentication,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Context and hook intentionally live together as the app-wide auth boundary.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
