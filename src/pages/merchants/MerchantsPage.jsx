import { useState, useEffect, useCallback } from 'react'
import { Building2, Users, BookOpen, Landmark } from 'lucide-react'
import { getMerchantStats, getMerchants } from '../../services/merchants'
import { formatNumber, exportToCsv } from '../../lib/utils'
import Pagination from '../../components/ui/Pagination'
import MerchantToolbar from './MerchantToolbar'
import MerchantTable from './MerchantTable'

const LIMIT = 20

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 sm:gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-[140px] skeleton rounded-card" />
      ))}
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, iconWrapCls, comparison }) {
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
  const [sortBy, setSortBy] = useState('date_created')
  const [order, setOrder] = useState('desc')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    getMerchantStats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [])

  const fetchMerchants = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = { page, limit: LIMIT, sort_by: sortBy, order }
      if (search) params.name = search
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
  }, [page, search, sortBy, order])

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
      KYC_Tier: merchant.default_kyc_tier ?? 1,
      Customers: merchant.customer_count ?? 0,
      Ledgers: merchant.ledger_count ?? 0,
      Currencies: (merchant.currencies || []).join(', '),
      Settlements: merchant.settlement_count ?? 0,
      Date_Created: merchant.date_created || '',
      Last_Modified: merchant.date_modified || '',
    }))
    exportToCsv(rows, `merchants-page-${page}.csv`)
  }

  const tm = stats?.total_merchants
  const statCards = stats
    ? [
        {
          label: 'Total Merchants',
          value: formatNumber(tm?.count ?? 0),
          icon: Building2,
          iconWrapCls: 'flex h-6 w-6 items-center justify-center rounded-full bg-accent-bg text-accent',
          comparison: tm?.change_pct != null
            ? { value: Math.abs(tm.change_pct), direction: tm.change_pct >= 0 ? 'up' : 'down', label: 'Compared to last month' }
            : null,
        },
        {
          label: 'Total Customers',
          value: formatNumber(stats.total_customers ?? 0),
          icon: Users,
          iconWrapCls: 'flex h-6 w-6 items-center justify-center rounded-full bg-success-bg text-success',
          comparison: null,
        },
        {
          label: 'Total Ledgers',
          value: formatNumber(stats.total_ledgers ?? 0),
          icon: BookOpen,
          iconWrapCls: 'flex h-6 w-6 items-center justify-center rounded-full bg-warning-bg text-warning',
          comparison: null,
        },
        {
          label: 'Total Settlements',
          value: formatNumber(stats.total_settlements ?? 0),
          icon: Landmark,
          iconWrapCls: 'flex h-6 w-6 items-center justify-center rounded-full bg-error-bg text-error',
          comparison: null,
        },
      ]
    : []

  return (
    <div>
      <div className="animate-fade-in-up mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Merchants</h1>
        <p className="mt-1 text-sm text-text-secondary">
          View, monitor, and manage all merchants on the Sterllo platform, including customer activity, ledger usage, and settlement data.
        </p>
      </div>

      {statsLoading ? (
        <StatsSkeleton />
      ) : stats ? (
        <div className="animate-fade-in-up grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 sm:gap-6" style={{ animationDelay: '60ms' }}>
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
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="shrink-0 text-base font-medium text-text-primary">All Merchants</h3>
          <MerchantToolbar
            search={search}
            onSearchChange={setSearch}
            sortBy={sortBy}
            order={order}
            onSortChange={(s, o) => { setSortBy(s); setOrder(o) }}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            onExport={handleExport}
          />
        </div>

        {loading ? (
          <div className="p-4 flex flex-col gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <p className="text-sm text-error">{error}</p>
            <button
              onClick={fetchMerchants}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-text-primary transition-colors hover:bg-card-hover active:scale-[0.97]"
            >
              Retry
            </button>
          </div>
        ) : (
          <MerchantTable merchants={merchants} />
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          label="Merchants"
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
