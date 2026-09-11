import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../services/api'

/**
 * Live SSE feed for Command Center audit events.
 * EventSource cannot set Authorization reliably — token goes on the query string.
 */
export function useCommandCenterStream({ enabled, token, onAudit }) {
  const [liveStatus, setLiveStatus] = useState('connecting')
  const onAuditRef = useRef(onAudit)

  useEffect(() => {
    onAuditRef.current = onAudit
  }, [onAudit])

  useEffect(() => {
    if (!enabled || !token) return undefined

    const url = `${API_BASE_URL}/ops/command-center/stream?access_token=${encodeURIComponent(token)}`
    const es = new EventSource(url)

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
      es.removeEventListener('audit', handleAudit)
      es.close()
    }
  }, [enabled, token])

  if (!enabled || !token) return 'idle'
  return liveStatus
}
