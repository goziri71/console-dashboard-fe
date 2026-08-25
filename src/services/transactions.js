import api from './api'

export async function getStatementTransactions(params = {}, signal) {
  const { data } = await api.get('/transactions/statement', { params, signal })
  return data
}

export async function getDepositTransactions(params = {}, signal) {
  const { data } = await api.get('/transactions/deposits', { params, signal })
  return data
}

export async function getWithdrawalTransactions(params = {}, signal) {
  const { data } = await api.get('/transactions/withdrawals', { params, signal })
  return data
}

export async function getTransferTransactions(params = {}, signal) {
  const { data } = await api.get('/transactions/transfers', { params, signal })
  return data
}

export async function getSwapTransactions(params = {}, signal) {
  const { data } = await api.get('/transactions/swaps', { params, signal })
  return data
}

export async function getNgnDeposits(params = {}, signal) {
  const { data } = await api.get('/transactions/ngn-deposits', { params, signal })
  return data
}

export async function getNgnPayouts(params = {}, signal) {
  const { data } = await api.get('/transactions/ngn-payouts', { params, signal })
  return data
}

export async function getCryptoDeposits(params = {}, signal) {
  const { data } = await api.get('/transactions/crypto-deposits', { params, signal })
  return data
}

export async function getCryptoPayouts(params = {}, signal) {
  const { data } = await api.get('/transactions/crypto-payouts', { params, signal })
  return data
}

/**
 * Replay merchant deposit webhook (Sterllo Verify Deposit with notify: true).
 * Requires merchant.update.
 * @param {{ reference: string, currency_code: string, session_id: string, user_key?: string, account_key?: string, Credentials?: string }} body
 */
export async function replayDepositWebhook(body) {
  const { data } = await api.post('/transactions/deposits/webhook-replay', body)
  return data
}

/** Pending transaction review queue (list + summary). Resolve uses Beamer NGN TSQ. */
export async function getPendingReviewTransactions(params = {}, signal) {
  const { data } = await api.get('/transactions/pending-review', { params, signal })
  return data
}

export async function getPendingReviewSummary(params = {}, signal) {
  const { data } = await api.get('/transactions/pending-review/summary', { params, signal })
  return data
}
