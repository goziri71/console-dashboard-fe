import { PERMISSION_CONSOLE_READ, PERMISSION_FINANCIAL_READ } from './permissions'

/** @typedef {'financial' | 'console' | 'none'} ReportPermission */

/** Query params supported on most money reports (see API “where supported”). */
export const FINANCIAL_REPORT_PARAMS = [
  'from_date',
  'to_date',
  'account_key',
  'identifier',
  'currency_code',
  'status',
  'search',
  'wallet_key',
  'limit',
]

export const GROWTH_CUSTOMERS_PARAMS = ['from_date', 'to_date', 'limit', 'scope']

export const ANOMALY_REPORT_PARAMS = [
  'identifier',
  'window_ms',
  'min_amount',
  'from_date',
  'to_date',
  'limit',
]

export const DEFAULT_REPORT_LIMIT = 5000
export const MAX_REPORT_LIMIT = 5000

/** @type {Record<string, string>} */
export const PARAM_LABELS = {
  from_date: 'From',
  to_date: 'To',
  account_key: 'Account key',
  identifier: 'Customer identifier',
  currency_code: 'Currency',
  status: 'Status',
  search: 'Search',
  wallet_key: 'Wallet key',
  limit: 'Row limit (max 5000)',
  scope: 'Customer scope',
  window_ms: 'Window (ms)',
  min_amount: 'Min amount',
}

/**
 * @typedef {Object} ReportDefinition
 * @property {string} id
 * @property {string} label
 * @property {string} path
 * @property {'reports' | 'growth' | 'compliance'} group
 * @property {string} [description]
 * @property {ReportPermission} permission
 * @property {boolean} [hasSummary]
 * @property {boolean} [supportsCsv]
 * @property {string[]} params
 */

export const REPORT_DEFINITIONS = [
  {
    id: 'settlements',
    label: 'Settlements',
    path: '/reports/settlements',
    group: 'reports',
    description: 'Settlement batches with summary totals in the response.',
    permission: 'financial',
    hasSummary: true,
    supportsCsv: true,
    params: FINANCIAL_REPORT_PARAMS,
  },
  {
    id: 'transactions',
    label: 'Unified transactions',
    path: '/reports/transactions',
    group: 'reports',
    permission: 'financial',
    supportsCsv: true,
    params: FINANCIAL_REPORT_PARAMS,
  },
  {
    id: 'deposits',
    label: 'Deposits',
    path: '/reports/deposits',
    group: 'reports',
    permission: 'financial',
    supportsCsv: true,
    params: FINANCIAL_REPORT_PARAMS,
  },
  {
    id: 'transfers',
    label: 'Transfers',
    path: '/reports/transfers',
    group: 'reports',
    permission: 'financial',
    supportsCsv: true,
    params: FINANCIAL_REPORT_PARAMS,
  },
  {
    id: 'customer-balances',
    label: 'Customer wallet balances',
    path: '/reports/customer-balances',
    group: 'reports',
    permission: 'financial',
    supportsCsv: true,
    params: FINANCIAL_REPORT_PARAMS,
  },
  {
    id: 'opening-closing',
    label: 'Opening / closing balances',
    path: '/reports/opening-closing-balances',
    group: 'reports',
    description: 'Per wallet in the selected date range.',
    permission: 'financial',
    supportsCsv: true,
    params: FINANCIAL_REPORT_PARAMS,
  },
  {
    id: 'balance-snapshot',
    label: 'Balance snapshot',
    path: '/reports/balance-snapshot',
    group: 'reports',
    permission: 'financial',
    supportsCsv: true,
    params: FINANCIAL_REPORT_PARAMS,
  },
  {
    id: 'vat',
    label: 'VAT totals by currency',
    path: '/reports/vat',
    group: 'reports',
    permission: 'financial',
    supportsCsv: true,
    params: FINANCIAL_REPORT_PARAMS,
  },
  {
    id: 'vendors',
    label: 'NGN payout vendors',
    path: '/reports/vendors',
    group: 'reports',
    permission: 'financial',
    supportsCsv: true,
    params: FINANCIAL_REPORT_PARAMS,
  },
  {
    id: 'revenue',
    label: 'Revenue (fees) by merchant',
    path: '/reports/revenue',
    group: 'reports',
    permission: 'financial',
    supportsCsv: true,
    params: FINANCIAL_REPORT_PARAMS,
  },
  {
    id: 'growth-revenue',
    label: 'Growth — revenue by merchant',
    path: '/reports/growth/revenue-by-merchant',
    group: 'growth',
    permission: 'financial',
    supportsCsv: true,
    params: FINANCIAL_REPORT_PARAMS,
  },
  {
    id: 'growth-customers',
    label: 'Growth — customers',
    path: '/reports/growth/customers',
    group: 'growth',
    permission: 'console',
    supportsCsv: true,
    params: GROWTH_CUSTOMERS_PARAMS,
  },
  {
    id: 'transaction-anomalies',
    label: 'Transaction anomalies',
    path: '/compliance/transaction-anomalies',
    group: 'compliance',
    description:
      'Strict ticket-linked duplicates, broad same-amount/ms duplicates, and high-ticket transfers/deposits.',
    permission: 'financial',
    supportsCsv: true,
    params: ANOMALY_REPORT_PARAMS,
  },
]

const SCOPE_FILTER_KEYS = [
  'account_key',
  'identifier',
  'wallet_key',
  'currency_code',
  'status',
  'search',
]

export function reportById(id) {
  return REPORT_DEFINITIONS.find((r) => r.id === id) ?? REPORT_DEFINITIONS[0]
}

export function reportSupportsParam(report, param) {
  return Boolean(report?.params?.includes(param))
}

export function scopeFilterKeysForReport(report) {
  if (!report?.params?.length) return []
  return SCOPE_FILTER_KEYS.filter((key) => report.params.includes(key))
}

export function canExportReport(definition, { canFinancial, canConsole }) {
  if (!definition?.supportsCsv) return false
  if (definition.permission === 'financial') return canFinancial
  if (definition.permission === 'console') return canConsole
  return true
}

export function requiredPermissionLabel(definition) {
  if (definition.permission === 'financial') return PERMISSION_FINANCIAL_READ
  if (definition.permission === 'console') return PERMISSION_CONSOLE_READ
  return null
}

export function cleanReportParams(params) {
  const out = {}
  for (const [key, value] of Object.entries(params || {})) {
    if (value === '' || value === null || value === undefined) continue
    out[key] = value
  }
  return out
}

/** Normalize datetime-local or ISO date for API query strings. */
export function normalizeDateTimeParam(value) {
  if (value == null || String(value).trim() === '') return null
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return `${s}:00`
  return s
}

/**
 * Build query object using only params declared on the report definition.
 * @param {ReportDefinition} report
 * @param {Record<string, string>} form
 */
export function buildReportQuery(report, form) {
  const allowed = new Set(report?.params || [])
  const out = {}

  if (allowed.has('from_date')) {
    const v = normalizeDateTimeParam(form.from_date)
    if (v) out.from_date = v
  }
  if (allowed.has('to_date')) {
    const v = normalizeDateTimeParam(form.to_date)
    if (v) out.to_date = v
  }
  if (allowed.has('limit')) {
    const n = Number(form.limit)
    const limit = Number.isFinite(n)
      ? Math.min(MAX_REPORT_LIMIT, Math.max(1, n))
      : DEFAULT_REPORT_LIMIT
    out.limit = limit
  }
  if (allowed.has('scope')) {
    out.scope = form.scope === 'active' ? 'active' : 'all'
  }
  if (allowed.has('window_ms')) {
    out.window_ms = form.window_ms?.trim() ? form.window_ms.trim() : '1000'
  }
  if (allowed.has('min_amount')) {
    out.min_amount = form.min_amount?.trim() ? form.min_amount.trim() : '1000000'
  }

  for (const key of SCOPE_FILTER_KEYS) {
    if (!allowed.has(key)) continue
    const value = form[key]
    if (value != null && String(value).trim() !== '') {
      out[key] = String(value).trim()
    }
  }

  return out
}

export function unwrapReportPayload(payload) {
  const root = payload?.data != null && typeof payload.data === 'object' ? payload.data : payload
  if (Array.isArray(root)) {
    return { rows: root, summary: null }
  }
  if (root == null || typeof root !== 'object') {
    return { rows: [], summary: null }
  }
  const rows =
    root.rows ??
    root.records ??
    root.items ??
    (Array.isArray(root.data) ? root.data : [])
  return {
    rows: Array.isArray(rows) ? rows : [],
    summary: root.summary && typeof root.summary === 'object' ? root.summary : null,
  }
}

/** Column order for anomaly preview when present on rows. */
export function previewColumnsForReport(reportId, rows) {
  if (!rows?.length || typeof rows[0] !== 'object') return []
  const keys = Object.keys(rows[0])
  if (reportId !== 'transaction-anomalies') {
    return keys.slice(0, 14)
  }
  const priority = ['anomaly_type', 'ticket_match', 'identifier', 'amount', 'currency_code']
  const ordered = [
    ...priority.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !priority.includes(k)),
  ]
  return ordered.slice(0, 14)
}
