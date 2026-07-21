import api from './api'

export const PRICING_FEE_TYPES = [
  'deposit',
  'payout',
  'swap',
  'transfer',
  'withdrawal',
  'overdraft_processing',
  'wallet_maintenance',
]

export async function getMerchantFees(accountKey) {
  const { data } = await api.get(`/merchants/${encodeURIComponent(accountKey)}/fees`)
  return data
}

export async function createMerchantFee(accountKey, feeType, body) {
  const { data } = await api.post(
    `/merchants/${encodeURIComponent(accountKey)}/fees/${feeType}`,
    body
  )
  return data
}

export async function updateMerchantFee(accountKey, feeType, id, body) {
  const { data } = await api.patch(
    `/merchants/${encodeURIComponent(accountKey)}/fees/${feeType}/${encodeURIComponent(id)}`,
    body
  )
  return data
}

export async function deleteMerchantFee(accountKey, feeType, id) {
  await api.delete(
    `/merchants/${encodeURIComponent(accountKey)}/fees/${feeType}/${encodeURIComponent(id)}`
  )
}

export async function getDefaultFees() {
  const { data } = await api.get('/fees/defaults')
  return data
}

export async function createDefaultFee(feeType, body) {
  const { data } = await api.post(`/fees/defaults/${feeType}`, body)
  return data
}

export async function updateDefaultFee(feeType, id, body) {
  const { data } = await api.patch(
    `/fees/defaults/${feeType}/${encodeURIComponent(id)}`,
    body
  )
  return data
}

export async function deleteDefaultFee(feeType, id) {
  await api.delete(`/fees/defaults/${feeType}/${encodeURIComponent(id)}`)
}

export async function getFeeAudit(params) {
  const { data } = await api.get('/fees/audit', { params })
  return data
}
