import api from './api'
import { clearStoredAuth } from '../lib/authStorage'

export async function login(email, password, deviceLabel, deviceId) {
  const { data } = await api.post('/auth/login', {
    email,
    password,
    device_label: deviceLabel,
    device_id: deviceId,
  })
  return data
}

/** Alpha-backed login enrollment — `{ challenge_token, code }` only. */
export async function confirmMfaEnrollment(challengeToken, code) {
  const { data } = await api.post('/auth/mfa/enroll/confirm', {
    challenge_token: challengeToken,
    code,
  })
  return data
}

/** Alpha-backed login verify — TOTP `{ challenge_token, code }` only (no recovery_code). */
export async function verifyMfaChallenge(challengeToken, code) {
  const { data } = await api.post('/auth/mfa/challenge/verify', {
    challenge_token: challengeToken,
    code,
  })
  return data
}

export async function stepUpMfa(code) {
  const { data } = await api.post('/auth/mfa/step-up', { code })
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
