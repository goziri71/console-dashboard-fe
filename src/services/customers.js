import api from './api'

export async function getCustomerStats() {
  const { data } = await api.get('/customers/stats')
  return data
}

export async function getCustomers(params = {}) {
  const { data } = await api.get('/customers', { params })
  return data
}
