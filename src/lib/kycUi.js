function unwrapPayload(payload) {
  if (payload == null) return null
  if (
    typeof payload === 'object' &&
    payload.data != null &&
    typeof payload.data === 'object' &&
    !Array.isArray(payload.data)
  ) {
    return payload.data
  }
  return payload
}

export function pickKycRecords(res) {
  const inner = unwrapPayload(res) ?? res ?? {}
  if (Array.isArray(inner.records)) return inner.records
  if (Array.isArray(inner.items)) return inner.items
  if (Array.isArray(inner.kycs)) return inner.kycs
  if (Array.isArray(inner.data?.records)) return inner.data.records
  if (Array.isArray(inner.data)) return inner.data
  if (Array.isArray(inner)) return inner
  return []
}

export function parseMerchantKycListResponse(res) {
  const inner = unwrapPayload(res) ?? res ?? {}
  const merchantBlock =
    inner.merchant && typeof inner.merchant === 'object'
      ? inner.merchant
      : {
          kyc_status: inner.kyc_status,
          kyc_record_count: inner.kyc_record_count,
          kyc_pending_record_count: inner.kyc_pending_record_count,
          kyc_compliant_record_count: inner.kyc_compliant_record_count,
        }
  const pag = inner.pagination ?? inner.meta?.pagination ?? inner.meta ?? {}
  return {
    merchant: merchantBlock,
    records: pickKycRecords(res),
    pendingCount: Number(
      merchantBlock.kyc_pending_record_count ??
        inner.kyc_pending_record_count ??
        pag.pending_count ??
        0
    ),
    pagination: pag,
  }
}

export function kycRowReference(row) {
  if (!row || typeof row !== 'object') return ''
  const ref = row.reference ?? row.kyc_reference ?? row.live_reference
  if (ref != null && ref !== '') return String(ref)
  if (row.id != null && row.id !== '') return String(row.id)
  if (row.kyc_id != null && row.kyc_id !== '') return String(row.kyc_id)
  return ''
}

export function kycRowStatusKey(row) {
  if (!row || typeof row !== 'object') return 'none'

  const compliant = row.is_compliant
  if (compliant != null && compliant !== '') {
    const c = String(compliant).toUpperCase()
    if (c === 'Y' || c === 'YES' || c === '1' || c === 'TRUE') return 'verified'
    if (c === 'N' || c === 'NO' || c === '0' || c === 'FALSE') return 'pending'
  }

  const compliance = row.compliance_status
  if (compliance != null && compliance !== '') {
    const s = String(compliance).toLowerCase().trim()
    if (s.includes('compliant') && !s.includes('non')) return 'verified'
    if (s.includes('pending') || s.includes('review')) return 'pending'
    if (s.includes('reject') || s.includes('fail')) return 'rejected'
  }

  const statusStr = row.status ?? row.kyc_status ?? row.verification_status ?? ''
  const s = String(statusStr).toLowerCase().trim()
  if (s.includes('verif') || s.includes('approved') || s.includes('compliant') || s === 'active') {
    return 'verified'
  }
  if (s.includes('pend') || s.includes('submitted') || s.includes('review')) return 'pending'
  if (s.includes('reject') || s.includes('fail')) return 'rejected'
  return 'none'
}

export function isKycRowPending(row) {
  return kycRowStatusKey(row) === 'pending'
}

/** Row can be approved when not already compliant. */
export function isKycRowApprovable(row) {
  if (!row || typeof row !== 'object') return false
  if (kycRowStatusKey(row) === 'verified') return false
  const compliant = row.is_compliant
  if (compliant != null && compliant !== '') {
    const c = String(compliant).toUpperCase()
    if (c === 'Y' || c === 'YES' || c === '1' || c === 'TRUE') return false
    return true
  }
  const sk = kycRowStatusKey(row)
  return sk === 'pending' || sk === 'none' || sk === 'rejected'
}

export function normalizeKycAggregateStatus(raw) {
  if (raw == null || raw === '') return 'none'
  const s = String(raw).toLowerCase().trim().replace(/\s+/g, '_')
  if (s === 'unverified' || s === 'not_started') return 'none'
  if (['verified', 'pending', 'rejected', 'none'].includes(s)) return s
  if (s.includes('verif')) return 'verified'
  if (s.includes('pend')) return 'pending'
  if (s.includes('reject')) return 'rejected'
  return 'none'
}

export function kycAggregateLabel(key) {
  const k = normalizeKycAggregateStatus(key)
  if (k === 'verified') return 'Verified'
  if (k === 'pending') return 'Pending'
  if (k === 'rejected') return 'Rejected'
  return 'None'
}

export function kycKeyToUpper(key) {
  const k = normalizeKycAggregateStatus(key)
  if (k === 'verified') return 'VERIFIED'
  if (k === 'pending') return 'PENDING'
  if (k === 'rejected') return 'REJECTED'
  return 'NONE'
}

export function kycStatusPillClass(key) {
  const k = key === 'verified' ? 'verified' : key === 'pending' ? 'pending' : key === 'rejected' ? 'rejected' : 'none'
  if (k === 'verified') return 'bg-success-bg text-success border border-success/30'
  if (k === 'pending') return 'bg-warning-bg text-warning border border-warning/30'
  if (k === 'rejected') return 'bg-error-bg text-error border border-error/30'
  return 'bg-card-hover text-text-muted border border-border'
}

/** Extract user-facing message from Axios / console envelope errors. */
export function getApiErrorMessage(err, fallback = 'Request failed.') {
  if (!err) return fallback
  const data = err.response?.data
  if (data && typeof data === 'object') {
    if (typeof data.message === 'string' && data.message.trim()) return data.message.trim()
    if (typeof data.error === 'string' && data.error.trim()) return data.error.trim()
  }
  if (typeof err.message === 'string' && err.message.trim() && err.message !== 'Request failed') {
    return err.message.trim()
  }
  const status = err.response?.status
  if (status === 403) return 'You do not have permission for this action (kyc.update required).'
  if (status === 404) return 'KYC endpoint or record not found on the API.'
  if (status === 400) return data?.message || 'This KYC was already approved or the request was invalid.'
  return fallback
}

export function parseMerchantKycApproveResponse(res) {
  const inner = unwrapPayload(res) ?? res ?? {}
  return {
    approvedCount: Number(inner.approved_count ?? inner.approvedCount ?? 0),
    records: pickKycRecords({ records: inner.records ?? inner.data?.records }),
  }
}

export function kycIdentificationLabel(row) {
  if (!row || typeof row !== 'object') return '—'
  const raw =
    row.identification_type ??
    row.document_type ??
    row.doc_type ??
    row.type ??
    row.kyc_type ??
    ''
  if (!raw) return '—'
  return String(raw).replace(/_/g, ' ')
}
