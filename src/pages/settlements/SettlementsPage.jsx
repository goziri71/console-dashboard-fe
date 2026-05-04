import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownCircle,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Copy,
  MoreVertical,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react'
import Pagination from '../../components/ui/Pagination'
import PageLoader from '../../components/ui/PageLoader'
import { cn, formatBalance } from '../../lib/utils'
import { getSettlementBatch, getSettlementBatches, getSettlementSummary } from '../../services/settlements'

const TABLE_LIMIT = 10
const DEFAULT_SETTLEMENT_TYPES = [
  'Partner Settlement',
  'Bank Settlement',
  'Internal Ledger Settlement',
  'Escrow Release',
]

function statusBadge(status) {
  if (status === 'completed') return 'bg-success-bg text-success'
  if (status === 'failed') return 'bg-error-bg text-error'
  if (status === 'processing') return 'bg-[#072a66] text-[#2970ff]'
  return 'bg-warning-bg text-warning'
}

function currency(value, currencyCode = 'NGN') {
  return formatBalance(Number(value || 0), currencyCode)
}

function formatDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB')
}

function normalizeSummary(payload) {
  const summary = payload?.data || payload || {}
  return {
    pending_total: Number(summary.pending_total || 0),
    processing_total: Number(summary.processing_total || 0),
    failed_total: Number(summary.failed_total || 0),
    settled_total: Number(summary.settled_total || 0),
  }
}

function normalizeBatches(payload) {
  const node = payload?.data || payload || {}
  const records = node.records || node.batches || node.data || []
  const pagination = node.pagination || {}
  const total = Number(pagination.total ?? node.total ?? records.length)
  const totalPages = Math.max(1, Number(pagination.total_pages || Math.ceil(total / TABLE_LIMIT) || 1))
  return { records, total, totalPages }
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

function pickFirst(obj, paths, fallback = '--') {
  for (const path of paths) {
    const value = getByPath(obj, path)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return `${date.toLocaleDateString('en-GB')} | ${date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })}`
}

function StatCard({ label, value, sub, icon: Icon, iconCls }) {
  return (
    <div className="rounded-card border border-border/70 bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', iconCls)}>
          <Icon size={16} />
        </div>
        <span>{label}</span>
      </div>
      <p className="text-[38px] font-semibold leading-[1.1] tracking-[0.32px] text-text-primary">{value}</p>
      <p className="mt-1 text-xs text-text-muted">{sub}</p>
    </div>
  )
}

export default function SettlementsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showFilter, setShowFilter] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [settlementType, setSettlementType] = useState('')
  const [showSettlementTypeMenu, setShowSettlementTypeMenu] = useState(false)
  const [currencyCode, setCurrencyCode] = useState('')
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false)
  const [currencySearch, setCurrencySearch] = useState('')
  const [statusFilters, setStatusFilters] = useState({
    completed: false,
    processing: false,
    pending: false,
    failed: false,
  })
  const [summary, setSummary] = useState({
    pending_total: 0,
    processing_total: 0,
    failed_total: 0,
    settled_total: 0,
  })
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [selectedBatchDetails, setSelectedBatchDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const settlementTypeRef = useRef(null)
  const currencyRef = useRef(null)

  const activeStatuses = useMemo(() => {
    return Object.entries(statusFilters)
      .filter(([, enabled]) => enabled)
      .map(([status]) => status)
  }, [statusFilters])

  useEffect(() => {
    let active = true
    getSettlementSummary()
      .then((res) => {
        if (!active) return
        setSummary(normalizeSummary(res))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const fetchBatches = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {
        page,
        limit: TABLE_LIMIT,
        search: search.trim(),
        status: activeStatuses.join(','),
        currency_code: currencyCode,
        from_date: fromDate,
        to_date: toDate,
      }
      if (settlementType) params.settlement_type = settlementType
      const res = await getSettlementBatches(params)
      const normalized = normalizeBatches(res)
      setRows(normalized.records)
      setTotal(normalized.total)
      setTotalPages(normalized.totalPages)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load settlement batches.')
      setRows([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [page, search, activeStatuses, currencyCode, fromDate, toDate, settlementType])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  useEffect(() => {
    setPage(1)
  }, [search, settlementType, currencyCode, fromDate, toDate, activeStatuses])

  useEffect(() => {
    if (!showSettlementTypeMenu) return
    const handleOutside = (event) => {
      if (!settlementTypeRef.current?.contains(event.target)) {
        setShowSettlementTypeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
    }
  }, [showSettlementTypeMenu])

  useEffect(() => {
    if (!showCurrencyMenu) return
    const handleOutside = (event) => {
      if (!currencyRef.current?.contains(event.target)) {
        setShowCurrencyMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
    }
  }, [showCurrencyMenu])

  useEffect(() => {
    if (!showFilter) {
      setShowSettlementTypeMenu(false)
      setShowCurrencyMenu(false)
    }
  }, [showFilter])

  const settlementTypeOptions = useMemo(() => {
    const dynamicTypes = rows.map((row) => row.settlement_type).filter(Boolean)
    return [...new Set([...DEFAULT_SETTLEMENT_TYPES, ...dynamicTypes])]
  }, [rows])

  const currencyOptions = useMemo(() => ['NGN', 'USD'], [])

  const filteredCurrencyOptions = useMemo(() => {
    const q = currencySearch.trim().toUpperCase()
    if (!q) return currencyOptions
    return currencyOptions.filter((code) => code.includes(q))
  }, [currencyOptions, currencySearch])

  const selectedNode = selectedBatchDetails || selectedBatch
  const selectedStatus = String(pickFirst(selectedNode, ['status'], 'pending')).toLowerCase()
  const selectedCurrency = pickFirst(selectedNode, ['currency_code'], 'NGN')
  const selectedAmount = pickFirst(selectedNode, ['net_payable', 'amount'], 0)
  const selectedCreated = pickFirst(selectedNode, ['date_created', 'created_at'], '')
  const referenceCode = pickFirst(selectedNode, ['batch_id', 'reference', 'external_reference_code'], '--')

  async function openBatchDetails(row) {
    setSelectedBatch(row)
    setSelectedBatchDetails(null)
    setDetailsLoading(true)
    try {
      const res = await getSettlementBatch(row.batch_id)
      setSelectedBatchDetails(res?.data || res)
    } catch {
      setSelectedBatchDetails(null)
    } finally {
      setDetailsLoading(false)
    }
  }

  function copyToClipboard(value) {
    if (!value || value === '--') return
    navigator.clipboard?.writeText(String(value)).catch(() => {})
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-text-primary">Settlements</h1>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">
            Manage payout obligations, process settlement batches, reconcile financial records, and monitor disbursement status across the Sterllo platform.
          </p>
        </div>
        <button className="inline-flex h-12 shrink-0 items-center gap-2 self-start rounded-full bg-accent px-5 text-sm font-medium text-black hover:bg-accent/90 sm:self-auto">
          <ArrowDownCircle size={16} />
          Export Settlement Report
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <StatCard
          label="Pending Settlements"
          value={currency(summary.pending_total)}
          sub="Total value awaiting approval"
          icon={ArrowUpDown}
          iconCls="bg-warning-bg text-warning"
        />
        <StatCard
          label="Processing Settlements"
          value={currency(summary.processing_total)}
          sub="Batches currently sent to bank or partner"
          icon={RefreshCw}
          iconCls="bg-[#072a66] text-[#2970ff]"
        />
        <StatCard
          label="Failed Settlements"
          value={currency(summary.failed_total)}
          sub="Total batches requiring intervention"
          icon={XCircle}
          iconCls="bg-error-bg text-error"
        />
        <StatCard
          label="Settled"
          value={currency(summary.settled_total)}
          sub="Total value successfully disbursed"
          icon={CheckCircle2}
          iconCls="bg-success-bg text-success"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-card border border-border/70 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/70 p-3 lg:flex-row lg:items-center">
          <h3 className="text-base text-text-primary lg:mr-auto">Settlement Batches</h3>
          <div className="relative min-w-0 w-full lg:w-[320px] lg:shrink-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by batch ID..."
              className="h-10 w-full rounded-xl border border-border bg-page pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/40"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button className="inline-flex h-10 items-center gap-2 rounded-full bg-[#494949] px-4 text-xs text-text-secondary">
            <ArrowUpDown size={14} />
            Sort By: Newest
            <ChevronDown size={14} />
          </button>
          <button
            onClick={() => setShowFilter(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#494949] px-4 text-xs text-text-secondary"
          >
            <SlidersHorizontal size={14} />
            Filter
          </button>
          </div>
        </div>

        <div className="overflow-x-auto p-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-card-hover text-text-muted">
                <th className="px-3 py-3 font-normal"> </th>
                <th className="px-3 py-3 font-normal">Batch ID</th>
                <th className="px-3 py-3 font-normal">Settlement Type</th>
                <th className="px-3 py-3 font-normal">Gross Amount</th>
                <th className="px-3 py-3 font-normal">Fees Deducted</th>
                <th className="px-3 py-3 font-normal">Net Payable</th>
                <th className="px-3 py-3 font-normal">Status</th>
                <th className="px-3 py-3 font-normal">Created Date</th>
                <th className="px-3 py-3 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-t border-border/60">
                  <td colSpan={9} className="px-4 py-2">
                    <PageLoader label="Loading settlements…" minHeight="min-h-[200px]" padding="py-10" />
                  </td>
                </tr>
              ) : error ? (
                <tr className="border-t border-border/60">
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-error">
                    {error}
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((row, idx) => (
                  <tr key={`${row.batch_id || idx}-${idx}`} className="border-t border-border/60">
                    <td className="px-3 py-2.5">
                      <div className="h-4 w-2.5 rounded-full bg-[#b7e07a]" />
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.batch_id || '--'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.settlement_type || '--'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{currency(row.gross_amount, row.currency_code)}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{currency(row.fees_deducted, row.currency_code)}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{currency(row.net_payable, row.currency_code)}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex rounded-full px-3 py-0.5 text-[11px] font-medium', statusBadge(row.status || 'pending'))}>
                        {(row.status || 'pending').replace(/^./, (ch) => ch.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{formatDate(row.date_created)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => openBatchDetails(row)}
                        className="rounded-md p-1 text-text-muted hover:bg-card-hover hover:text-text-secondary"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-border/60">
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-text-muted">
                    No settlement batches found.
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
          label="Batches"
          onPageChange={setPage}
        />
      </div>

      {showFilter && (
        <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm">
          <div className="absolute left-1/2 top-1/2 flex max-h-[calc(100vh-24px)] w-[384px] max-w-[calc(100%-24px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3.5">
              <h3 className="text-sm font-medium text-text-secondary">Filters</h3>
              <button
                onClick={() => setShowFilter(false)}
                className="rounded-md p-1 text-text-muted transition-colors hover:bg-card-hover hover:text-text-secondary"
              >
                <X size={13} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2.5">
                <label className="text-xs text-text-muted">
                  From
                  <div className="relative mt-1">
                    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type={fromDate ? 'date' : 'text'}
                      value={fromDate}
                      onFocus={(e) => { e.target.type = 'date' }}
                      onBlur={(e) => { if (!e.target.value) e.target.type = 'text' }}
                      placeholder="Select date"
                      onChange={(e) => setFromDate(e.target.value)}
                      className="h-11 w-full rounded-xl border border-border/60 bg-page px-3 pr-9 text-sm text-text-secondary outline-none placeholder:text-text-muted"
                    />
                  </div>
                </label>
                <label className="text-xs text-text-muted">
                  To
                  <div className="relative mt-1">
                    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type={toDate ? 'date' : 'text'}
                      value={toDate}
                      onFocus={(e) => { e.target.type = 'date' }}
                      onBlur={(e) => { if (!e.target.value) e.target.type = 'text' }}
                      placeholder="Select date"
                      onChange={(e) => setToDate(e.target.value)}
                      className="h-11 w-full rounded-xl border border-border/60 bg-page px-3 pr-9 text-sm text-text-secondary outline-none placeholder:text-text-muted"
                    />
                  </div>
                </label>
              </div>

              <label className="block text-xs text-text-muted">
                Settlement Type
                <div ref={settlementTypeRef} className="relative mt-1">
                  <button
                    type="button"
                    onClick={() => setShowSettlementTypeMenu((prev) => !prev)}
                    className="flex h-11 w-full items-center justify-between rounded-xl border border-border/60 bg-page px-3 text-left text-sm text-text-secondary"
                  >
                    <span className={cn(!settlementType && 'text-text-muted')}>
                      {settlementType || 'Select settlement type'}
                    </span>
                    <ChevronDown size={14} className={cn('text-text-muted transition-transform', showSettlementTypeMenu && 'rotate-180')} />
                  </button>
                  {showSettlementTypeMenu && (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-44 overflow-y-auto rounded-xl border border-border/60 bg-card p-1 shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setSettlementType('')
                          setShowSettlementTypeMenu(false)
                        }}
                        className={cn(
                          'w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-card-hover',
                          settlementType === '' ? 'bg-card-hover text-text-primary' : 'text-text-secondary'
                        )}
                      >
                        Select settlement type
                      </button>
                      {settlementTypeOptions.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setSettlementType(type)
                            setShowSettlementTypeMenu(false)
                          }}
                          className={cn(
                            'w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-card-hover',
                            settlementType === type ? 'bg-card-hover text-text-primary' : 'text-text-secondary'
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>

              <label className="block text-xs text-text-muted">
                Currency
                <div ref={currencyRef} className="relative mt-1">
                  <button
                    type="button"
                    onClick={() => setShowCurrencyMenu((prev) => !prev)}
                    className="flex h-11 w-full items-center justify-between rounded-xl border border-border/60 bg-page px-3 text-left text-sm text-text-secondary"
                  >
                    <span className={cn(!currencyCode && 'text-text-muted')}>
                      {currencyCode || 'Select currency'}
                    </span>
                    <ChevronDown size={14} className={cn('text-text-muted transition-transform', showCurrencyMenu && 'rotate-180')} />
                  </button>
                  {showCurrencyMenu && (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-xl border border-border/60 bg-card p-1 shadow-xl">
                      <div className="px-1 pb-1">
                        <input
                          value={currencySearch}
                          onChange={(e) => setCurrencySearch(e.target.value)}
                          placeholder="Search currency"
                          className="h-9 w-full rounded-lg border border-border/60 bg-page px-3 text-sm text-text-secondary outline-none placeholder:text-text-muted"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrencyCode('')
                          setShowCurrencyMenu(false)
                        }}
                        className={cn(
                          'w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-card-hover',
                          currencyCode === '' ? 'bg-card-hover text-text-primary' : 'text-text-secondary'
                        )}
                      >
                        Select currency
                      </button>
                      {filteredCurrencyOptions.map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => {
                            setCurrencyCode(code)
                            setShowCurrencyMenu(false)
                          }}
                          className={cn(
                            'w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-card-hover',
                            currencyCode === code ? 'bg-card-hover text-text-primary' : 'text-text-secondary'
                          )}
                        >
                          {code}
                        </button>
                      ))}
                      {filteredCurrencyOptions.length === 0 && (
                        <p className="px-3 py-2 text-sm text-text-muted">No currency found</p>
                      )}
                    </div>
                  )}
                </div>
              </label>

              <div className="grid grid-cols-2 gap-2 text-sm text-text-secondary">
                {[
                  ['completed', 'Completed'],
                  ['processing', 'Processing'],
                  ['pending', 'Pending'],
                  ['failed', 'Failed'],
                ].map(([key, label]) => (
                  <label key={key} className="inline-flex h-10 items-center gap-2 rounded-full border border-border/60 px-3">
                    <input
                      type="checkbox"
                      checked={statusFilters[key]}
                      onChange={(e) => setStatusFilters((prev) => ({ ...prev, [key]: e.target.checked }))}
                      className="h-4 w-4 rounded border-border bg-transparent"
                    />
                    <span className="text-[13px] font-normal text-text-muted">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 border-t border-border/50 p-4">
              <button
                onClick={() => {
                  setFromDate('')
                  setToDate('')
                  setSettlementType('')
                  setShowSettlementTypeMenu(false)
                  setCurrencyCode('')
                  setCurrencySearch('')
                  setShowCurrencyMenu(false)
                  setStatusFilters({ completed: false, processing: false, pending: false, failed: false })
                  setPage(1)
                }}
                className="h-10 flex-1 rounded-full border border-border/60 text-sm text-text-muted hover:bg-card-hover"
              >
                Clear Filters
              </button>
              <button
                onClick={() => { setPage(1); setShowFilter(false) }}
                className="h-10 flex-1 rounded-full bg-accent text-sm font-medium text-black shadow-[0_0_0_1px_rgba(187,212,47,0.45)] hover:bg-accent/90"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedBatch && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <aside className="absolute left-2 right-2 top-2 h-[calc(100%-16px)] w-auto max-w-none overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl sm:left-auto sm:right-4 sm:top-4 sm:h-[calc(100%-32px)] sm:w-full sm:max-w-[420px]">
            <div className="border-b border-border/60 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-[#0a0a0a]">
                  <span className="text-base leading-none">🧾</span>
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="truncate text-sm font-semibold text-text-primary">{pickFirst(selectedNode, ['batch_id'], '--')}</p>
                  <p className={cn(
                    'mt-0.5 text-[11px] font-medium uppercase tracking-wide',
                    selectedStatus.includes('completed') ? 'text-success' : selectedStatus.includes('failed') ? 'text-error' : 'text-warning'
                  )}>
                    {selectedStatus}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedBatch(null)
                    setSelectedBatchDetails(null)
                  }}
                  className="shrink-0 rounded-full p-1 text-text-muted hover:bg-card-hover"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="h-[calc(100%-72px)] overflow-y-auto p-4">
              <div className="mb-4 text-center">
                <p className="text-xs text-text-muted">Amount</p>
                <p className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-text-primary">{currency(selectedAmount, selectedCurrency)}</p>
                <p className="mt-1.5 text-xs text-text-muted">{formatDateTime(selectedCreated)}</p>
              </div>

              {detailsLoading ? (
                <PageLoader label="Loading batch details…" minHeight="min-h-[180px]" padding="py-8" />
              ) : (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80">
                    <div className="border-b border-border/70 px-4 py-2.5 text-sm font-semibold text-text-secondary">Batch Summary</div>
                    {[
                      ['Batch ID', referenceCode, true],
                      ['Settlement Type', pickFirst(selectedNode, ['settlement_type'], '--')],
                      ['Currency', pickFirst(selectedNode, ['currency_name', 'currency', 'currency_code'], selectedCurrency)],
                      ['Created At', formatDateTime(pickFirst(selectedNode, ['date_created', 'created_at'], ''))],
                      ['Approved At', formatDateTime(pickFirst(selectedNode, ['date_approved', 'approved_at'], ''))],
                      ['Charge', currency(pickFirst(selectedNode, ['charges', 'charge', 'fees_deducted'], 0), selectedCurrency)],
                      ['VAT', currency(pickFirst(selectedNode, ['vat', 'tax_amount'], 0), selectedCurrency)],
                    ].map(([label, value, allowCopy], idx) => (
                      <div key={label} className={cn('flex items-center gap-2 px-4 py-2', idx < 6 && 'border-b border-border/60')}>
                        <span className="min-w-0 flex-1 text-xs text-text-muted">{label}</span>
                        <span className="flex max-w-[55%] items-center justify-end gap-1.5 text-right text-xs text-text-primary">
                          <span className="truncate">{value}</span>
                          {allowCopy && (
                            <button type="button" onClick={() => copyToClipboard(value)} className="shrink-0 rounded-full border border-border/70 bg-[#313131] p-1">
                              <Copy size={12} className="text-accent" />
                            </button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80">
                    <div className="border-b border-border/70 px-4 py-2.5 text-sm font-semibold text-text-secondary">Financial Breakdown</div>
                    {[
                      ['Total Gross Amount', currency(pickFirst(selectedNode, ['gross_amount', 'total_gross_amount'], 0), selectedCurrency)],
                      ['Total Fees', currency(pickFirst(selectedNode, ['fees_deducted', 'total_fees'], 0), selectedCurrency)],
                      ['Tax', currency(pickFirst(selectedNode, ['tax', 'tax_amount', 'vat'], 0), selectedCurrency)],
                      ['Net Payable', currency(pickFirst(selectedNode, ['net_payable'], 0), selectedCurrency)],
                    ].map(([label, value], idx) => (
                      <div key={label} className={cn('flex items-center gap-2 px-4 py-2', idx < 3 && 'border-b border-border/60')}>
                        <span className="min-w-0 flex-1 text-xs text-text-muted">{label}</span>
                        <span className="max-w-[55%] truncate text-right text-xs text-text-primary">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80">
                    <div className="border-b border-border/70 px-4 py-2.5 text-sm font-semibold text-text-secondary">Destination Details</div>
                    {[
                      ['Partner / Merchant Name', pickFirst(selectedNode, ['partner_name', 'merchant_name', 'destination.partner_name'], '--')],
                      ['Bank Name', pickFirst(selectedNode, ['bank_name', 'destination.bank_name'], '--')],
                      ['Settlement Channel', pickFirst(selectedNode, ['settlement_channel', 'channel'], '--')],
                      ['External Reference Code', pickFirst(selectedNode, ['external_reference_code', 'reference'], '--')],
                    ].map(([label, value], idx) => (
                      <div key={label} className={cn('flex items-center gap-2 px-4 py-2', idx < 3 && 'border-b border-border/60')}>
                        <span className="min-w-0 flex-1 text-xs text-text-muted">{label}</span>
                        <span className="max-w-[55%] truncate text-right text-xs text-text-primary">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
