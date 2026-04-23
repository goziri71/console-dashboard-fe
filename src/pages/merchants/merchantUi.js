/**
 * Normalizes merchant list API fields for the merchants landing table.
 * Uses explicit API fields when present; otherwise light heuristics.
 */

export function countryToFlagEmoji(code) {
  if (!code || typeof code !== 'string') return null
  const cc = code.slice(0, 2).toUpperCase()
  if (cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return null
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)))
}

/**
 * Lowercase `type` for comparisons / filters (optional).
 */
export function normalizeMerchantType(merchant) {
  const raw = merchant?.merchant_type ?? merchant?.type ?? merchant?.account_type
  if (raw == null || raw === '') return null
  return String(raw).toLowerCase().trim()
}

/**
 * Type column: API values like `baas` / `saas`; `baas` is shown as "Merchant" in the UI.
 */
export function typeLabel(merchant) {
  if (merchant == null) return '—'
  const raw = merchant.merchant_type ?? merchant.type ?? merchant.account_type
  if (raw == null || raw === '') return '—'
  const s = String(raw).trim()
  if (s.toLowerCase() === 'baas') return 'Merchant'
  return s
}

export function normalizeKycKey(merchant) {
  const raw = merchant.kyc_status ?? merchant.kyc_verification_status ?? merchant.kyc_state
  if (raw != null && raw !== '') {
    const s = String(raw).toLowerCase().replace(/\s+/g, '_')
    if (s === 'unverified' || s === 'not_started') return 'none'
    if (['verified', 'pending', 'rejected', 'none'].includes(s)) return s
  }
  if (merchant.customer_count > 3) return 'verified'
  if (merchant.customer_count > 0) return 'pending'
  return 'none'
}

export function normalizeAccountStatusKey(merchant) {
  const raw = merchant.account_status ?? merchant.account_state ?? merchant.lifecycle_status
  if (raw != null && raw !== '') {
    const s = String(raw).toLowerCase()
    if (['active', 'inactive', 'suspended'].includes(s)) return s
  }
  return 'active'
}

export function tierLabel(merchant) {
  const t = merchant.default_kyc_tier ?? merchant.kyc_tier ?? 0
  const n = Number(t)
  return Number.isFinite(n) ? `Tier ${n}` : '—'
}
