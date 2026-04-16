import { countryToFlagEmoji } from './merchantUi'

export { countryToFlagEmoji }

export function customerDisplayName(c) {
  const n = [c?.first_name, c?.surname].filter(Boolean).join(' ').trim()
  return n || '—'
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

export function customerKycKey(c) {
  const raw = c?.kyc_status ?? c?.kyc_verification_status ?? c?.verification_status
  if (raw != null && raw !== '') {
    const s = String(raw).toLowerCase().replace(/\s+/g, '_')
    if (s === 'unverified') return 'none'
    if (['verified', 'pending', 'rejected', 'none'].includes(s)) return s
  }
  if (c?.kyc_status === true || c?.verified === true) return 'verified'
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
