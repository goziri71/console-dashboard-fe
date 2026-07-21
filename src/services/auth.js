import api from './api'
import { clearStoredAuth } from '../lib/authStorage'

export async function loginWithCrosslink(token, deviceLabel) {
  const { data } = await api.post('/auth/login-user', {
    token,
    device_label: deviceLabel,
  })
  return data
}

export async function confirmMfaEnrollment(challengeToken, code, deviceLabel) {
  const { data } = await api.post('/auth/mfa/enroll/confirm', {
    challenge_token: challengeToken,
    code,
    device_label: deviceLabel,
  })
  return data
}

export async function verifyMfaChallenge(challengeToken, credential, deviceLabel) {
  const payload = {
    challenge_token: challengeToken,
    device_label: deviceLabel,
    ...(credential.type === 'recovery_code'
      ? { recovery_code: credential.value }
      : { code: credential.value }),
  }
  const { data } = await api.post('/auth/mfa/challenge/verify', payload)
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
