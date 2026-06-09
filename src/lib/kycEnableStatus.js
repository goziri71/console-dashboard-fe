import { normalizeKycAggregateStatus } from './kycUi'

export function pickEntityKycKeys(entity) {
  if (entity == null || typeof entity !== 'object') {
    return { userKey: '', accountKey: '', sessionId: '' }
  }
  return {
    userKey: String(entity.user_key ?? entity.userKey ?? '').trim(),
    accountKey: String(entity.account_key ?? entity.accountKey ?? '').trim(),
    sessionId: String(entity.session_id ?? entity.sessionId ?? '').trim(),
  }
}

/** Map passthrough KYC enable-status API body → aggregate key (verified | pending | rejected | none). */
export function mapKycEnableResponseToKey(body) {
  if (body == null || typeof body !== 'object') return null

  const data =
    body.data != null && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {}

  const rawStatus =
    data.kyc_status ??
    data.status ??
    data.verification_status ??
    data.compliance_status ??
    data.enable_status ??
    data.kyc_state

  if (rawStatus != null && rawStatus !== '') {
    const normalized = normalizeKycAggregateStatus(rawStatus)
    if (normalized !== 'none') return normalized
  }

  const enabled =
    data.enabled ??
    data.is_enabled ??
    data.sub_account_enabled ??
    data.kyc_enabled ??
    body.enabled

  if (enabled === true) return 'verified'
  if (enabled === false) return 'pending'

  if (body.state === true || Number(body.code) === 2000) {
    const msg = String(body.message ?? '').toLowerCase()
    if (msg.includes('pend')) return 'pending'
    if (msg.includes('reject') || msg.includes('denied')) return 'rejected'
    if (msg.includes('verif') || msg.includes('success') || msg.includes('enable')) return 'verified'
    return 'verified'
  }

  if (body.state === false) {
    const msg = String(body.message ?? '').toLowerCase()
    if (msg.includes('pend')) return 'pending'
    if (msg.includes('reject') || msg.includes('denied')) return 'rejected'
  }

  return null
}
