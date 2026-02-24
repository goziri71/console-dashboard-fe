import api from './api'

// ── List + stats ──────────────────────────────────────────────────────────────

export async function getMerchantStats() {
  const { data } = await api.get('/merchants/stats')
  return data
}

export async function getMerchants(params = {}) {
  const { data } = await api.get('/merchants', { params })
  return data
}

// ── Single merchant ───────────────────────────────────────────────────────────

export async function getMerchant(accountKey) {
  const { data } = await api.get(`/merchants/${accountKey}`)
  return data
}

/** operations, compliance only */
export async function updateMerchant(accountKey, payload) {
  const { data } = await api.patch(`/merchants/${accountKey}`, payload)
  return data
}

// ── Sub-resources ─────────────────────────────────────────────────────────────

export async function getMerchantWallets(accountKey, params = {}) {
  const { data } = await api.get(`/merchants/${accountKey}/wallets`, { params })
  return data
}

export async function getMerchantWallet(accountKey, walletKey) {
  const { data } = await api.get(`/merchants/${accountKey}/wallets/${walletKey}`)
  return data
}

export async function getMerchantCustomers(accountKey, params = {}) {
  const { data } = await api.get(`/merchants/${accountKey}/customers`, { params })
  return data
}

export async function getMerchantLedgers(accountKey, params = {}) {
  const { data } = await api.get(`/merchants/${accountKey}/ledgers`, { params })
  return data
}

export async function getMerchantSettlements(accountKey, params = {}) {
  const { data } = await api.get(`/merchants/${accountKey}/settlements`, { params })
  return data
}
