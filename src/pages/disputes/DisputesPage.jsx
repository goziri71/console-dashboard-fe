import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  Loader2,
  MoreVertical,
  ScanLine,
  Search,
  Upload,
  X,
  XCircle,
} from 'lucide-react'
import Pagination from '../../components/ui/Pagination'
import {
  cn,
  countryCodeToFlag,
  exportToCsv,
  formatBalance,
  formatNaira,
  formatNumber,
} from '../../lib/utils'
import {
  getDispute,
  getDisputes,
  getDisputesSummary,
  patchDispute,
} from '../../services/disputes'

const LIMIT = 20

const SORT_PRESETS = [
  { sort_by: 'date_created', order: 'desc', label: 'Newest' },
  { sort_by: 'date_created', order: 'asc', label: 'Oldest' },
  { sort_by: 'date_modified', order: 'desc', label: 'Recently updated' },
  { sort_by: 'status', order: 'asc', label: 'Status (A–Z)' },
  { sort_by: 'status', order: 'desc', label: 'Status (Z–A)' },
  { sort_by: 'settlement_status', order: 'asc', label: 'Settlement (A–Z)' },
  { sort_by: 'settlement_status', order: 'desc', label: 'Settlement (Z–A)' },
]

const FIGMA_BODY =
  'Resolve transaction issues quickly with Sterllo’s transparent dispute management system, designed to protect both businesses and customers while ensuring fair and efficient resolutions.'

function normalizeSummary(payload) {
  const d = payload?.data ?? payload ?? {}
  return {
    total: Number(d.total ?? 0),
    in_review: Number(d.in_review ?? 0),
    escalated: Number(d.escalated ?? 0),
    resolved: Number(d.resolved ?? 0),
    total_amount: d.total_amount != null ? Number(d.total_amount) : null,
    in_review_amount: d.in_review_amount != null ? Number(d.in_review_amount) : null,
    escalated_amount: d.escalated_amount != null ? Number(d.escalated_amount) : null,
    resolved_amount: d.resolved_amount != null ? Number(d.resolved_amount) : null,
  }
}

function disputeRef(row) {
  return row?.dispute_reference ?? row?.dispute_id ?? row?.reference ?? ''
}

function formatDateRaised(value) {
  if (!value) return '--'
  const raw = String(value).trim()
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function customerAccountCell(row) {
  const name = row.customer_name?.trim()
  const ref = row.customer_reference?.trim()
  if (name && ref) return `${name} / ${ref}`
  return name || ref || '--'
}

function formatDisputeAmount(row) {
  const code = (row.currency_code || 'NGN').toUpperCase()
  const n = Number(row.amount ?? 0)
  if (Number.isNaN(n)) return '--'
  if (code === 'NGN') return formatNaira(n)
  return formatBalance(n, code).replace(/\s+/g, '')
}

function disputeStatusPill(status) {
  const s = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')

  if (s === 'resolved' || s === 'closed') {
    return {
      wrap: 'border border-[#074d31] bg-[#053321]',
      text: 'text-[12px] font-medium leading-[19.2px] tracking-[0.48px] text-[#17b26a]',
      label: status || 'Resolved',
    }
  }
  if (s === 'open' || s === 'pending') {
    return {
      wrap: 'border border-[#00359e] bg-[#002266]',
      text: 'text-[12px] font-medium leading-[19.2px] tracking-[0.48px] text-[#2970ff]',
      label: status || 'Open',
    }
  }
  if (s === 'in_review' || s === 'review' || s === 'under_review') {
    return {
      wrap: 'border border-[#7a2e0e] bg-[#f79009]',
      text: 'text-[12px] font-medium leading-[19.2px] tracking-[0.48px] text-[#4e1d09]',
      label: 'In Review',
    }
  }
  if (s === 'escalated') {
    return {
      wrap: 'border border-[#d92d20] bg-[rgba(253,162,155,0.67)]',
      text: 'text-[12px] font-medium leading-[19.2px] tracking-[0.48px] text-[#55160c]',
      label: 'Escalated',
    }
  }
  return {
    wrap: 'border border-[#494949] bg-[#313131]',
    text: 'text-[12px] font-medium leading-[19.2px] tracking-[0.48px] text-[#a2a2a2]',
    label: status || '--',
  }
}

function FlagAvatar({ countryCode }) {
  const flag = countryCodeToFlag(countryCode || 'NGA')
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0a0a0a] text-[14px] leading-none"
      aria-hidden
    >
      {flag || '🇳🇬'}
    </span>
  )
}

function MetricCard({ label, value, sub, icon: Icon, iconWrapClass }) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-[24px] bg-[#181818] p-4">
      <div className="flex w-full items-center gap-2">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-[24px] border p-2',
            iconWrapClass
          )}
        >
          <Icon size={20} strokeWidth={1.5} className="text-white" />
        </div>
        <p className="min-w-0 flex-1 text-[14px] font-normal leading-[22.4px] tracking-[-0.28px] text-[#a2a2a2]">
          {label}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <p className="text-[32px] font-semibold leading-[38.4px] tracking-[0.32px] text-[#c0c0c0]">{value}</p>
        <p className="text-[12px] font-normal leading-4 text-[#494949]">{sub}</p>
      </div>
    </div>
  )
}

export default function DisputesPage() {
  const [summary, setSummary] = useState({
    total: 0,
    in_review: 0,
    escalated: 0,
    resolved: 0,
    total_amount: null,
    in_review_amount: null,
    escalated_amount: null,
    resolved_amount: null,
  })
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState('date_created')
  const [order, setOrder] = useState('desc')

  const [status, setStatus] = useState('')
  const [settlementStatus, setSettlementStatus] = useState('')
  const [accountKey, setAccountKey] = useState('')
  const [userKey, setUserKey] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  const [showFilter, setShowFilter] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortRef = useRef(null)

  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [patchStatus, setPatchStatus] = useState('')
  const [patchSettlementStatus, setPatchSettlementStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [patchError, setPatchError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!showSortMenu) return
    const onDown = (e) => {
      if (!sortRef.current?.contains(e.target)) setShowSortMenu(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showSortMenu])

  const filterParams = useMemo(() => {
    const p = {}
    if (debouncedSearch) p.search = debouncedSearch
    if (status) p.status = status
    if (settlementStatus) p.settlement_status = settlementStatus
    if (accountKey.trim()) p.account_key = accountKey.trim()
    if (userKey.trim()) p.user_key = userKey.trim()
    if (fromDate) p.from_date = fromDate
    if (toDate) p.to_date = toDate
    return p
  }, [debouncedSearch, status, settlementStatus, accountKey, userKey, fromDate, toDate])

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const res = await getDisputesSummary(filterParams)
      setSummary(normalizeSummary(res))
    } catch {
      setSummary({
        total: 0,
        in_review: 0,
        escalated: 0,
        resolved: 0,
        total_amount: null,
        in_review_amount: null,
        escalated_amount: null,
        resolved_amount: null,
      })
    } finally {
      setSummaryLoading(false)
    }
  }, [filterParams])

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        page,
        limit: LIMIT,
        sort_by: sortBy,
        order,
        ...filterParams,
      }
      const res = await getDisputes(params)
      const records = res.records ?? res.data?.records ?? []
      const pag = res.pagination ?? {}
      setRows(Array.isArray(records) ? records : [])
      setTotal(Number(pag.total ?? records.length ?? 0))
      setTotalPages(Math.max(1, Number(pag.total_pages || Math.ceil((pag.total || records.length) / LIMIT) || 1)))
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load disputes.')
      setRows([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [page, sortBy, order, filterParams])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    setPage(1)
  }, [filterParams, sortBy, order])

  const sortMenuLabel = useMemo(() => {
    const hit = SORT_PRESETS.find((p) => p.sort_by === sortBy && p.order === order)
    return hit?.label ?? 'Custom'
  }, [sortBy, order])

  function metricDisplay(amount, count) {
    if (amount != null && !Number.isNaN(amount)) return formatNaira(amount)
    return formatNumber(count)
  }

  function handleExportReport() {
    if (!rows.length) return
    const flat = rows.map((r) => ({
      dispute_id: r.dispute_id ?? disputeRef(r),
      customer: customerAccountCell(r),
      dispute_type: r.dispute_type ?? '',
      amount: r.amount ?? '',
      currency: r.currency_code ?? '',
      assigned_to: r.assigned_to ?? '',
      status: r.status ?? '',
      settlement_status: r.settlement_status ?? '',
      date_raised: formatDateRaised(r.transaction_date),
    }))
    exportToCsv(flat, `disputes-page-${page}.csv`)
  }

  async function openDetail(row) {
    const ref = disputeRef(row)
    if (!ref) return
    setSelected(row)
    setDetail(null)
    setPatchError('')
    setPatchStatus(row.status || '')
    setPatchSettlementStatus(row.settlement_status || '')
    setDetailLoading(true)
    try {
      const res = await getDispute(ref)
      const data = res.data ?? res
      setDetail(data)
      setPatchStatus(data.status ?? row.status ?? '')
      setPatchSettlementStatus(data.settlement_status ?? row.settlement_status ?? '')
    } catch {
      setDetail(row)
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleSavePatch() {
    const ref = disputeRef(detail || selected)
    if (!ref) return
    setSaving(true)
    setPatchError('')
    try {
      const payload = {}
      if (patchStatus !== '') payload.status = patchStatus
      if (patchSettlementStatus !== '') payload.settlement_status = patchSettlementStatus
      await patchDispute(ref, payload)
      await fetchList()
      await fetchSummary()
      const res = await getDispute(ref)
      setDetail(res.data ?? res)
    } catch (err) {
      setPatchError(err.response?.data?.message || 'Failed to update dispute.')
    } finally {
      setSaving(false)
    }
  }

  const d = detail || selected

  const cellCls =
    'border-r border-[#0a0a0a] px-4 py-2 text-[14px] font-normal leading-[22.4px] tracking-[-0.28px] text-[#a2a2a2]'
  const headCls =
    'border-r border-[#0a0a0a] bg-[#313131] px-4 py-3 text-left text-[14px] font-normal leading-[22.4px] tracking-[-0.28px] text-[#a2a2a2]'

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-2xl font-semibold leading-[28.8px] tracking-[0.24px] text-[#f7f7f7]">
            Disputes
          </h1>
          <p className="text-base font-normal leading-[25.6px] tracking-[0.024px] text-[#a2a2a2]">{FIGMA_BODY}</p>
        </div>
        <button
          type="button"
          onClick={handleExportReport}
          disabled={!rows.length}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full bg-accent px-5 py-4 text-[14px] leading-[16.8px] tracking-[0.14px] text-[#121505] hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40 sm:self-auto"
        >
          <Upload size={16} strokeWidth={2} className="shrink-0" />
          Export Dispute Report
        </button>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[160px] skeleton rounded-[24px]" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6 xl:flex-row">
          <MetricCard
            label="Total Disputes"
            value={metricDisplay(summary.total_amount, summary.total)}
            sub="Total disputed payments in your account."
            icon={AlertTriangle}
            iconWrapClass="border-[#b54708] bg-[#93370d]"
          />
          <MetricCard
            label="In Review Disputes"
            value={metricDisplay(summary.in_review_amount, summary.in_review)}
            sub="Disputes awaiting resolution"
            icon={ScanLine}
            iconWrapClass="border-[#155eef] bg-[#0040c1]"
          />
          <MetricCard
            label="Escalated Disputes"
            value={metricDisplay(summary.escalated_amount, summary.escalated)}
            sub="Advanced investigation required"
            icon={XCircle}
            iconWrapClass="border-[#912018] bg-[#d92d20]"
          />
          <MetricCard
            label="Resolved Disputes"
            value={metricDisplay(summary.resolved_amount, summary.resolved)}
            sub="Completed dispute cases"
            icon={CheckCircle2}
            iconWrapClass="border-[#067647] bg-[#085d3a]"
          />
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-[24px] bg-[#181818]">
        <div className="flex flex-col gap-4 border-b border-[#313131] p-4 lg:flex-row lg:items-center lg:gap-6">
          <p className="shrink-0 text-base font-normal leading-[25.6px] tracking-[0.024px] text-[#f7f7f7]">
            Disputes
          </p>
          <div className="min-w-0 flex-1">
            <div className="flex h-[43px] items-center gap-2 rounded-xl border border-[#717171] bg-[#181818] px-4">
              <Search size={20} className="shrink-0 text-[#494949]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search wallets..."
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] leading-[22.4px] tracking-[-0.28px] text-[#f7f7f7] outline-none placeholder:text-[#494949]"
              />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-4">
            <div className="relative" ref={sortRef}>
              <button
                type="button"
                onClick={() => setShowSortMenu((v) => !v)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#494949] px-5 py-3 text-[12px] font-semibold leading-[14.4px] tracking-[0.12px] text-[#a2a2a2]"
              >
                <span className="font-normal text-[#a2a2a2]">Sort By:</span>
                <span>{sortMenuLabel}</span>
                <ChevronDown size={16} className="text-[#a2a2a2]" />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 z-30 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-[#313131] bg-[#121212] py-1 shadow-xl">
                  {SORT_PRESETS.map((p) => (
                    <button
                      key={`${p.sort_by}-${p.order}`}
                      type="button"
                      onClick={() => {
                        setSortBy(p.sort_by)
                        setOrder(p.order)
                        setShowSortMenu(false)
                      }}
                      className={cn(
                        'flex w-full px-4 py-2.5 text-left text-[13px] text-[#c0c0c0] hover:bg-[#1e1e1e]',
                        sortBy === p.sort_by && order === p.order && 'bg-[#252525] text-[#f7f7f7]'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilter(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#494949] px-5 py-3 text-[12px] font-semibold leading-[14.4px] tracking-[0.12px] text-[#a2a2a2]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-current">
                <path
                  d="M4 6h16M7 12h10M10 18h4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Filter
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-error">{error}</div>
        ) : (
          <div className="p-2">
            <div className="overflow-x-auto rounded-2xl border border-[#0a0a0a]">
              <table className="w-full min-w-[1100px] border-collapse text-left">
                <thead>
                  <tr>
                    <th className={cn(headCls, 'w-14')} aria-hidden>
                      <span className="sr-only">Region</span>
                    </th>
                    <th className={cn(headCls, 'min-w-[160px]')}>Dispute ID</th>
                    <th className={cn(headCls, 'min-w-[200px]')}>Customer Name / Account</th>
                    <th className={cn(headCls, 'w-[144px]')}>Dispute Type</th>
                    <th className={cn(headCls, 'w-[124px]')}>Amount</th>
                    <th className={cn(headCls, 'w-[124px]')}>Assigned To</th>
                    <th className={cn(headCls, 'w-[112px]')}>Status</th>
                    <th className={cn(headCls, 'w-[112px]')}>Date Raised</th>
                    <th className="bg-[#313131] px-4 py-3 text-left text-[14px] font-normal leading-[22.4px] tracking-[-0.28px] text-[#a2a2a2] w-[80px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length > 0 ? (
                    rows.map((row, idx) => {
                      const pill = disputeStatusPill(row.status)
                      return (
                        <tr
                          key={disputeRef(row) || idx}
                          className="cursor-pointer border-b border-[#0a0a0a] bg-[#181818] hover:bg-[#1c1c1c]"
                          onClick={() => openDetail(row)}
                        >
                          <td className={cn(cellCls, 'w-14')}>
                            <FlagAvatar countryCode={row.country_code} />
                          </td>
                          <td className={cn(cellCls, 'min-w-0 max-w-[220px]')}>
                            <span className="block truncate">{row.dispute_id ?? disputeRef(row) ?? '--'}</span>
                          </td>
                          <td className={cn(cellCls, 'min-w-0 max-w-[260px]')}>
                            <span className="block truncate">{customerAccountCell(row)}</span>
                          </td>
                          <td className={cn(cellCls, 'w-[144px]')}>
                            <span className="block truncate">{row.dispute_type ?? '--'}</span>
                          </td>
                          <td className={cn(cellCls, 'w-[124px] whitespace-nowrap')}>
                            {formatDisputeAmount(row)}
                          </td>
                          <td className={cn(cellCls, 'w-[124px]')}>
                            <span className="block truncate">{row.assigned_to ?? '--'}</span>
                          </td>
                          <td className={cn(cellCls, 'w-[112px]')}>
                            <div className={cn('inline-flex w-full justify-center rounded-full px-3 py-0.5', pill.wrap)}>
                              <span className={cn('truncate', pill.text)}>{pill.label}</span>
                            </div>
                          </td>
                          <td className={cn(cellCls, 'w-[112px] whitespace-nowrap')}>
                            {formatDateRaised(row.transaction_date)}
                          </td>
                          <td
                            className="px-4 py-2 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => openDetail(row)}
                              className="inline-flex rounded-md p-1 text-[#717171] hover:bg-[#252525] hover:text-[#a2a2a2]"
                              aria-label="Row actions"
                            >
                              <MoreVertical size={20} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr className="border-b border-[#0a0a0a]">
                      <td colSpan={9} className="px-4 py-10 text-center text-[14px] text-[#494949]">
                        No disputes found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          label="disputes"
          limit={LIMIT}
          variant="figma"
          onPageChange={setPage}
        />
      </div>

      {showFilter && (
        <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm">
          <div className="absolute left-1/2 top-1/2 flex w-[380px] max-w-[calc(100%-24px)] max-h-[calc(100vh-24px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[16px] border border-[#313131] bg-[#181818] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#313131] px-4 py-4">
              <h3 className="text-[18px] font-semibold leading-[25.2px] tracking-[0.18px] text-[#c0c0c0]">Filters</h3>
              <button
                type="button"
                onClick={() => setShowFilter(false)}
                className="rounded-md p-1 text-[#a2a2a2] hover:bg-[#252525]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#494949]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by customers name, dispute ID...."
                  className="h-[43px] w-full rounded-xl border border-[#313131] bg-[#181818] pl-9 pr-3 text-[13px] text-[#a2a2a2] outline-none placeholder:text-[#494949]"
                />
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[14px] leading-[20px] text-[#8b8f97]">Status</span>
                <div className="relative">
                  <input
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    placeholder="Select status"
                    className="h-[43px] w-full rounded-xl border border-[#313131] bg-[#181818] px-3 pr-9 text-[13px] text-[#a2a2a2] outline-none placeholder:text-[#494949]"
                  />
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#717171]" />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[14px] leading-[20px] text-[#8b8f97]">Type</span>
                <div className="relative">
                  <input
                    value={settlementStatus}
                    onChange={(e) => setSettlementStatus(e.target.value)}
                    placeholder="Select type"
                    className="h-[43px] w-full rounded-xl border border-[#313131] bg-[#181818] px-3 pr-9 text-[13px] text-[#a2a2a2] outline-none placeholder:text-[#494949]"
                  />
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#717171]" />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[14px] leading-[20px] text-[#8b8f97]">Assigned Admin</span>
                <div className="relative">
                  <input
                    value={userKey}
                    onChange={(e) => setUserKey(e.target.value)}
                    placeholder="Select admin"
                    className="h-[43px] w-full rounded-xl border border-[#313131] bg-[#181818] px-3 pr-9 text-[13px] text-[#a2a2a2] outline-none placeholder:text-[#494949]"
                  />
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#717171]" />
                </div>
              </label>

              <div>
                <span className="mb-1.5 block text-[14px] leading-[20px] text-[#8b8f97]">Date Range</span>
                <div className="grid h-[55px] grid-cols-[1fr_31px_1fr] overflow-hidden rounded-card border border-[#313131]">
                  <input
                    type="text"
                    value={fromDate}
                    onFocus={(e) => { e.target.type = 'date' }}
                    onBlur={(e) => { if (!e.target.value) e.target.type = 'text' }}
                    onChange={(e) => setFromDate(e.target.value)}
                    placeholder="Start"
                    className="h-full bg-transparent px-3 text-[13px] text-[#a2a2a2] outline-none placeholder:text-[#494949]"
                  />
                  <div className="flex items-center justify-center bg-[#1f1f1f] text-[#494949]">...</div>
                  <input
                    type="text"
                    value={toDate}
                    onFocus={(e) => { e.target.type = 'date' }}
                    onBlur={(e) => { if (!e.target.value) e.target.type = 'text' }}
                    onChange={(e) => setToDate(e.target.value)}
                    placeholder="End"
                    className="h-full bg-transparent px-3 text-[13px] text-[#a2a2a2] outline-none placeholder:text-[#494949]"
                  />
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-[14px] leading-[20px] text-[#8b8f97]">Amount Range</span>
                <div className="grid h-[55px] grid-cols-2 overflow-hidden rounded-card border border-[#313131]">
                  <input
                    type="number"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    placeholder="Min amount"
                    className="h-full border-r border-[#313131] bg-transparent px-3 text-[13px] text-[#a2a2a2] outline-none placeholder:text-[#494949]"
                  />
                  <input
                    type="number"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    placeholder="Max amount"
                    className="h-full bg-transparent px-3 text-[13px] text-[#a2a2a2] outline-none placeholder:text-[#494949]"
                  />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-4 p-4">
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setStatus('')
                  setSettlementStatus('')
                  setAccountKey('')
                  setUserKey('')
                  setFromDate('')
                  setToDate('')
                  setMinAmount('')
                  setMaxAmount('')
                  setPage(1)
                }}
                className="h-[49px] flex-1 rounded-full border border-[#313131] text-sm text-[#717171] hover:bg-[#252525]"
              >
                Clear Filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setPage(1)
                  setShowFilter(false)
                }}
                className="h-[49px] flex-1 rounded-full bg-accent text-sm font-medium text-[#121505] hover:bg-accent/90"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <aside className="absolute left-2 right-2 top-2 h-[calc(100%-16px)] w-auto max-w-none overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl sm:left-auto sm:right-4 sm:top-4 sm:h-[calc(100%-32px)] sm:w-full sm:max-w-[420px]">
            <div className="border-b border-border/60 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-[#0a0a0a]">
                  <span className="text-base leading-none">⚖️</span>
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="truncate text-sm font-semibold text-text-primary">{d?.dispute_id ?? disputeRef(d) ?? '--'}</p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    {String(d?.status || 'open').replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
            </div>
            <div className="h-[calc(100%-72px)] overflow-y-auto p-4">
              <button
                type="button"
                onClick={() => {
                  setSelected(null)
                  setDetail(null)
                }}
                className="absolute right-6 top-6 rounded-full p-1 text-text-muted hover:bg-card-hover"
              >
                <X size={18} />
              </button>

              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-accent" size={28} />
                </div>
              ) : (
                <>
                  <div className="mb-4 text-center">
                    <p className="text-xs text-text-muted">Amount</p>
                    <p className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-text-primary">
                      {formatDisputeAmount(d)}
                    </p>
                    <p className="mt-1.5 text-xs text-text-muted">
                      {formatDateRaised(d?.transaction_date)} | {String(d?.date_created || '').slice(11, 19) || '--:--:--'}
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80">
                    <div className="border-b border-border/70 px-4 py-2.5 text-sm font-semibold text-text-secondary">
                      Dispute Details
                    </div>
                    <dl>
                      {[
                        ['Dispute ID', d.dispute_id ?? disputeRef(d), true],
                        ['Dispute Type', d.dispute_type || '--', false],
                        ['Account Number', d.customer_reference || '--', false],
                        ['Assigned To', d.assigned_to || '--', false],
                        ['Environment', d.environment || '--', false],
                        ['Created At', `${formatDateRaised(d.date_created)} | ${String(d?.date_created || '').slice(11, 19) || '--:--:--'}`, false],
                        ['Resolved At', `${formatDateRaised(d.date_modified)} | ${String(d?.date_modified || '').slice(11, 19) || '--:--:--'}`, false],
                      ].map(([k, v, canCopy]) => (
                        <div key={k} className="flex items-center gap-2 border-b border-border/60 px-4 py-2 last:border-b-0">
                          <dt className="min-w-0 flex-1 text-xs text-text-muted">{k}</dt>
                          <dd className="max-w-[55%] truncate text-right text-xs text-text-primary">{v}</dd>
                          {canCopy ? (
                            <button
                              type="button"
                              onClick={() => navigator.clipboard?.writeText(String(v || ''))}
                              className="shrink-0 rounded-full border border-border/70 bg-[#313131] p-1 text-accent"
                              aria-label="Copy dispute id"
                            >
                              <Copy size={12} />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-card/80">
                    <div className="border-b border-border/70 px-4 py-2.5 text-sm font-semibold text-text-secondary">
                      Update
                    </div>
                    <div className="space-y-2.5 p-4">
                      {patchError && <p className="text-xs text-error">{patchError}</p>}
                      <input
                        value={patchStatus}
                        onChange={(e) => setPatchStatus(e.target.value)}
                        placeholder="Status"
                        className="h-10 w-full rounded-lg border border-border/70 bg-page px-3 text-sm text-text-secondary outline-none"
                      />
                      <input
                        value={patchSettlementStatus}
                        onChange={(e) => setPatchSettlementStatus(e.target.value)}
                        placeholder="Settlement status"
                        className="h-10 w-full rounded-lg border border-border/70 bg-page px-3 text-sm text-text-secondary outline-none"
                      />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSavePatch}
                        className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-accent text-sm font-medium text-black hover:bg-accent/90 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : 'Save changes'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
