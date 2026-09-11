import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../services/api'

/**
 * Live SSE feed for Command Center audit events.
 * EventSource cannot set Authorization reliably — token goes on the query string.
 */
export function useCommandCenterStream({ enabled, token, onAudit }) {
  const [liveStatus, setLiveStatus] = useState('connecting')
  const onAuditRef = useRef(onAudit)
  const eventSourceSupported = typeof EventSource !== 'undefined'

  useEffect(() => {
    onAuditRef.current = onAudit
  }, [onAudit])

  useEffect(() => {
    if (!enabled || !token || !eventSourceSupported) return undefined

    let es
    try {
      const url = `${API_BASE_URL}/ops/command-center/stream?access_token=${encodeURIComponent(token)}`
      es = new EventSource(url)
    } catch (err) {
      console.error('[command-center] EventSource failed', err)
      return undefined
    }

    function handleAudit(ev) {
      setLiveStatus('live')
      if (!ev?.data) return
      try {
        const event = JSON.parse(ev.data)
        onAuditRef.current?.(event)
      } catch {
        // ignore malformed heartbeat-adjacent payloads
      }
    }

    es.addEventListener('audit', handleAudit)
    es.onmessage = handleAudit
    es.onopen = () => setLiveStatus('live')
    es.onerror = () => setLiveStatus('reconnecting')

    return () => {
      try {
        es.removeEventListener('audit', handleAudit)
        es.close()
      } catch {
        // ignore
      }
    }
  }, [enabled, token, eventSourceSupported])

  if (!enabled || !token) return 'idle'
  if (!eventSourceSupported) return 'offline'
  return liveStatus
}
