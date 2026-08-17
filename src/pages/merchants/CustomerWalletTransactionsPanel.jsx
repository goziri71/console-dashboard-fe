import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, BookOpenText, Filter, Search, Send, Shuffle } from 'lucide-react'
import { cn, formatBalance, formatDate } from '../../lib/utils'
import Pagination from '../../components/ui/Pagination'
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
  { key: 'withdrawals', label: 'Payouts', icon: ArrowUpCircle, fetcher: getNgnPayouts },
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
  const vendorReference = pickFirst(row, ['vendor_reference']) || ''
  const typeHint = String(
    pickFirst(row, ['transaction_type', 'type', 'service']) || service || ''
  ).toLowerCase()
  const isPayoutRow =
    activeTab === 'withdrawals' ||
    activeTab === 'payout' ||
    typeHint.includes('payout') ||
    typeHint.includes('withdrawal')
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
    vendorReference: isPayoutRow ? vendorReference || '—' : '',
    showVendorReference: isPayoutRow || activeTab === 'statement',
    amount: isSwap
      ? `${formatBalance(sourceAmountRaw, sourceCurrency)} → ${formatBalance(targetAmountRaw, targetCurrency)}`
      : amountRaw != null && amountRaw !== ''
        ? formatBalance(amountRaw, currency)
        : '—',
    balanceDisplay,
    date: dateRaw ? formatDate(dateRaw) : '—',
    statusKind: txStatusKind(statusRaw),
  }
}

/**
 * Customer-scoped deposits, payouts, swaps, and statement for the selected wallet.
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
    () => rows.map((row, idx) => mapTxRow(row, idx, page, activeTab)),
    [rows, page, activeTab]
  )

  const showVendorReferenceColumn =
    activeTab === 'withdrawals' || activeTab === 'payout' || activeTab === 'statement'

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
    setActiveTab('deposits')
  }, [customerIdentifier, walletKey])

  useEffect(() => {
    setPage(1)
  }, [activeTab, statusFilter, currencyFilter, debouncedSearch])

  const fetchTransactions = useCallback(async () => {
    if (!financial || !customerIdentifier || !walletKey) {
      setRows([])
      setTotalPages(1)
      setTotal(0)
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
    if (debouncedSearch) params.search = debouncedSearch

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
      const pag = pickPagination(res)
      setRows(records)
      setTotalPages(inferTotalPages(res, TX_PAGE_SIZE, page))
      setTotal(Number(pag.total) || records.length)
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
      setError(err.response?.data?.message || 'Failed to load transactions.')
      setRows([])
      setTotalPages(1)
      setTotal(0)
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
    debouncedSearch,
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
      <div className="tab-scroll border-border/60 px-3">
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
              <Icon size={16} className={active ? 'text-page' : undefined} />
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-2 border-b border-border/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              showVendorReferenceColumn
                ? 'Search vendor reference…'
                : 'Search reference…'
            }
            className="h-10 w-full rounded-xl border border-border bg-[#11141b] pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="filter-pill"
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
          <div className="table-scroll min-h-0 flex-1 overflow-y-auto overscroll-x-contain rounded-xl border border-border bg-page">
            <table className="w-full min-w-[520px] text-left text-sm sm:min-w-[600px]">
              <thead className="sticky top-0 z-10 bg-card-hover">
                <tr className="text-xs font-medium text-text-muted">
                  <th className="whitespace-nowrap px-2 py-3 sm:px-3">S/N</th>
                  <th className="min-w-[140px] px-2 py-3 sm:min-w-[180px] sm:px-3">Service</th>
                  {showVendorReferenceColumn ? (
                    <th className="whitespace-nowrap px-2 py-3 sm:px-3">Vendor reference</th>
                  ) : null}
                  <th className="whitespace-nowrap px-2 py-3 sm:px-3">Amount</th>
                  <th className="whitespace-nowrap px-2 py-3 sm:px-3">Balance</th>
                  <th className="whitespace-nowrap px-2 py-3 sm:px-3">Status</th>
                  <th className="whitespace-nowrap px-2 py-3 sm:px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length ? (
                  displayRows.map((row) => (
                    <tr key={`${row.sn}-${row.service}`} className="border-t border-border/60 hover:bg-card-hover/30">
                      <td className="px-2 py-2.5 tabular-nums text-text-muted sm:px-3">{row.sn}</td>
                      <td className="max-w-[min(220px,45vw)] px-2 py-2.5 text-accent sm:max-w-[260px] sm:px-3 xl:max-w-[320px]">
                        <span className="line-clamp-3 wrap-break-word text-[11px] font-medium uppercase leading-snug sm:line-clamp-2 sm:text-[12px] sm:leading-4">
                          {row.service}
                        </span>
                      </td>
                      {showVendorReferenceColumn ? (
                        <td
                          className="max-w-[140px] truncate px-2 py-2.5 font-mono text-[11px] text-text-secondary sm:px-3"
                          title={row.vendorReference || undefined}
                        >
                          {row.showVendorReference ? row.vendorReference || '—' : '—'}
                        </td>
                      ) : null}
                      <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-text-secondary sm:px-3">
                        {row.amount}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-success sm:px-3">
                        {row.balanceDisplay}
                      </td>
                      <td className="px-2 py-2.5 sm:px-3">
                        {txStatusPill(row.statusKind.kind, row.statusKind.label)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-xs text-text-secondary sm:px-3">
                        {row.date}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-border/50">
                    <td
                      colSpan={showVendorReferenceColumn ? 7 : 6}
                      className="px-3 py-10 text-center text-sm text-text-muted"
                    >
                      No transactions found.
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