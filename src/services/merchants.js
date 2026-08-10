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

/**
 * Udara / Beamer — POST JSON `{ headers, data }` per ISVS contract.
 * Also sends `Request-Id` as HTTP header (server accepts either).
 */
async function postBeamerIntegration(accountKey, action, body, requestId) {
  const ak = encodeURIComponent(String(accountKey))
  const rid = requestId || crypto.randomUUID()
  const payload =
    body?.headers && body?.data
      ? body
      : {
          headers: { 'Request-Id': rid },
          data: body?.data ?? body,
        }
  if (!payload.headers['Request-Id']) {
    payload.headers = { ...payload.headers, 'Request-Id': rid }
  }
  const { data } = await api.post(`/merchants/${ak}/integrations/beamer/${action}`, payload, {
    headers: { 'Request-Id': rid },
  })
  return data
}

/** First-time Udara link — only when merchant.udara360 is null. */
export async function beamerAccountLink(accountKey, body, requestId) {
  return postBeamerIntegration(accountKey, 'account-link', body, requestId)
}

/** Refresh Udara credentials — only when merchant.udara360 is populated. */
export async function beamerAccountUpdate(accountKey, body, requestId) {
  return postBeamerIntegration(accountKey, 'account-update', body, requestId)
}

/**
 * Resolve / query pending NGN payout status (TSQ).
 * Body: `{ headers: { Request-Id }, data: { reference } }` — reference is live_reference.
 */
export async function beamerNgnTsq(accountKey, body = {}, requestId) {
  const reference =
    body?.data?.reference ?? body?.reference ?? (typeof body === 'string' ? body : '')
  return postBeamerIntegration(
    accountKey,
    'ngn-tsq',
    {
      headers: body?.headers,
      data: { reference: String(reference || '').trim() },
    },
    requestId
  )
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

/** Merchant KYC tier 1–3 — `PATCH /merchants/:account_key/tier` */
export async function patchMerchantTier(accountKey, payload) {
  const ak = encodeURIComponent(String(accountKey))
  const { data } = await api.patch(`/merchants/${ak}/tier`, payload)
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
