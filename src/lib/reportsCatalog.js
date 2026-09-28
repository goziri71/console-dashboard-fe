import { PERMISSION_CONSOLE_READ, PERMISSION_FINANCIAL_READ } from './permissions'

/** @typedef {'financial' | 'console' | 'none'} ReportPermission */

/**
 * @typedef {Object} ReportDefinition
 * @property {string} id
 * @property {string} label
 * @property {string} path
 * @property {'reports' | 'growth' | 'compliance'} group
 * @property {string} [description]
 * @property {ReportPermission} permission
 * @property {boolean} [hasSummary]
 * @property {string[]} [extraParams] — keys beyond common scope filters
 */

export const COMMON_SCOPE_PARAMS = [
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

export const REPORT_DEFINITIONS = [
  {
    id: 'settlements',
    label: 'Settlements',
    path: '/reports/settlements',
    group: 'reports',
    description: 'Settlement batches with summary totals in the response.',
    permission: 'financial',
    hasSummary: true,
  },
  {
    id: 'transactions',
    label: 'Unified transactions',
    path: '/reports/transactions',
    group: 'reports',
    permission: 'financial',
  },
  {
    id: 'deposits',
    label: 'Deposits',
    path: '/reports/deposits',
    group: 'reports',
    permission: 'financial',
  },
  {
    id: 'transfers',
    label: 'Transfers',
    path: '/reports/transfers',
    group: 'reports',
    permission: 'financial',
  },
  {
    id: 'customer-balances',
    label: 'Customer wallet balances',
    path: '/reports/customer-balances',
    group: 'reports',
    permission: 'financial',
  },
  {
    id: 'opening-closing',
    label: 'Opening / closing balances',
    path: '/reports/opening-closing-balances',
    group: 'reports',
    description: 'Per wallet in the selected date range.',
    permission: 'financial',
  },
  {
    id: 'balance-snapshot',
    label: 'Balance snapshot',
    path: '/reports/balance-snapshot',
    group: 'reports',
    permission: 'financial',
  },
  {
    id: 'vat',
    label: 'VAT totals by currency',
    path: '/reports/vat',
    group: 'reports',
    permission: 'financial',
  },
  {
    id: 'vendors',
    label: 'NGN payout vendors',
    path: '/reports/vendors',
    group: 'reports',
    permission: 'financial',
  },
  {
    id: 'revenue',
    label: 'Revenue (fees) by merchant',
    path: '/reports/revenue',
    group: 'reports',
    permission: 'financial',
  },
  {
    id: 'growth-revenue',
    label: 'Growth — revenue by merchant',
    path: '/reports/growth/revenue-by-merchant',
    group: 'growth',
    permission: 'financial',
  },
  {
    id: 'growth-customers',
    label: 'Growth — customers',
    path: '/reports/growth/customers',
    group: 'growth',
    permission: 'console',
    extraParams: ['scope'],
  },
  {
    id: 'transaction-anomalies',
    label: 'Transaction anomalies',
    path: '/compliance/transaction-anomalies',
    group: 'compliance',
    description: 'Duplicate same-amount transfers and high-ticket activity.',
    permission: 'financial',
    extraParams: ['window_ms', 'min_amount'],
  },
]

export function reportById(id) {
  return REPORT_DEFINITIONS.find((r) => r.id === id) ?? REPORT_DEFINITIONS[0]
}

export function canExportReport(definition, { canFinancial, canConsole }) {
  if (!definition) return false
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
