import api from './api'
import { clearStoredAuth } from '../lib/authStorage'

export async function loginWithCrosslink(token, deviceLabel) {
  const { data } = await api.post('/auth/login-user', {
    token,
    device_label: deviceLabel,
  })
  return data
}

/** Admin-provisioned console user. */
export async function register(payload) {
  const { data } = await api.post('/auth/register', payload)
  return data
}

export async function logout() {
  try {
    await api.post('/auth/logout')
  } finally {
    clearStoredAuth()
  }
}

export async function getProfile() {
  const { data } = await api.get('/auth/profile')
  return data
}
