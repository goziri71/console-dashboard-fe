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

/** Tier must be 1, 2, or 3. Requires `customer.update`. */
export async function patchCustomerTier(identifier, payload) {
  const id = encodeURIComponent(String(identifier))
  const { data } = await api.patch(`/customers/${id}/tier`, payload)
  return data
}

/** At least one of is_pnd, is_pnc (Y/N or 1/0 in body). */
export async function patchCustomerRestrictions(identifier, payload) {
  const id = encodeURIComponent(String(identifier))
  const { data } = await api.patch(`/customers/${id}/restrictions`, payload)
  return data
}

/** Optional body `{ scope: 'full' | 'debit_only' | 'credit_only' }` — defaults to full freeze. */
export async function postCustomerFreeze(identifier, payload = {}) {
  const id = encodeURIComponent(String(identifier))
  const { data } = await api.post(`/customers/${id}/freeze`, payload)
  return data
}

/** Clears PND and PNC to N. */
export async function postCustomerUnfreeze(identifier) {
  const id = encodeURIComponent(String(identifier))
  const { data } = await api.post(`/customers/${id}/unfreeze`)
  return data
}

/** Paginated KYC rows for this customer. */
export async function getCustomerKycs(identifier, params = {}) {
  const id = encodeURIComponent(String(identifier))
  const { data } = await api.get(`/customers/${id}/kycs`, { params })
  return data
}

/**
 * BUSINESS customers only — approve / set business KYC compliance.
 * Body: `{}` or `{ is_business_compliant: 'Y'|'N' }`. Personal customers use PATCH /kycs/:reference.
 */
export async function approveCustomerBusinessKyc(identifier, body = { is_business_compliant: 'Y' }) {
  const id = encodeURIComponent(String(identifier))
  const { data } = await api.post(`/customers/${id}/kyc/approve`, body)
  return data
}
