import api from './api'

export async function getCustomerStats() {
  const { data } = await api.get('/customers/stats')
  return data
}

export async function getCustomers(params = {}) {
  const { data } = await api.get('/customers', { params })
  return data
}

export async function getCustomer(identifier) {
  const id = encodeURIComponent(String(identifier))
  const { data } = await api.get(`/customers/${id}`)
  return data
}

/** operations, compliance — see API PATCH /customers/:identifier */
export async function patchCustomer(identifier, payload) {
  const id = encodeURIComponent(String(identifier))
  const { data } = await api.patch(`/customers/${id}`, payload)
  return data
}

export async function getCustomerWallets(identifier, params = {}) {
  const id = encodeURIComponent(String(identifier))
  const { data } = await api.get(`/customers/${id}/wallets`, { params })
  return data
}

/** Summary counts for profile metric cards (wallets, sub-accounts, disputes). */
export async function getCustomerMetrics(identifier) {
  const id = encodeURIComponent(String(identifier))
  const { data } = await api.get(`/customers/${id}/metrics`)
  return data
}

/** Per-wallet ledger lines; backend may require `financial.read`. */
export async function getCustomerWalletLedger(identifier, walletKey, params = {}) {
  const id = encodeURIComponent(String(identifier))
  const wk = encodeURIComponent(String(walletKey))
  const { data } = await api.get(`/customers/${id}/wallets/${wk}/ledger`, { params })
  return data
}
