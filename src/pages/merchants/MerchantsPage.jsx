import { useState, useEffect, useCallback, useMemo } from 'react'
import { Building2, Users, Clock, ShieldAlert } from 'lucide-react'
import { getMerchantStats, getMerchants } from '../../services/merchants'
import { formatNumber, exportToCsv } from '../../lib/utils'
import Pagination from '../../components/ui/Pagination'
import MerchantToolbar from './MerchantToolbar'
import MerchantTable from './MerchantTable'
import {
  typeLabel,
  normalizeKycKey,
  normalizeAccountStatusKey,
  tierLabel,
} from './merchantUi'

const LIMIT = 20

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-[140px] skeleton rounded-card" />
      ))}
    </div>
  )
}

function SummaryCard({ label, value, icon, iconWrapCls, comparison }) {
  const Icon = icon
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className={iconWrapCls}>
          <Icon size={14} />
        </div>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <p className="text-[34px] font-semibold leading-none text-text-primary">{value}</p>
      {comparison ? (
        <p className={`mt-2 text-[11px] ${comparison.direction === 'up' ? 'text-success' : 'text-error'}`}>
          {comparison.direction === 'up' ? '↑' : '↓'} {comparison.value}% {comparison.label}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-transparent">.</p>
      )}
    </div>
  )
}

function unwrapStats(payload) {
  if (payload == null) return null
  if (payload.data != null && typeof payload.data === 'object') return payload.data
  return payload
}

/** Number from API, or `{ count: n }` if the backend ever sends that shape. */
function asNumber(v) {
  if (v == null) return 0
  if (typeof v === 'object' && 'count' in v) return Number(v.count) || 0
  return Number(v) || 0
}

function trendFrom(field, stats, key) {
  if (field && typeof field === 'object' && field.change_pct != null) return field.change_pct
  return stats?.[key] ?? null
}

function buildStatCards(stats) {
  const tm = stats?.total_merchants
  const tc = stats?.total_customers
  const kyc = stats?.kyc_pending ?? stats?.kyc_pending_count
  const ra = stats?.restricted_accounts ?? stats?.restricted_accounts_count

  const tmPct = trendFrom(tm, stats, 'total_merchants_change_pct')
  const tcPct = trendFrom(tc, stats, 'total_customers_change_pct')
  const kycPct = trendFrom(kyc, stats, 'kyc_pending_change_pct')

  const cmp = (pct, label) =>
    pct != null
      ? { value: Math.abs(pct), direction: pct >= 0 ? 'up' : 'down', label }
      : null

  return [
    {
      label: 'Total Merchants',
      value: formatNumber(asNumber(tm)),
      icon: Building2,
      iconWrapCls: 'flex h-6 w-6 items-center justify-center rounded-full bg-accent-bg text-accent',
      comparison: cmp(tmPct, 'Compared to last month'),
    },
    {
      label: 'Total Customers',
      value: formatNumber(asNumber(tc)),
      icon: Users,
      iconWrapCls: 'flex h-6 w-6 items-center justify-center rounded-full bg-success-bg text-success',
      comparison: cmp(tcPct, 'Compared to last month'),
    },
    {
      label: 'KYC Pending',
      value: formatNumber(asNumber(kyc)),
      icon: Clock,
      iconWrapCls: 'flex h-6 w-6 items-center justify-center rounded-full bg-warning-bg text-warning',
      comparison: cmp(kycPct, 'Compared to yesterday'),
    },
    {
      label: 'Restricted Accounts',
      value: formatNumber(asNumber(ra)),
      icon: ShieldAlert,
      iconWrapCls: 'flex h-6 w-6 items-center justify-center rounded-full bg-error-bg text-error',
      comparison: null,
    },
  ]
}

export default function MerchantsPage() {
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [merchants, setMerchants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [order, setOrder] = useState('desc')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    getMerchantStats()
      .then((res) => setStats(unwrapStats(res)))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [])

  const fetchMerchants = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sortKey = sortBy || 'date_created'
      const params = { page, limit: LIMIT, sort_by: sortKey, order }
      if (search) params.name = search
      if (statusFilter === 'account_active') params.account_status = 'active'
      else if (statusFilter === 'account_inactive') params.account_status = 'inactive'
      else if (statusFilter === 'account_suspended') params.account_status = 'suspended'
      else if (statusFilter === 'kyc_pending') params.kyc_status = 'pending'

      const res = await getMerchants(params)
      const records = res.records || res.data || []
      const pag = res.pagination || {}
      setMerchants(records)
      setTotal(pag.total || records.length)
      setTotalPages(pag.total_pages || Math.ceil((pag.total || records.length) / LIMIT))
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load merchants.')
    } finally {
      setLoading(false)
    }
  }, [page, search, sortBy, order, statusFilter])

  useEffect(() => {
    fetchMerchants()
  }, [fetchMerchants])

  useEffect(() => {
    setPage(1)
  }, [search, sortBy, order, statusFilter])

  function handleExport() {
    if (!merchants.length) return
    const rows = merchants.map((merchant) => ({
      Name: merchant.name || '',
      Trade_Name: merchant.trade_name || '',
      Type: typeLabel(merchant),
      Tier: tierLabel(merchant),
      KYC_Status: normalizeKycKey(merchant),
      Account_Status: normalizeAccountStatusKey(merchant),
      Customers: merchant.customer_count ?? 0,
      Last_Activity: merchant.date_modified || merchant.date_created || '',
    }))
    exportToCsv(rows, `merchants-page-${page}.csv`)
  }

  const statCards = useMemo(() => (stats ? buildStatCards(stats) : []), [stats])

  return (
    <div>
      <div className="animate-fade-in-up mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Merchants</h1>
        <p className="mt-1 max-w-3xl text-sm text-text-secondary">
          View, monitor, and manage all individual and business customers across the Sterllo platform, including
          compliance status, wallet activity, and account health.
        </p>
      </div>

      {statsLoading ? (
        <StatsSkeleton />
      ) : stats ? (
        <div className="animate-fade-in-up grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4" style={{ animationDelay: '60ms' }}>
          {statCards.map((card) => (
            <SummaryCard
              key={card.label}
              label={card.label}
              value={card.value}
              comparison={card.comparison}
              icon={card.icon}
              iconWrapCls={card.iconWrapCls}
            />
          ))}
        </div>
      ) : null}

      <div className="animate-fade-in-up mt-6 overflow-hidden rounded-card border border-border bg-card" style={{ animationDelay: '120ms' }}>
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:gap-6">
          <h3 className="shrink-0 text-base font-medium text-text-primary lg:pt-0.5">All Merchants</h3>
          <div className="min-w-0 flex-1">
            <MerchantToolbar
              search={search}
              onSearchChange={setSearch}
              sortBy={sortBy}
              order={order}
              onSortChange={(s, o) => {
                setSortBy(s)
                setOrder(o)
              }}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              onExport={handleExport}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <p className="text-sm text-error">{error}</p>
            <button
              type="button"
              onClick={fetchMerchants}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-text-primary transition-colors hover:bg-card-hover active:scale-[0.97]"
            >
              Retry
            </button>
          </div>
        ) : (
          <MerchantTable merchants={merchants} page={page} limit={LIMIT} />
        )}

        <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} label="Merchants" onPageChange={setPage} />
      </div>
    </div>
  )
}
