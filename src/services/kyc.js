import api from './api'

/** Global KYC queue — compliance inbox. */
export async function getKycs(params = {}, signal) {
  const { data } = await api.get('/kycs', { params, signal })
  return data
}

export async function getKyc(reference, signal) {
  const ref = encodeURIComponent(String(reference))
  const { data } = await api.get(`/kycs/${ref}`, { signal })
  return data
}

/** Approve a customer KYC record. */
export async function patchKycCompliance(reference, body = { is_compliant: 'Y' }) {
  const ref = encodeURIComponent(String(reference))
  const { data } = await api.patch(`/kycs/${ref}`, body)
  return data
}

/** Merchant-owned KYC list + summary. */
export async function getMerchantKycs(accountKey, params = {}, signal) {
  const ak = encodeURIComponent(String(accountKey))
  const { data } = await api.get(`/merchants/${ak}/kycs`, { params, signal })
  return data
}

/** Approve one merchant KYC (`{ reference }`) or all pending (`{}`). */
export async function approveMerchantKyc(accountKey, body = {}) {
  const ak = encodeURIComponent(String(accountKey))
  const { data } = await api.post(`/merchants/${ak}/kyc/approve`, body)
  return data
}
