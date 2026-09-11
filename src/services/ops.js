import api from './api'

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
