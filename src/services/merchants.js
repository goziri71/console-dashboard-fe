import api from './api'

export async function getMerchantStats() {
  const { data } = await api.get('/merchants/stats')
  return data
}

export async function getMerchants(params = {}) {
  const { data } = await api.get('/merchants', { params })
  return data
}
