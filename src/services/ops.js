import api, { API_BASE_URL } from './api'
import { getAuthToken } from '../lib/authStorage'

export async function getCommandCenterEvents(params = {}, signal) {
  const { data } = await api.get('/ops/command-center/events', { params, signal })
  return data
}

export async function getCommandCenterPulse(params = {}, signal) {
  const { data } = await api.get('/ops/command-center/pulse', { params, signal })
  return data
}

export async function getCommandCenterPresence(signal) {
  const { data } = await api.get('/ops/command-center/presence', { signal })
  return data
}

/**
 * Ingest UI activity (clicks, page views, filters). Accepts a single event or `{ events: [...] }`.
 * Max 40 events per request. Backend responds 202.
 */
export async function postCommandCenterActivity(body) {
  const { data } = await api.post('/ops/command-center/activity', body)
  return data
}

/** Flush on unload / hide with fetch keepalive (EventSource-style auth via Bearer). */
export function postCommandCenterActivityKeepalive(events) {
  const token = getAuthToken()
  if (!token || !events?.length) return
  const payload = JSON.stringify({ events: events.slice(0, 40) })
  try {
    fetch(`${API_BASE_URL}/ops/command-center/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore unload failures
  }
}
