import api from './api'

/**
 * @param {Record<string, string | number | undefined>} [params]
 *   Use **identifier** (customer id) to scope summary to that customer’s wallets; optional account_key, status, etc.
 */
export async function getDisputesSummary(params = {}) {
  const { data } = await api.get('/disputes/summary', { params })
  return data
}

/**
 * @param {Record<string, unknown>} params page, limit, filters + sort_by, order.
 *   Pass **identifier** (customer id) to restrict the list to that customer’s disputes.
 */
export async function getDisputes(params = {}) {
  const { data } = await api.get('/disputes', { params })
  return data
}

export async function getDispute(disputeReference) {
  const { data } = await api.get(`/disputes/${encodeURIComponent(disputeReference)}`)
  return data
}

/** @param {{ status?: string, settlement_status?: string }} payload */
export async function patchDispute(disputeReference, payload) {
  const { data } = await api.patch(`/disputes/${encodeURIComponent(disputeReference)}`, payload)
  return data
}
