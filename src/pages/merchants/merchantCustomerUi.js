import { countryToFlagEmoji } from './merchantUi'
import { flagNo, flagYes } from '../../lib/utils'

export { countryToFlagEmoji }

/** True when customer.type (or aliases) is BUSINESS. */
export function isBusinessCustomer(c) {
  const raw = c?.type ?? c?.customer_type ?? c?.account_type
  if (raw == null || raw === '') return false
  return String(raw).trim().toUpperCase() === 'BUSINESS'
}

export function customerBusinessName(c) {
  const bn = c?.business_name ?? c?.businessName
  if (bn == null || bn === '') return ''
  return String(bn).trim()
}

export function customerDisplayName(c) {
  if (isBusinessCustomer(c)) {
    const bn = customerBusinessName(c)
    if (bn) return bn
  }
  const n = [c?.first_name, c?.surname].filter(Boolean).join(' ').trim()
  if (n) return n
  const bn = customerBusinessName(c)
  return bn || '—'
}

/** `type` from API as-is. */
export function customerTypeLabel(c) {
  const raw = c?.type ?? c?.customer_type ?? c?.account_type
  if (raw == null || raw === '') return '—'
  return String(raw).trim()
}

export function customerTierLabel(c) {
  const t = c?.default_kyc_tier ?? c?.kyc_tier ?? c?.tier
  const n = Number(t)
  return Number.isFinite(n) ? `Tier ${n}` : '—'
}

/**
 * Aggregate KYC key for display.
 * BUSINESS: driven by is_business_compliant (verified | pending), not document rows.
 */
export function customerKycKey(c) {
  if (isBusinessCustomer(c)) {
    if (flagYes(c?.is_business_compliant)) return 'verified'
    if (flagNo(c?.is_business_compliant)) return 'pending'
    const raw = c?.kyc_status ?? c?.kyc_verification_status
    if (raw != null && raw !== '') {
      const s = String(raw).toLowerCase().replace(/\s+/g, '_')
      if (s.includes('verif') || s === 'compliant') return 'verified'
      if (s.includes('pend') || s.includes('non')) return 'pending'
      if (['verified', 'pending', 'rejected', 'none'].includes(s)) return s === 'none' ? 'pending' : s
    }
    return 'pending'
  }

  const raw = c?.kyc_status ?? c?.kyc_verification_status ?? c?.verification_status
  if (raw != null && raw !== '') {
    const s = String(raw).toLowerCase().replace(/\s+/g, '_')
    if (s === 'unverified' || s === 'not_started') return 'none'
    if (['verified', 'pending', 'rejected', 'none'].includes(s)) return s
  }
  if (c?.kyc_status === true || c?.verified === true) return 'verified'
  if (flagYes(c?.is_personal_compliant)) return 'verified'
  if (flagNo(c?.is_personal_compliant)) return 'pending'
  return 'none'
}

export function customerAccountStatusKey(c) {
  const raw = c?.account_status ?? c?.status ?? c?.lifecycle_status
  if (raw != null && raw !== '') {
    const s = String(raw).toLowerCase().replace(/\s+/g, '_')
    if (['active', 'inactive', 'suspended', 'pending'].includes(s)) return s
    if (s === 'frozen' || s === 'blocked') return 'suspended'
  }
  return 'active'
}

export function customerWalletCount(c) {
  const n = c?.wallet_count ?? c?.wallets_count ?? c?.ledger_count
  if (n != null && n !== '') return Number(n) || 0
  return 0
}

/** Canonical id for API paths and `/transactions/statement?identifier=`. */
export function getCustomerIdentifier(customer) {
  if (customer == null || typeof customer !== 'object') return ''
  return (
    customer.identifier ??
    customer.customer_identifier ??
    customer.customer_key ??
    customer.account_key ??
    customer.id ??
    ''
  )
}

/** Nested `customer` block from GET /customers/:id/kycs when present. */
export function pickCustomerFromKycListResponse(res) {
  if (res == null || typeof res !== 'object') return null
  const inner =
    res.data != null && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : res
  if (inner.customer != null && typeof inner.customer === 'object') return inner.customer
  if (inner.data?.customer != null && typeof inner.data.customer === 'object') return inner.data.customer
  return null
}
