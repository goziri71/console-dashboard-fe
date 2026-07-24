import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  Bitcoin,
  Filter,
  Search,
  Shuffle,
} from 'lucide-react'
import { cn, formatBalance, formatDate } from '../../lib/utils'
import Pagination from '../../components/ui/Pagination'
import {
  getCryptoDeposits,
  getCryptoPayouts,
  getDepositTransactions,
  getNgnDeposits,
  getNgnPayouts,
  getSwapTransactions,
  getTransferTransactions,
  getWithdrawalTransactions,
} from '../../services/transactions'

const TX_PAGE_SIZE = 15

const TAB_ITEMS = [
  { key: 'deposits', label: 'Deposits', icon: ArrowDownCircle, fetcher: getDepositTransactions },
  { key: 'withdrawals', label: 'Withdrawals', icon: ArrowUpCircle, fetcher: getWithdrawalTransactions },
  { key: 'transfers', label: 'Transfers', icon: ArrowLeftRight, fetcher: getTransferTransactions },
  { key: 'swaps', label: 'Swaps', icon: Shuffle, fetcher: getSwapTransactions },
  { key: 'ngn-deposits', label: 'NGN deposits', icon: ArrowDownCircle, fetcher: getNgnDeposits },
  { key: 'ngn-payouts', label: 'NGN payouts', icon: ArrowUpCircle, fetcher: getNgnPayouts },
  { key: 'crypto-deposits', label: 'Crypto deposits', icon: Bitcoin, fetcher: getCryptoDeposits },
  { key: 'crypto-payouts', label: 'Crypto payouts', icon: Bitcoin, fetcher: getCryptoPayouts },
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
  return {
    total: inner.total ?? nested.total ?? nested.count,
    total_pages: inner.total_pages ?? inner.totalPages ?? nested.total_pages ?? nested.last_page,
  }
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

function txStatusKind(status) {
  const s = String(status || '')
    .toLowerCase()
    .trim()
  if (s.includes('fail') || s.includes('declin') || s.includes('error') || s.includes('revers')) {
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
  }
  return (
    <span
      className={cn(
        'inline-flex min-w-[74px] items-center justify-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium',
        styles[kind] || styles.processing
      )}
    >
      {label}
    </span>
  )
}

function mapTxRow(row, index, page, activeTab, financial) {
  const sn = (page - 1) * TX_PAGE_SIZE + index + 1
  const isSwap = activeTab === 'swaps'
  const sourceCurrency = String(pickFirst(row, ['source_currency_code']) || 'NGN').toUpperCase()
  const targetCurrency = String(pickFirst(row, ['target_currency_code']) || 'NGN').toUpperCase()
  const sourceAmountRaw = pickFirst(row, ['source_amount']) || 0
  const targetAmountRaw = pickFirst(row, ['target_amount']) || 0
  const currency = isSwap
    ? sourceCurrency
    : String(pickFirst(row, ['currency_code', 'currency', 'asset_code']) || 'NGN').toUpperCase()
  const amountRaw = isSwap
    ? sourceAmountRaw
    : pickFirst(row, ['amount', 'value', 'gross_amount', 'net_amount']) || 0
  const service =
    pickFirst(row, [
      'service',
      'narration',
      'description',
      'memo',
      'reference',
      'source_from_reference',
      'live_reference',
      'deposit_reference',
    ]) || '—'
  const dateRaw = pickFirst(row, ['date_created', 'created_at', 'timestamp', 'date_modified', 'date'])
  const statusRaw = pickFirst(row, [
    'status',
    'transaction_status',
    'credit_status',
    'payout_status',
    'swap_status',
  ])

  let amount = '—'
  if (financial) {
    amount = isSwap
      ? `${formatBalance(sourceAmountRaw, sourceCurrency)} → ${formatBalance(targetAmountRaw, targetCurrency)}`
      : amountRaw != null && amountRaw !== ''
        ? formatBalance(amountRaw, currency)
        : '—'
  }

  return {
    sn,
    service,
    amount,
    date: dateRaw ? formatDate(dateRaw) : '—',
    statusKind: txStatusKind(statusRaw),
  }
}

/**
 * Merchant-scoped money activity via /transactions/*?account_key=
 * Statement is intentionally omitted (customer-scoped only).
 */
export default function MerchantActivityPanel({ accountKey, financial }) {
  const [activeTab, setActiveTab] = useState('deposits')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const abortRef = useRef(null)

  const selectedTab = useMemo(
    () => TAB_ITEMS.find((t) => t.key === activeTab) || TAB_ITEMS[0],
    [activeTab]
  )

  const displayRows = useMemo(
    () => rows.map((row, idx) => mapTxRow(row, idx, page, activeTab, financial)),
    [rows, page, activeTab, financial]
  )

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [activeTab, statusFilter, currencyFilter, debouncedSearch, accountKey])

  const fetchTransactions = useCallback(async () => {
    if (!accountKey) {
      setRows([])
      setTotalPages(1)
      setTotal(0)
      setLoading(false)
      return
    }

    const params = {
      page,
      limit: TX_PAGE_SIZE,
      account_key: accountKey,
    }
    if (statusFilter) params.status = statusFilter
    if (currencyFilter) params.currency_code = currencyFilter
    if (debouncedSearch) params.search = debouncedSearch

    abortRef.current?.abort?.()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const res = await selectedTab.fetcher(params, controller.signal)
      const records = pickRecords(res)
      const pag = pickPagination(res)
      setRows(records)
      setTotalPages(inferTotalPages(res, TX_PAGE_SIZE, page))
      setTotal(Number(pag.total) || records.length)
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
      setError(err.response?.data?.message || 'Failed to load merchant activity.')
      setRows([])
      setTotalPages(1)
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [accountKey, page, statusFilter, currencyFilter, debouncedSearch, selectedTab])

  useEffect(() => {
    fetchTransactions()
    return () => abortRef.current?.abort?.()
  }, [fetchTransactions])

  return (
    <div className="overflow-hidden rounded-card border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-base font-medium text-text-primary">Merchant activity</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Money movement for this merchant via transaction list endpoints scoped by account key.
          Customer statements stay on the customer page.
        </p>
      </div>

      <div className="tab-scroll border-b border-border/60 px-3 py-3">
        {TAB_ITEMS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm transition-colors',
                active
                  ? 'bg-accent text-page'
                  : 'bg-card-hover text-text-secondary hover:text-text-primary'
              )}
            >
              <span>{tab.label}</span>
              <Icon size={16} />
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2 border-b border-border/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activity..."
            className="h-10 w-full rounded-xl border border-border bg-page pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
          />
        </div>
        <button type="button" onClick={() => setShowFilters((v) => !v)} className="filter-pill">
          <Filter size={14} />
          Filter
        </button>
      </div>

      {showFilters ? (
        <div className="flex flex-wrap gap-2 border-b border-border/40 px-3 py-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-page px-3 text-xs text-text-primary outline-none focus:border-accent/50"
          >
            <option value="">All status</option>
            <option value="SUCCESS">Success</option>
            <option value="SUCCESSFUL">Successful</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REVERSED">Reversed</option>
          </select>
          <input
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value.toUpperCase())}
            placeholder="Currency (e.g. NGN)"
            className="h-9 w-28 rounded-lg border border-border bg-page px-3 text-xs text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
          />
        </div>
      ) : null}

      {!financial ? (
        <p className="py-10 text-center text-sm text-text-muted">
          Amounts require <code className="text-text-secondary">financial.read</code>. Status and
          references still load when available.
        </p>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton h-9 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <p className="py-12 text-center text-sm text-error">{error}</p>
      ) : (
        <div className="p-3">
          <div className="table-scroll rounded-xl border border-border bg-page">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-card-hover text-xs text-text-muted">
                <tr>
                  <th className="px-3 py-3 font-medium">S/N</th>
                  <th className="px-3 py-3 font-medium">Reference / service</th>
                  <th className="px-3 py-3 font-medium">Amount</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length ? (
                  displayRows.map((row) => (
                    <tr key={`${row.sn}-${row.service}`} className="border-t border-border/60">
                      <td className="px-3 py-2.5 tabular-nums text-text-muted">{row.sn}</td>
                      <td className="max-w-[280px] px-3 py-2.5">
                        <span className="line-clamp-2 break-all text-xs uppercase text-accent">
                          {row.service}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-text-secondary">
                        {row.amount}
                      </td>
                      <td className="px-3 py-2.5">
                        {txStatusPill(row.statusKind.kind, row.statusKind.label)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-text-secondary">
                        {row.date}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center text-sm text-text-muted">
                      No activity found for this merchant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={TX_PAGE_SIZE}
            label="transactions"
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
