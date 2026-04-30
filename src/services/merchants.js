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

export async function getBeamerAccounts(params = {}) {
  const { data } = await api.get('/merchants/integrations/beamer/accounts', { params })
  return data
}

export async function beamerAccountUpdate(accountKey, payload) {
  const ak = encodeURIComponent(String(accountKey))
  const { data } = await api.post(`/merchants/${ak}/integrations/beamer/account-update`, payload)
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

/**
 * All transactions for a customer under this merchant (same payload shape as GET /transactions/statement).
 * Path encodes `account_key` and `identifier`; pass `page`, `limit`, filters as query only.
 * @param {string} accountKey
 * @param {string} identifier Customer identifier
 * @param {Record<string, string | number | undefined>} [params] page, limit, wallet_key, status, currency_code, search, from_date, to_date
 * @param {AbortSignal} [signal]
 */
export async function getMerchantCustomerTransactions(accountKey, identifier, params = {}, signal) {
  const ak = encodeURIComponent(String(accountKey))
  const id = encodeURIComponent(String(identifier))
  const { data } = await api.get(`/merchants/${ak}/customers/${id}/transactions`, { params, signal })
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

// ── Transaction history (global endpoints) ───────────────────────────────────

export async function getDepositTransactions(params = {}) {
  const { data } = await api.get('/transactions/deposits', { params })
  return data
}

export async function getWithdrawalTransactions(params = {}) {
  const { data } = await api.get('/transactions/withdrawals', { params })
  return data
}

export async function getTransferTransactions(params = {}) {
  const { data } = await api.get('/transactions/transfers', { params })
  return data
}
