import api from './api'

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

/**
 * Console user registration — `POST /api/v1/auth/register`
 * @param {{ email: string, password: string, first_name: string, last_name: string, role: string }} payload
 */
export async function register(payload) {
  const { data } = await api.post('/api/v1/auth/register', payload)
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
