import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  installActivityLifecycleFlush,
  resolveClickAudit,
  setActivityTrackingEnabled,
  trackActivity,
  trackPageView,
} from '../../lib/activityTracker'

const CLICK_DEDUPE_MS = 400

/**
 * Captures authenticated UI activity for Command Center:
 * page views, sidebar navigation, and interactive clicks.
 */
export default function ActivityTrackerProvider({ children }) {
  const { token } = useAuth()
  const location = useLocation()
  const lastClickRef = useRef({ key: '', at: 0 })

  useEffect(() => {
    setActivityTrackingEnabled(Boolean(token))
    if (!token) return undefined
    return installActivityLifecycleFlush()
  }, [token])

  useEffect(() => {
    if (!token) return
    if (location.pathname.startsWith('/login')) return
    const path = `${location.pathname}${location.search || ''}`
    trackPageView(path)
  }, [token, location.pathname, location.search])

  useEffect(() => {
    if (!token) return undefined

    function onClick(e) {
      if (e.defaultPrevented) return
      if (e.button != null && e.button !== 0) return
      const resolved = resolveClickAudit(e.target)
      if (!resolved) return

      const key = `${resolved.event_type}|${resolved.label}|${resolved.element}`
      const now = Date.now()
      if (lastClickRef.current.key === key && now - lastClickRef.current.at < CLICK_DEDUPE_MS) {
        return
      }
      lastClickRef.current = { key, at: now }

      trackActivity({
        ...resolved,
        path: `${window.location.pathname}${window.location.search || ''}`,
      })
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [token])

  return children
}
