import api from './api'

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

export async function logout() {
  try {
    await api.post('/auth/logout')
  } finally {
    localStorage.removeItem('sterllo_token')
    localStorage.removeItem('sterllo_user')
  }
}

export async function getProfile() {
  const { data } = await api.get('/auth/profile')
  return data
}
