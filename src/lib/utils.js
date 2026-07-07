export function formatNumber(num) {
  return new Intl.NumberFormat('en-NG').format(num)
}

export function formatCurrency(amount, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatNaira(amount) {
  return `₦${new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function timeAgo(timestamp) {
  const now = Date.now()
  const diff = now - new Date(timestamp).getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return new Date(timestamp).toLocaleDateString()
}

export function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400)
  const hrs = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days}d ${hrs}h`
  return `${hrs}h`
}

const alpha3ToAlpha2 = {
  NGA: 'NG', USA: 'US', GBR: 'GB', GHA: 'GH', ZAF: 'ZA', KEN: 'KE',
  TZA: 'TZ', UGA: 'UG', RWA: 'RW', ETH: 'ET', EGY: 'EG', MAR: 'MA',
  CMR: 'CM', SEN: 'SN', CIV: 'CI', BEN: 'BJ', TGO: 'TG', NER: 'NE',
  MLI: 'ML', BFA: 'BF', GAB: 'GA', COD: 'CD', AGO: 'AO', MOZ: 'MZ',
  BWA: 'BW', NAM: 'NA', ZMB: 'ZM', ZWE: 'ZW', MWI: 'MW', LSO: 'LS',
  SWZ: 'SZ', MUS: 'MU', MDG: 'MG', SYC: 'SC', CPV: 'CV', SLE: 'SL',
  LBR: 'LR', GIN: 'GN', GMB: 'GM', MRT: 'MR', DJI: 'DJ', ERI: 'ER',
  SOM: 'SO', SDN: 'SD', SSD: 'SS', TCD: 'TD', CAF: 'CF', COG: 'CG',
  GNQ: 'GQ', STP: 'ST', COM: 'KM', TUN: 'TN', LBY: 'LY', DZA: 'DZ',
  CAN: 'CA', MEX: 'MX', BRA: 'BR', ARG: 'AR', COL: 'CO', CHL: 'CL',
  PER: 'PE', VEN: 'VE', ECU: 'EC', BOL: 'BO', PRY: 'PY', URY: 'UY',
  IND: 'IN', CHN: 'CN', JPN: 'JP', KOR: 'KR', IDN: 'ID', THA: 'TH',
  VNM: 'VN', MYS: 'MY', SGP: 'SG', PHL: 'PH', AUS: 'AU', NZL: 'NZ',
  DEU: 'DE', FRA: 'FR', ITA: 'IT', ESP: 'ES', PRT: 'PT', NLD: 'NL',
  BEL: 'BE', AUT: 'AT', CHE: 'CH', SWE: 'SE', NOR: 'NO', DNK: 'DK',
  FIN: 'FI', POL: 'PL', CZE: 'CZ', ROU: 'RO', HUN: 'HU', GRC: 'GR',
  IRL: 'IE', ISR: 'IL', TUR: 'TR', SAU: 'SA', ARE: 'AE', QAT: 'QA',
  KWT: 'KW', BHR: 'BH', OMN: 'OM', JOR: 'JO', LBN: 'LB', PAK: 'PK',
  BGD: 'BD', LKA: 'LK', NPL: 'NP', MMR: 'MM', KHM: 'KH', LAO: 'LA',
}

export function countryCodeToFlag(code) {
  if (!code) return ''
  const alpha2 = code.length === 3 ? (alpha3ToAlpha2[code.toUpperCase()] || '') : code.toUpperCase()
  if (alpha2.length !== 2) return ''
  return String.fromCodePoint(
    ...[...alpha2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  )
}

/** Posting / restriction flags: API uses Y/N; 1/0 accepted and normalized server-side. */
export function flagYes(v) {
  const s = String(v ?? '').trim().toUpperCase()
  return s === 'Y' || s === '1' || v === 1
}

export function flagNo(v) {
  const s = String(v ?? '').trim().toUpperCase()
  return s === 'N' || s === '0' || v === 0
}

export function deriveRiskLevel(customer) {
  if (!customer || typeof customer !== 'object') return 'low'
  if (flagYes(customer.is_pnd) || flagYes(customer.is_pnc)) return 'high'
  if (flagNo(customer.is_personal_compliant) || flagNo(customer.is_business_compliant)) return 'medium'
  return 'low'
}

export function exportToCsv(rows, filename = 'export.csv') {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? ''
        return typeof val === 'string' && (val.includes(',') || val.includes('"'))
          ? `"${val.replace(/"/g, '""')}"`
          : val
      }).join(',')
    ),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const currencySymbolMap = {
  NGN: '₦', USD: '$', GBP: '£', EUR: '€', JPY: '¥', INR: '₹',
  KRW: '₩', BRL: 'R$', CHF: 'CHF', CAD: 'C$', AUD: 'A$', NZD: 'NZ$',
  ZAR: 'R', GHS: 'GH₵', KES: 'KSh', AED: 'د.إ', SAR: 'ر.س',
  JOD: 'J.D', BWP: 'P', XOF: 'CFA', XAF: 'FCFA',
}

export function formatBalance(amount, currencyCode) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '--'
  const symbol = currencySymbolMap[currencyCode?.toUpperCase()] || currencyCode || ''
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
  return `${symbol}\u00A0${formatted}`
}

/** Unified datetime: yyyy-mm-dd hh:mm:ss (24-hour). */
export function formatDate(dateStr) {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '--'
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const sec = String(d.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`
}
