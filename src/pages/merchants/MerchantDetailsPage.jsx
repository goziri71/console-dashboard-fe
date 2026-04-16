import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  Snowflake,
  TrendingUp,
  Loader2,
  RefreshCw,
  AlertCircle,
  MoreHorizontal,
} from 'lucide-react'
import { getMerchant, getMerchantCustomers, updateMerchant } from '../../services/merchants'
import { useAuth } from '../../context/AuthContext'
import { cn, exportToCsv } from '../../lib/utils'
import Pagination from '../../components/ui/Pagination'
import MerchantToolbar from './MerchantToolbar'
import { CUSTOMER_SORT_OPTIONS } from './merchantToolbarOptions'
import MerchantCustomersTable from './MerchantCustomersTable'
import { countryToFlagEmoji, normalizeAccountStatusKey, typeLabel } from './merchantUi'
import {
  customerDisplayName,
  customerTypeLabel,
  customerTierLabel,
  customerKycKey,
  customerAccountStatusKey,
  customerWalletCount,
} from './merchantCustomerUi'

const CAN_MUTATE = ['operations', 'compliance']
const LIMIT = 20

function unwrapPayload(payload) {
  if (payload == null) return null
  if (payload.data != null && typeof payload.data === 'object') return payload.data
  return payload
}

function dotBadge(type, label) {
  const styles = {
    active: 'bg-success-bg text-success border-success/20',
    verified: 'bg-success-bg text-success border-success/20',
    medium: 'bg-warning-bg text-warning border-warning/20',
    business: 'bg-[#3f1d7a]/35 text-[#c084fc] border-[#6d28d9]/40',
    processing: 'bg-[#072a66] text-[#2970ff] border-[#1d4ed8]/30',
    inactive: 'bg-card-hover text-text-muted border-border',
    suspended: 'bg-[#451a1a] text-[#f87171] border-[#7f1d1d]',
  }
  return (
    <span className={cn('inline-flex rounded-full border px-3 py-0.5 text-[11px] font-medium', styles[type] || styles.inactive)}>
      {label}
    </span>
  )
}

export default function MerchantDetailsPage() {
  const { accountKey } = useParams()
  const { user } = useAuth()
  const canMutate = CAN_MUTATE.includes(user?.role)

  const [merchant, setMerchant] = useState(null)
  const [merchantLoading, setMerchantLoading] = useState(true)
  const [merchantError, setMerchantError] = useState(null)

  const [customers, setCustomers] = useState([])
  const [customersLoading, setCustomersLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [order, setOrder] = useState('desc')
  const [statusFilter, setStatusFilter] = useState('')

  const [menuOpen, setMenuOpen] = useState(false)
  const [freezing, setFreezing] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    let cancelled = false
    setMerchantLoading(true)
    setMerchantError(null)
    getMerchant(accountKey)
      .then((res) => {
        if (!cancelled) setMerchant(unwrapPayload(res))
      })
      .catch(() => {
        if (!cancelled) setMerchantError('Failed to load merchant profile.')
      })
      .finally(() => {
        if (!cancelled) setMerchantLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountKey])

  const fetchCustomers = useCallback(async () => {
    if (!accountKey) return
    setCustomersLoading(true)
    try {
      const sortKey = sortBy || 'date_created'
      const params = { page, limit: LIMIT, sort_by: sortKey, order }
      const q = search.trim()
      if (q) params.name = q
      if (statusFilter === 'account_active') params.account_status = 'active'
      else if (statusFilter === 'account_inactive') params.account_status = 'inactive'
      else if (statusFilter === 'account_suspended') params.account_status = 'suspended'
      else if (statusFilter === 'kyc_pending') params.kyc_status = 'pending'

      const res = await getMerchantCustomers(accountKey, params)
      const records = res.records || res.data || []
      const pag = res.pagination || {}
      setCustomers(records)
      const t = pag.total ?? records.length
      setTotal(t)
      const tp = pag.total_pages
      setTotalPages(
        Number.isFinite(Number(tp)) && Number(tp) > 0
          ? Number(tp)
          : Math.max(1, Math.ceil(t / LIMIT))
      )
    } catch {
      setCustomers([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setCustomersLoading(false)
    }
  }, [accountKey, page, search, sortBy, order, statusFilter])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    setPage(1)
  }, [search, sortBy, order, statusFilter])

  const pushMsg = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  const primaryFromList = customers[0]
  const phone = merchant?.phone ?? merchant?.phone_number ?? primaryFromList?.phone_number
  const email = merchant?.email ?? merchant?.email_address ?? primaryFromList?.email_address

  const accountStatusKey = merchant ? normalizeAccountStatusKey(merchant) : 'active'
  const typeStr = typeLabel(merchant)

  const handleExportCustomers = () => {
    if (!customers.length) return
    const rows = customers.map((c) => ({
      Name: customerDisplayName(c),
      Type: customerTypeLabel(c),
      Tier: customerTierLabel(c),
      KYC: customerKycKey(c),
      Account_Status: customerAccountStatusKey(c),
      Wallets: customerWalletCount(c),
      Last_Activity: c.date_modified || c.date_created || '',
    }))
    exportToCsv(rows, `merchant-${accountKey}-customers-${page}.csv`)
  }

  const handleFreeze = async () => {
    if (!window.confirm(`Freeze account for ${merchant?.name}?`)) return
    setFreezing(true)
    try {
      await updateMerchant(accountKey, { status: 'FROZEN' })
      pushMsg('success', 'Account frozen successfully.')
    } catch (e) {
      pushMsg('error', e?.response?.data?.message || 'Failed to freeze account.')
    } finally {
      setFreezing(false)
      setMenuOpen(false)
    }
  }

  const handleUpgradeTier = async () => {
    const currentTier = merchant?.default_kyc_tier ?? 1
    const nextTier = currentTier + 1
    if (!window.confirm(`Upgrade ${merchant?.name} from Tier ${currentTier} to Tier ${nextTier}?`)) return
    setUpgrading(true)
    try {
      const res = await updateMerchant(accountKey, { default_kyc_tier: nextTier })
      const body = unwrapPayload(res)
      setMerchant((prev) => ({
        ...prev,
        default_kyc_tier: body?.default_kyc_tier ?? nextTier,
      }))
      pushMsg('success', `Tier upgraded to ${nextTier}.`)
    } catch (e) {
      pushMsg('error', e?.response?.data?.message || 'Failed to upgrade tier.')
    } finally {
      setUpgrading(false)
      setMenuOpen(false)
    }
  }

  const sortOptions = useMemo(() => CUSTOMER_SORT_OPTIONS, [])
  const filterOptions = useMemo(
    () => [
      { value: '', label: 'All' },
      { value: 'account_active', label: 'Active' },
      { value: 'account_inactive', label: 'Inactive' },
      { value: 'account_suspended', label: 'Suspended' },
      { value: 'kyc_pending', label: 'KYC Pending' },
    ],
    []
  )

  if (merchantLoading && !merchant) {
    return (
      <div className="animate-fade-in-up space-y-6">
        <div className="h-6 w-48 skeleton rounded-lg" />
        <div className="h-32 skeleton rounded-card" />
        <div className="h-64 skeleton rounded-card" />
      </div>
    )
  }

  if (merchantError || !merchant) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertCircle className="text-error" size={36} />
        <p className="text-sm text-text-secondary">{merchantError || 'Merchant not found.'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-button border border-border px-4 py-2 text-sm text-text-primary hover:bg-card-hover"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    )
  }

  const flag = countryToFlagEmoji(merchant.country_code ?? merchant.country)

  return (
    <div className="animate-fade-in-up space-y-6">
      {msg && (
        <div
          className={cn(
            'rounded-card border px-4 py-2.5 text-sm',
            msg.type === 'success' ? 'border-success/30 bg-success-bg text-success' : 'border-error/30 bg-error-bg text-error'
          )}
        >
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-text-muted">
          <Link to="/merchants" className="inline-flex items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} />
            Merchants
          </Link>
          <span className="text-text-muted">›</span>
          <span className="text-text-primary">Customer Details</span>
        </div>
        {canMutate && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs text-text-secondary hover:bg-card-hover"
            >
              <MoreHorizontal size={16} />
              Actions
            </button>
            {menuOpen && (
              <>
                <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-border bg-page py-1 shadow-lg">
                  <button
                    type="button"
                    disabled={freezing}
                    onClick={handleFreeze}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-card-hover"
                  >
                    {freezing ? <Loader2 size={14} className="animate-spin" /> : <Snowflake size={14} />}
                    Freeze account
                  </button>
                  <button
                    type="button"
                    disabled={upgrading}
                    onClick={handleUpgradeTier}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-card-hover"
                  >
                    {upgrading ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                    Upgrade tier
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <section className="rounded-card border border-border bg-card p-5">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-5">
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-card-hover text-4xl leading-none">
              {flag ? (
                <span aria-hidden>{flag}</span>
              ) : (
                <span className="text-xl text-text-muted">—</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-text-primary">{merchant.name || '—'}</h1>
              <p className="mt-1 font-mono text-sm text-text-secondary">ID: {merchant.account_key || '—'}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
                <span>{phone || '—'}</span>
                <span className="hidden h-4 w-px bg-border sm:inline" />
                <span className="break-all">{email || '—'}</span>
                <span className="hidden h-4 w-px bg-border sm:inline" />
                <span>Tier {merchant.default_kyc_tier ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-6 lg:justify-end">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Account Status</p>
              <div className="mt-2">
                {dotBadge(
                  accountStatusKey === 'active' ? 'active' : accountStatusKey === 'suspended' ? 'suspended' : 'inactive',
                  accountStatusKey === 'active' ? 'Active' : accountStatusKey === 'suspended' ? 'Suspended' : 'Inactive'
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Account Type</p>
              <div className="mt-2">{dotBadge('business', typeStr === '—' ? '—' : typeStr)}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-card border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:gap-6">
          <h2 className="shrink-0 text-base font-medium text-text-primary">All Customers</h2>
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
              onExport={handleExportCustomers}
              searchPlaceholder="Search customers..."
              sortOptions={sortOptions}
              filterOptions={filterOptions}
            />
          </div>
        </div>

        {customersLoading ? (
          <div className="flex flex-col gap-3 p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <MerchantCustomersTable customers={customers} />
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          label="Customers"
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
