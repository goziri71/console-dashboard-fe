import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as authService from '../services/auth'

const AuthContext = createContext(null)
const IDLE_TIMEOUT_MS = 10 * 60 * 1000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('sterllo_user')
    return stored ? JSON.parse(stored) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('sterllo_token'))
  const [loading, setLoading] = useState(!!localStorage.getItem('sterllo_token'))

  useEffect(() => {
    if (token && !user) {
      authService
        .getProfile()
        .then((res) => {
          const profile = res.data || res
          setUser(profile)
          localStorage.setItem('sterllo_user', JSON.stringify(profile))
        })
        .catch(() => {
          localStorage.removeItem('sterllo_token')
          localStorage.removeItem('sterllo_user')
          setToken(null)
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

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
      // Prevent excessive timer churn on noisy events.
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
  }, [token])

  const login = async (email, password) => {
    const res = await authService.login(email, password)
    const jwt = res.token || res.data?.token
    const profile = res.user || res.data?.user || res.data

    localStorage.setItem('sterllo_token', jwt)
    setToken(jwt)

    if (profile) {
      localStorage.setItem('sterllo_user', JSON.stringify(profile))
      setUser(profile)
    } else {
      const profileRes = await authService.getProfile()
      const userData = profileRes.data || profileRes
      localStorage.setItem('sterllo_user', JSON.stringify(userData))
      setUser(userData)
    }

    return res
  }

  const logout = async () => {
    try {
      await authService.logout()
    } finally {
      setToken(null)
      setUser(null)
      // Force a full page refresh so the app fully resets to login.
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      } else {
        window.location.reload()
      }
    }
  }

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
