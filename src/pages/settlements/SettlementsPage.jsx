import { useMemo, useState } from 'react'
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
import { cn, formatNumber } from '../../lib/utils'

const TABLE_LIMIT = 10

const MOCK_ROWS = [
  { id: 'FY-PLM8912KTB3245D', type: 'External Audit Review', gross: 150250, fees: 45.3, net: 150250, status: 'processing', date: '2024-10-03' },
  { id: 'XZ-MNB4567JKGH2189F', type: 'Quarterly Tax Assessment', gross: 500000, fees: 80.9, net: 500000, status: 'completed', date: '2024-10-04' },
  { id: 'QP-TRD998KJGH4561A', type: 'Year-End Financial Review', gross: 750500, fees: 90.25, net: 750500, status: 'pending', date: '2024-10-05' },
  { id: 'DL-OPQ1234TYX6780Q', type: 'Client Payment Reconciliation', gross: 200000, fees: 50, net: 200000, status: 'completed', date: '2024-10-06' },
  { id: 'AB-RFT2345GHIJ9087M', type: 'Budget Allocation Review', gross: 300000, fees: 75, net: 300000, status: 'completed', date: '2024-10-07' },
  { id: 'MN-VBX4567CDFG1234Z', type: 'Vendor Payment Verification', gross: 120000, fees: 25.5, net: 120000, status: 'failed', date: '2024-10-08' },
  { id: 'AB-RFT2345GHIJ9087N', type: 'Budget Allocation Review', gross: 300000, fees: 75, net: 300000, status: 'completed', date: '2024-10-07' },
  { id: 'AB-RFT2345GHIJ9087P', type: 'Budget Allocation Review', gross: 300000, fees: 75, net: 300000, status: 'completed', date: '2024-10-07' },
  { id: 'AB-RFT2345GHIJ9087Q', type: 'Budget Allocation Review', gross: 300000, fees: 75, net: 300000, status: 'completed', date: '2024-10-07' },
  { id: 'AB-RFT2345GHIJ9087R', type: 'Budget Allocation Review', gross: 300000, fees: 75, net: 300000, status: 'completed', date: '2024-10-07' },
  { id: 'AB-RFT2345GHIJ9087S', type: 'Budget Allocation Review', gross: 300000, fees: 75, net: 300000, status: 'completed', date: '2024-10-07' },
  { id: 'AB-RFT2345GHIJ9087T', type: 'Budget Allocation Review', gross: 300000, fees: 75, net: 300000, status: 'completed', date: '2024-10-07' },
]

function statusBadge(status) {
  if (status === 'completed') return 'bg-success-bg text-success'
  if (status === 'failed') return 'bg-error-bg text-error'
  if (status === 'processing') return 'bg-[#072a66] text-[#2970ff]'
  return 'bg-warning-bg text-warning'
}

function currency(value) {
  return `₦ ${formatNumber(Number(value || 0).toFixed(2))}`
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
  const [currencyCode, setCurrencyCode] = useState('')
  const [statusFilters, setStatusFilters] = useState({
    completed: false,
    processing: false,
    pending: false,
    failed: false,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return MOCK_ROWS.filter((row) => {
      const matchesSearch = !q || row.id.toLowerCase().includes(q) || row.type.toLowerCase().includes(q)
      const matchesType = !settlementType || row.type === settlementType
      const matchesCurrency = !currencyCode || currencyCode === 'NGN'
      const activeStatuses = Object.entries(statusFilters).filter(([, v]) => v).map(([k]) => k)
      const matchesStatus = activeStatuses.length === 0 || activeStatuses.includes(row.status)
      const afterFrom = !fromDate || row.date >= fromDate
      const beforeTo = !toDate || row.date <= toDate
      return matchesSearch && matchesType && matchesCurrency && matchesStatus && afterFrom && beforeTo
    })
  }, [search, settlementType, currencyCode, statusFilters, fromDate, toDate])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / TABLE_LIMIT))
  const start = (page - 1) * TABLE_LIMIT
  const rows = filtered.slice(start, start + TABLE_LIMIT)

  const stats = useMemo(() => {
    const processing = MOCK_ROWS.filter((x) => x.status === 'processing').reduce((sum, x) => sum + x.net, 0)
    const pending = MOCK_ROWS.filter((x) => x.status === 'pending').reduce((sum, x) => sum + x.net, 0)
    const failed = MOCK_ROWS.filter((x) => x.status === 'failed').reduce((sum, x) => sum + x.net, 0)
    const settled = MOCK_ROWS.filter((x) => x.status === 'completed').reduce((sum, x) => sum + x.net, 0)
    return { processing, pending, failed, settled }
  }, [])

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
          value={currency(stats.pending)}
          sub="Total value awaiting approval"
          icon={ArrowUpDown}
          iconCls="bg-warning-bg text-warning"
        />
        <StatCard
          label="Processing Settlements"
          value={currency(stats.processing)}
          sub="Batches currently sent to bank or partner"
          icon={RefreshCw}
          iconCls="bg-[#072a66] text-[#2970ff]"
        />
        <StatCard
          label="Failed Settlements"
          value={currency(stats.failed)}
          sub="Total batches requiring intervention"
          icon={XCircle}
          iconCls="bg-error-bg text-error"
        />
        <StatCard
          label="Settled"
          value={currency(stats.settled)}
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
              placeholder="Search wallets..."
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
              {rows.length > 0 ? (
                rows.map((row, idx) => (
                  <tr key={`${row.id}-${idx}`} className="border-t border-border/60">
                    <td className="px-3 py-2.5">
                      <div className="h-4 w-2.5 rounded-full bg-[#b7e07a]" />
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.id}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.type}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{currency(row.gross)}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{currency(row.fees)}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{currency(row.net)}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex rounded-full px-3 py-0.5 text-[11px] font-medium', statusBadge(row.status))}>
                        {row.status[0].toUpperCase() + row.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{row.date}</td>
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
                Settlement Type
                <select
                  value={settlementType}
                  onChange={(e) => setSettlementType(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-page px-3 text-sm text-text-secondary outline-none"
                >
                  <option value="">All Settlement Types</option>
                  {[...new Set(MOCK_ROWS.map((row) => row.type))].map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
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
                  setSettlementType('')
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
