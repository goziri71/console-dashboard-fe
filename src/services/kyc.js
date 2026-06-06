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

/**
 * KYC enable status (passthrough). Customer or merchant row — header `key` = user_key, `account_key`.
 */
export async function getKycEnableStatus({ userKey, accountKey }, signal) {
  const key = String(userKey ?? '').trim()
  const ak = String(accountKey ?? '').trim()
  const response = await api.get('/customers/kyc/sub-account-enable-status', {
    headers: {
      key,
      account_key: ak,
    },
    signal,
    validateStatus: () => true,
  })
  return { httpStatus: response.status, body: response.data }
}
