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

function loginDeviceFields(deviceLabel, deviceId) {
  const fields = {}
  if (deviceId) fields.device_id = deviceId
  if (deviceLabel) fields.device_label = deviceLabel
  return fields
}

/** Alpha-backed login enrollment — `{ challenge_token, code }` + optional device context. */
export async function confirmMfaEnrollment(challengeToken, code, deviceLabel, deviceId) {
  const { data } = await api.post('/auth/mfa/enroll/confirm', {
    challenge_token: challengeToken,
    code,
    ...loginDeviceFields(deviceLabel, deviceId),
  })
  return data
}

/** Alpha-backed login verify — TOTP `{ challenge_token, code }` only (no recovery_code). */
export async function verifyMfaChallenge(challengeToken, code, deviceLabel, deviceId) {
  const { data } = await api.post('/auth/mfa/challenge/verify', {
    challenge_token: challengeToken,
    code,
    ...loginDeviceFields(deviceLabel, deviceId),
  })
  return data
}

/** Locked-account email OTP verify — `{ challenge_token, code }` + optional device context. */
export async function verifyLoginOtp(challengeToken, code, deviceLabel, deviceId) {
  const { data } = await api.post('/auth/login/otp/verify', {
    challenge_token: challengeToken,
    code,
    ...loginDeviceFields(deviceLabel, deviceId),
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
