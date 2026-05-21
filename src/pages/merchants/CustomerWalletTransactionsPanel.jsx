import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, BookOpenText, Filter, Send, Shuffle } from 'lucide-react'
import { cn, formatBalance, formatDate } from '../../lib/utils'
import {
  getCryptoPayouts,
  getNgnDeposits,
  getNgnPayouts,
  getStatementTransactions,
  getSwapTransactions,
} from '../../services/transactions'

const TX_PAGE_SIZE = 15
const CRYPTO_PAYOUT_CURRENCIES = new Set(['USDT', 'BTC', 'ETH', 'USDC', 'USD'])

const TAB_ITEMS = [
  { key: 'deposits', label: 'Deposits', icon: ArrowDownCircle, fetcher: getNgnDeposits },
  { key: 'withdrawals', label: 'Withdrawals', icon: ArrowUpCircle, fetcher: getNgnPayouts },
  { key: 'swaps', label: 'Swaps', icon: Shuffle, fetcher: getSwapTransactions },
  { key: 'payout', label: 'Payout', icon: Send, fetcher: null },
  { key: 'statement', label: 'Statement', icon: BookOpenText, fetcher: getStatementTransactions },
]

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

function pickRecords(res) {
  const inner = unwrapPayload(res) ?? res ?? {}
  if (Array.isArray(inner.records)) return inner.records
  if (Array.isArray(inner.transactions)) return inner.transactions
  if (Array.isArray(inner)) return inner
  return []
}

function pickPagination(res) {
  const inner = unwrapPayload(res) ?? res ?? {}
  const nested = inner.pagination ?? inner.meta?.pagination ?? inner.meta ?? {}
  const merged = {
    total: inner.total ?? nested.total ?? nested.count,
    total_pages: inner.total_pages ?? inner.totalPages ?? nested.total_pages ?? nested.last_page,
    last_page: inner.last_page ?? nested.last_page,
  }
  if ((merged.total_pages == null || merged.total_pages === '') && merged.last_page != null) {
    const lp = Number(merged.last_page)
    if (Number.isFinite(lp) && lp > 0) merged.total_pages = lp
  }
  return merged
}

function inferTotalPages(res, limit, currentPage) {
  const pag = pickPagination(res)
  const tp = Number(pag.total_pages)
  const total = Number(pag.total)
  if (Number.isFinite(tp) && tp > 0) return tp
  if (Number.isFinite(total) && total > 0) return Math.max(1, Math.ceil(total / limit))
  const rows = pickRecords(res)
  if (rows.length < limit) return Math.max(1, currentPage)
  return Math.max(currentPage + 1, 2)
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (v != null && v !== '') return v
  }
  return ''
}

function payoutRowDate(row) {
  const raw = pickFirst(row, ['date_created', 'created_at', 'timestamp', 'date_modified', 'date'])
  const t = raw ? new Date(raw).getTime() : 0
  return Number.isFinite(t) ? t : 0
}

async function fetchCustomerPayouts(params, signal) {
  const currency = String(params.currency_code || '')
    .trim()
    .toUpperCase()
  if (currency === 'NGN') return getNgnPayouts(params, signal)
  if (currency && CRYPTO_PAYOUT_CURRENCIES.has(currency)) return getCryptoPayouts(params, signal)

  const [ngnRes, cryptoRes] = await Promise.all([
    getNgnPayouts(params, signal),
    getCryptoPayouts(params, signal),
  ])
  const limit = Number(params.limit) || TX_PAGE_SIZE
  const page = Number(params.page) || 1
  const merged = [...pickRecords(ngnRes), ...pickRecords(cryptoRes)].sort(
    (a, b) => payoutRowDate(b) - payoutRowDate(a)
  )
  const start = (page - 1) * limit
  const pageRows = merged.slice(start, start + limit)
  const totalPages = Math.max(inferTotalPages(ngnRes, limit, page), inferTotalPages(cryptoRes, limit, page))
  return {
    records: pageRows,
    pagination: { total_pages: totalPages, total: merged.length },
  }
}

function txStatusKind(status) {
  const s = String(status || '')
    .toLowerCase()
    .trim()
  if (s.includes('fail') || s.includes('declin') || s.includes('error')) {
    return { kind: 'failed', label: status || 'Failed' }
  }
  if (s.includes('success') || s.includes('complete')) {
    return { kind: 'completed', label: status || 'Completed' }
  }
  if (s.includes('pend') || s.includes('process')) {
    return { kind: 'pending', label: status || 'Pending' }
  }
  return { kind: 'processing', label: status || 'Processing' }
}

function txStatusPill(kind, label) {
  const styles = {
    completed: 'border-[#0b5c39] bg-[#053321] text-[#17b26a]',
    pending: 'border-[#b45309] bg-[#f59e0b] text-[#271406]',
    failed: 'border-[#7f1d1d] bg-[#d98282] text-[#3f1111]',
    processing: 'border-[#1d4ed8]/40 bg-[#072a66] text-[#60a5fa]',
    inactive: 'border-border bg-card-hover text-text-muted',
  }
  return (
    <span
      className={cn(
        'inline-flex min-w-[74px] items-center justify-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium',
        styles[kind] || styles.inactive
      )}
    >
      {label}
    </span>
  )
}

function mapTxRow(row, index, page, activeTab) {
  const sn = (page - 1) * TX_PAGE_SIZE + index + 1
  const currency = String(pickFirst(row, ['currency_code', 'currency', 'asset_code']) || 'NGN').toUpperCase()
  const amountRaw = pickFirst(row, ['amount', 'value', 'gross_amount', 'net_amount']) || 0
  const balanceRaw =
    pickFirst(row, ['closing_balance', 'balance_after']) ||
    pickFirst(row, ['opening_balance', 'balance_before']) ||
    ''
  const service =
    activeTab === 'statement'
      ? pickFirst(row, [
          'transaction_type',
          'type',
          'service',
          'narration',
          'description',
          'memo',
          'reference',
        ])
      : pickFirst(row, ['service', 'narration', 'description', 'memo', 'reference']) ||
        pickFirst(row, ['live_reference', 'deposit_reference']) ||
        '—'
  const dateRaw = pickFirst(row, ['date_created', 'created_at', 'timestamp', 'date_modified', 'date'])
  const statusRaw =
    activeTab === 'deposits'
      ? pickFirst(row, ['credit_status', 'status', 'transaction_status'])
      : activeTab === 'withdrawals' || activeTab === 'payout'
        ? pickFirst(row, ['payout_status', 'status', 'transaction_status'])
        : activeTab === 'statement'
          ? pickFirst(row, [
              'status',
              'transaction_status',
              'credit_status',
              'payout_status',
              'debit_status',
            ])
          : pickFirst(row, ['status', 'transaction_status', 'swap_status'])

  let balanceDisplay = '—'
  if (balanceRaw !== '' && balanceRaw != null) {
    const formatted = formatBalance(balanceRaw, currency)
    balanceDisplay = formatted.startsWith('-') ? formatted : `+${formatted}`
  }

  return {
    sn,
    service,
    amount: amountRaw != null && amountRaw !== '' ? formatBalance(amountRaw, currency) : '—',
    balanceDisplay,
    date: dateRaw ? formatDate(dateRaw).split(' ')[0] : '—',
    statusKind: txStatusKind(statusRaw),
  }
}

/**
 * Customer-scoped deposits, withdrawals, swaps, payouts, and statement for the selected wallet.
 */
export default function CustomerWalletTransactionsPanel({
  customerIdentifier,
  merchantAccountKey,
  walletKey,
  financial,
}) {
  const [activeTab, setActiveTab] = useState('deposits')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState('')

  const abortRef = useRef(null)

  const selectedTab = useMemo(
    () => TAB_ITEMS.find((t) => t.key === activeTab) || TAB_ITEMS[0],
    [activeTab]
  )

  const displayRows = useMemo(
    () => rows.map((row, idx) => mapTxRow(row, idx, page, activeTab)),
    [rows, page, activeTab]
  )

  useEffect(() => {
    setPage(1)
    setActiveTab('deposits')
  }, [customerIdentifier, walletKey])

  useEffect(() => {
    setPage(1)
  }, [activeTab, statusFilter, currencyFilter])

  const fetchTransactions = useCallback(async () => {
    if (!financial || !customerIdentifier || !walletKey) {
      setRows([])
      setTotalPages(1)
      setLoading(false)
      setError(null)
      return
    }

    const params = {
      page,
      limit: TX_PAGE_SIZE,
      identifier: customerIdentifier,
      wallet_key: walletKey,
    }
    if (merchantAccountKey) params.account_key = merchantAccountKey
    if (statusFilter) params.status = statusFilter
    if (currencyFilter) params.currency_code = currencyFilter

    abortRef.current?.abort?.()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const res =
        activeTab === 'payout'
          ? await fetchCustomerPayouts(params, controller.signal)
          : await selectedTab.fetcher(params, controller.signal)
      const records = pickRecords(res)
      setRows(records)
      setTotalPages(inferTotalPages(res, TX_PAGE_SIZE, page))
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
      setError(err.response?.data?.message || 'Failed to load transactions.')
      setRows([])
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [
    financial,
    customerIdentifier,
    walletKey,
    merchantAccountKey,
    page,
    statusFilter,
    currencyFilter,
    selectedTab,
    activeTab,
  ])

  useEffect(() => {
    fetchTransactions()
    return () => abortRef.current?.abort?.()
  }, [fetchTransactions])

  if (!financial) {
    return (
      <p className="py-12 text-center text-sm text-text-muted">
        Wallet activity requires financial.read to view transaction amounts.
      </p>
    )
  }

  if (!walletKey) {
    return <p className="py-12 text-center text-sm text-text-muted">Select a wallet to view transactions.</p>
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 overflow-x-auto border-b border-border/60 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TAB_ITEMS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex h-12 min-w-[28%] shrink-0 items-center justify-center gap-2 border-r border-border/60 px-3 text-sm transition-colors last:border-r-0 sm:min-w-[22%] lg:min-w-0 lg:flex-1',
                active
                  ? 'border-b-2 border-b-accent bg-[#0b0d12] text-text-primary'
                  : 'text-text-secondary hover:bg-[#0b0d12]/60 hover:text-text-primary'
              )}
            >
              <span>{tab.label}</span>
              <Icon size={16} className={active ? 'text-accent' : undefined} />
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-2 border-b border-border/40 px-3 py-2">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-text-secondary hover:bg-card-hover hover:text-text-primary"
        >
          <Filter size={14} />
          Filter
        </button>
      </div>

      {showFilters ? (
        <div className="flex flex-wrap gap-2 border-b border-border/40 px-3 py-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-[#11141b] px-3 text-xs text-text-primary outline-none focus:border-accent/50"
          >
            <option value="">All status</option>
            <option value="SUCCESS">Success</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
          <input
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value.toUpperCase())}
            placeholder="Currency (e.g. NGN)"
            className="h-9 w-28 rounded-lg border border-border bg-[#11141b] px-3 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
          />
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[200px] flex-1 flex-col gap-2 p-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton h-9 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <p className="py-12 text-center text-sm text-error">{error}</p>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3 pt-2">
          <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain rounded-xl border border-border/60 bg-[#0b0d12] [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[min(100%,520px)] text-left text-sm sm:min-w-[600px]">
              <thead className="sticky top-0 z-10 bg-linear-to-b from-[#3a3d44] to-[#2d3037] shadow-sm">
                <tr className="text-xs font-medium text-[#c6cad1]">
                  <th className="whitespace-nowrap px-2 py-3 sm:px-3">S/N</th>
                  <th className="min-w-[140px] px-2 py-3 sm:min-w-[180px] sm:px-3">Service</th>
                  <th className="whitespace-nowrap px-2 py-3 sm:px-3">Amount</th>
                  <th className="whitespace-nowrap px-2 py-3 sm:px-3">Balance</th>
                  <th className="whitespace-nowrap px-2 py-3 sm:px-3">Status</th>
                  <th className="whitespace-nowrap px-2 py-3 sm:px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length ? (
                  displayRows.map((row) => (
                    <tr key={`${row.sn}-${row.service}`} className="border-t border-[#171b24] hover:bg-[#10141b]">
                      <td className="px-2 py-2.5 tabular-nums text-[#8c939f] sm:px-3">{row.sn}</td>
                      <td className="max-w-[min(220px,45vw)] px-2 py-2.5 text-[#c8e64a] sm:max-w-[260px] sm:px-3 xl:max-w-[320px]">
                        <span className="line-clamp-3 wrap-break-word text-[11px] font-medium uppercase leading-snug sm:line-clamp-2 sm:text-[12px] sm:leading-4">
                          {row.service}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-[#8e95a1] sm:px-3">
                        {row.amount}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-[#17b26a] sm:px-3">
                        {row.balanceDisplay}
                      </td>
                      <td className="px-2 py-2.5 sm:px-3">
                        {txStatusPill(row.statusKind.kind, row.statusKind.label)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-xs text-[#8e95a1] sm:px-3">
                        {row.date}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-border/50">
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-text-muted">
                      No transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-[#0b0d12] px-3 py-2 text-[10px] text-[#8e95a1]">
            <span className="min-w-0">
              Page {page} of {totalPages}
            </span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-full border border-border px-3 py-1 text-[10px] text-text-secondary hover:bg-card-hover disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full border border-border px-3 py-1 text-[10px] text-text-secondary hover:bg-card-hover disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}