import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as authService from '../services/auth'

const AuthContext = createContext(null)

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
    await authService.logout()
    setToken(null)
    setUser(null)
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
