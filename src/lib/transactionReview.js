import { formatDate, formatBalance } from './utils'
export const REVIEW_TYPE_TO_SEGMENT = {
  ngn_deposit: 'ngn-deposits',
  ngn_payout: 'ngn-payouts',
  crypto_deposit: 'crypto-deposits',
  crypto_payout: 'crypto-payouts',
  deposit: 'deposits',
  withdrawal: 'withdrawals',
  transfer: 'transfers',
}

export const REVIEW_TYPE_TABS = [
  { value: '', label: 'All types' },
  { value: 'ngn-deposits', label: 'NGN Deposits' },
  { value: 'ngn-payouts', label: 'NGN Payouts' },
  { value: 'transfers', label: 'Transfers' },
  { value: 'deposits', label: 'Deposits' },
  { value: 'withdrawals', label: 'Payouts' },
  { value: 'crypto-deposits', label: 'Crypto Deposits' },
  { value: 'crypto-payouts', label: 'Crypto Payouts' },
]

const TYPE_LABELS = {
  ngn_deposit: 'NGN Deposit',
  ngn_payout: 'NGN Payout',
  crypto_deposit: 'Crypto Deposit',
  crypto_payout: 'Crypto Payout',
  deposit: 'Deposit',
  withdrawal: 'Payout',
  transfer: 'Transfer',
  'ngn-deposits': 'NGN Deposit',
  'ngn-payouts': 'NGN Payout',
  'crypto-deposits': 'Crypto Deposit',
  'crypto-payouts': 'Crypto Payout',
  deposits: 'Deposit',
  withdrawals: 'Payout',
  transfers: 'Transfer',
}

export function reviewUrlSegment(transactionType) {
  const raw = String(transactionType ?? '').trim()
  if (!raw) return ''
  if (raw.includes('-')) return raw
  return REVIEW_TYPE_TO_SEGMENT[raw] ?? raw.replace(/_/g, '-')
}

export function transactionTypeLabel(transactionType) {
  const raw = String(transactionType ?? '').trim()
  if (!raw) return '—'
  return TYPE_LABELS[raw] ?? raw.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function normalizeReviewStatus(status) {
  return String(status ?? '')
    .trim()
    .toUpperCase()
}

export function isPendingReviewRow(row) {
  if (!row || typeof row !== 'object') return false
  if (row.review_state != null && String(row.review_state).toLowerCase() === 'pending') return true
  const status = normalizeReviewStatus(row.status ?? row.credit_status ?? row.payout_status)
  return status === 'PENDING'
}

export function canReviewRowActions(row) {
  if (!isPendingReviewRow(row)) return false
  if (row.can_approve === false && row.can_cancel === false) return false
  return true
}

export function reviewStatusBadge(status) {
  const s = normalizeReviewStatus(status)
  if (s === 'PENDING') {
    return { label: 'Pending review', cls: 'bg-warning-bg text-warning' }
  }
  if (s === 'SUCCESSFUL' || s === 'SUCCESS') {
    return { label: 'Approved', cls: 'bg-success-bg text-success' }
  }
  if (s === 'FAILED' || s === 'FAIL') {
    return { label: 'Cancelled', cls: 'bg-error-bg text-error' }
  }
  if (s === 'REVERSED') {
    return { label: 'Reversed', cls: 'bg-card-hover text-text-muted' }
  }
  return { label: status || '—', cls: 'bg-card-hover text-text-muted' }
}

export function unwrapPendingReviewList(payload) {
  const root = payload?.data != null && typeof payload.data === 'object' ? payload.data : payload
  const records = root?.records ?? root?.data?.records ?? (Array.isArray(root) ? root : [])
  const pagination = root?.pagination ?? root?.meta ?? {}
  return {
    records: Array.isArray(records) ? records : [],
    pagination,
  }
}

export function unwrapPendingReviewSummary(payload) {
  const d = payload?.data != null && typeof payload.data === 'object' ? payload.data : payload ?? {}
  return {
    total_pending: Number(d.total_pending ?? 0),
    by_type: d.by_type && typeof d.by_type === 'object' ? d.by_type : {},
  }
}

export function pickRecord(row) {
  if (row?.record != null && typeof row.record === 'object') return row.record
  return row ?? {}
}

export function pickReference(row) {
  const rec = pickRecord(row)
  return (
    row?.reference ??
    rec.deposit_reference ??
    rec.reference ??
    rec.transaction_reference ??
    ''
  )
}

export function pickRowStatus(row) {
  const rec = pickRecord(row)
  return row?.status ?? rec.credit_status ?? rec.payout_status ?? rec.status ?? ''
}

export function detailFieldsForRow(row) {
  const rec = pickRecord(row)
  const type = String(row?.transaction_type ?? '').toLowerCase()
  const common = [
    ['Reference', pickReference(row)],
    ['Transaction type', transactionTypeLabel(row?.transaction_type)],
    ['Wallet key', row?.wallet_key ?? rec.wallet_key ?? '—'],
    [
      'Amount',
      (() => {
        const raw = row?.amount ?? rec.amount
        if (raw == null || raw === '') return '—'
        const n = Number(raw)
        return Number.isNaN(n) ? String(raw) : formatBalance(n, rec.currency_code || row?.currency_code || 'NGN')
      })(),
    ],
    ['Status', pickRowStatus(row)],
    ['Session ID', rec.session_id ?? '—'],
    [
      'Date created',
      (row?.date_created ?? rec.date_created)
        ? formatDate(row?.date_created ?? rec.date_created)
        : '—',
    ],
  ]

  if (type.includes('ngn') && type.includes('deposit')) {
    return [
      ...common,
      ['Deposit reference', rec.deposit_reference ?? '—'],
      ['Sender bank', rec.sender_bank_name ?? rec.sender_bank ?? '—'],
      ['Sender name', rec.sender_account_name ?? rec.sender_name ?? '—'],
      ['Sender account', rec.sender_account_number ?? '—'],
      ['Recipient account', rec.recipient_account_number ?? rec.account_number ?? '—'],
      ['Credit status', rec.credit_status ?? '—'],
      ['Opening balance', rec.opening_balance ?? '—'],
      ['Closing balance', rec.closing_balance ?? '—'],
    ]
  }

  return common
}
