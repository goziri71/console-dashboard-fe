import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownCircle,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  MoreVertical,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react'
import Pagination from '../../components/ui/Pagination'
import { cn, formatBalance } from '../../lib/utils'
import { getSettlementBatches, getSettlementSummary } from '../../services/settlements'

const TABLE_LIMIT = 10

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
  const [accountKey, setAccountKey] = useState('')
  const [currencyCode, setCurrencyCode] = useState('')
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
        account_key: accountKey.trim(),
        currency_code: currencyCode,
        from_date: fromDate,
        to_date: toDate,
      }
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
  }, [page, search, activeStatuses, accountKey, currencyCode, fromDate, toDate])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  useEffect(() => {
    setPage(1)
  }, [search, accountKey, currencyCode, fromDate, toDate, activeStatuses])

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Settlements</h1>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">
            Manage payout obligations, process settlement batches, reconcile financial records, and monitor disbursement status across the Sterllo platform.
          </p>
        </div>
        <button className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-black hover:bg-accent/90">
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
        <div className="flex items-center gap-3 border-b border-border/70 p-3">
          <h3 className="mr-auto text-base text-text-primary">Settlement Batches</h3>
          <div className="relative w-[320px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by batch ID..."
              className="h-10 w-full rounded-xl border border-border bg-page pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/40"
            />
          </div>
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
                [...Array(TABLE_LIMIT)].map((_, idx) => (
                  <tr key={idx} className="border-t border-border/60">
                    <td colSpan={9} className="px-4 py-2.5">
                      <div className="h-8 w-full animate-pulse rounded-md bg-card-hover" />
                    </td>
                  </tr>
                ))
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
                      <button className="rounded-md p-1 text-text-muted hover:bg-card-hover hover:text-text-secondary">
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
          <div className="absolute left-1/2 top-1/2 w-[380px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-4">
              <h3 className="text-base text-text-primary">Filters</h3>
              <button
                onClick={() => setShowFilter(false)}
                className="rounded-md p-1 text-text-muted transition-colors hover:bg-card-hover hover:text-text-secondary"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-text-muted">
                  From Date
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-page px-3 text-sm text-text-secondary outline-none"
                  />
                </label>
                <label className="text-xs text-text-muted">
                  To Date
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-page px-3 text-sm text-text-secondary outline-none"
                  />
                </label>
              </div>

              <label className="block text-xs text-text-muted">
                Account Key
                <input
                  type="text"
                  value={accountKey}
                  onChange={(e) => setAccountKey(e.target.value)}
                  placeholder="Filter by account key..."
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-page px-3 text-sm text-text-secondary outline-none"
                />
              </label>

              <label className="block text-xs text-text-muted">
                Currency
                <select
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-page px-3 text-sm text-text-secondary outline-none"
                >
                  <option value="">All Currencies</option>
                  <option value="NGN">NGN</option>
                </select>
              </label>

              <div>
                <p className="mb-2 text-xs text-text-muted">Status</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-text-secondary">
                  {[
                    ['completed', 'Completed'],
                    ['processing', 'Processing'],
                    ['pending', 'Pending'],
                    ['failed', 'Failed'],
                  ].map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={statusFilters[key]}
                        onChange={(e) => setStatusFilters((prev) => ({ ...prev, [key]: e.target.checked }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-border/70 p-4">
              <button
                onClick={() => {
                  setFromDate('')
                  setToDate('')
                  setAccountKey('')
                  setCurrencyCode('')
                  setStatusFilters({ completed: false, processing: false, pending: false, failed: false })
                  setPage(1)
                }}
                className="h-11 flex-1 rounded-xl border border-border text-sm text-text-secondary hover:bg-card-hover"
              >
                Clear All
              </button>
              <button
                onClick={() => { setPage(1); setShowFilter(false) }}
                className="h-11 flex-1 rounded-xl bg-accent text-sm font-medium text-black hover:bg-accent/90"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
