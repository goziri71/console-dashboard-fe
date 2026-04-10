import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as authService from '../services/auth'
import {
  extractTokenFromAuthPayload,
  extractUserFromProfilePayload,
} from '../lib/authUser'

const AuthContext = createContext(null)
const IDLE_TIMEOUT_MS = 5 * 60 * 1000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('sterllo_user')
    return stored ? JSON.parse(stored) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('sterllo_token'))
  const [loading, setLoading] = useState(!!localStorage.getItem('sterllo_token'))

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      setToken(null)
      setUser(null)
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      } else {
        window.location.reload()
      }
    }
  }, [])

  const login = async (email, password) => {
    const res = await authService.login(email, password)
    const jwt = extractTokenFromAuthPayload(res)
    if (!jwt) {
      throw new Error('No token in login response.')
    }
    localStorage.setItem('sterllo_token', jwt)
    setToken(jwt)
    // Profile (roles, permissions, role) is loaded in the token effect via GET /auth/profile.
    return res
  }

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
          localStorage.setItem('sterllo_user', JSON.stringify(profile))
        } else {
          setUser(null)
          localStorage.removeItem('sterllo_user')
        }
      })
      .catch(() => {
        if (cancelled) return
        localStorage.removeItem('sterllo_token')
        localStorage.removeItem('sterllo_user')
        setToken(null)
        setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token])

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
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
