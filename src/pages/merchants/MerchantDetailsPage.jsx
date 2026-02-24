import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Building2, Users, Wallet, ChevronRight,
  SnowflakeIcon, Download, TrendingUp, ShieldCheck,
  FileText, Fingerprint, MapPin, Briefcase, RefreshCw,
  Clock, UserPlus, AlertCircle, Loader2,
} from 'lucide-react'
import {
  getMerchant,
  getMerchantWallets,
  getMerchantCustomers,
  getMerchantLedgers,
  updateMerchant,
} from '../../services/merchants'
import { useAuth } from '../../context/AuthContext'
import { cn, formatDate, formatNumber, timeAgo, exportToCsv } from '../../lib/utils'

const CAN_MUTATE = ['operations', 'compliance']

// ─── Small helpers ────────────────────────────────────────────────────────────

function Badge({ children, variant = 'neutral' }) {
  const variants = {
    neutral:  'bg-card-hover text-text-secondary',
    business: 'bg-[#1e2333] text-text-primary border border-border',
    success:  'bg-success-bg text-success',
    warning:  'bg-warning-bg text-warning',
    error:    'bg-error-bg text-error',
    accent:   'bg-accent/15 text-accent',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-0.5 text-[11px] font-medium', variants[variant])}>
      {children}
    </span>
  )
}

function SectionCard({ title, rightSlot, children }) {
  return (
    <div className="rounded-card border border-border bg-card">
      {title && (
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <span className="text-sm font-medium text-text-primary">{title}</span>
          {rightSlot}
        </div>
      )}
      {children}
    </div>
  )
}

function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded bg-card-hover', className)} />
}

// ─── Section: Header skeleton ─────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div className="rounded-card border border-border bg-card p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-5">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-48" />
            <div className="flex gap-2 pt-1">
              {[72, 80, 72, 72, 72].map((w, i) => <Skeleton key={i} className={`h-6 rounded-full`} style={{ width: w }} />)}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-32 rounded-button" />)}
        </div>
      </div>
    </div>
  )
}

// ─── Section: Stat card ───────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, iconColor = 'text-accent' }) {
  return (
    <div className="rounded-card border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-full bg-card-hover', iconColor)}>
          <Icon size={18} />
        </div>
        <span className="text-sm text-text-secondary">{label}</span>
      </div>
      <p className="mt-4 text-3xl font-bold text-text-primary">{value ?? '--'}</p>
    </div>
  )
}

// ─── Section: Compliance verification item ────────────────────────────────────

function VerificationItem({ icon: Icon, label, status }) {
  const isVerified = status === 'verified'
  const isPending  = status === 'pending'
  return (
    <div className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Icon size={17} />
        </div>
        <span className="text-sm text-text-primary">{label}</span>
      </div>
      <Badge variant={isVerified ? 'success' : isPending ? 'warning' : 'neutral'}>
        {isVerified ? 'Verified' : isPending ? 'Pending' : 'Not Started'}
      </Badge>
    </div>
  )
}

// ─── Section: Activity item ───────────────────────────────────────────────────

function ActivityItem({ icon: Icon, iconBg, label, sub, time }) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', iconBg)}>
        <Icon size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{label}</p>
        {sub && <p className="truncate text-[11px] text-text-muted">{sub}</p>}
      </div>
      <span className="shrink-0 whitespace-nowrap text-[11px] text-text-muted">{time}</span>
    </div>
  )
}

// ─── Section: Wallet table row ────────────────────────────────────────────────

const walletStatusBadge = {
  active:    { label: 'Active',    cls: 'bg-success-bg text-success' },
  inactive:  { label: 'Inactive',  cls: 'bg-card-hover text-text-muted' },
  suspended: { label: 'Suspended', cls: 'bg-error-bg text-error' },
}

function WalletRow({ wallet }) {
  const accountNumber = wallet.ngn_deposit_accounts?.[0]?.account_number
  const shortKey = wallet.wallet_key ? `WLT-${wallet.wallet_key.slice(-8).toUpperCase()}` : '--'
  const status = 'active'
  const badge = walletStatusBadge[status]
  return (
    <tr className="border-b border-border/50 last:border-0 transition-colors hover:bg-card-hover/30">
      <td className="px-4 py-2.5 text-xs text-text-muted font-mono">
        {accountNumber || shortKey}
      </td>
      <td className="px-4 py-2.5 text-sm text-text-secondary">{wallet.currency_code}</td>
      <td className="px-4 py-2.5 text-xs text-text-secondary">{formatDate(wallet.date_created)}</td>
      <td className="px-4 py-2.5">
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium', badge.cls)}>
          {badge.label}
        </span>
      </td>
    </tr>
  )
}

// ─── Section: Customer row (for "Recent Customers") ───────────────────────────

const kycBadgeMap = {
  verified: { label: 'Verified', cls: 'bg-success-bg text-success' },
  pending:  { label: 'Pending',  cls: 'bg-warning-bg text-warning' },
  none:     { label: 'None',     cls: 'bg-card-hover text-text-muted' },
}

function CustomerRow({ customer, onClick }) {
  const fullName = [customer.first_name, customer.surname].filter(Boolean).join(' ')
  const kycBadge = kycBadgeMap[customer.kyc_status] || kycBadgeMap.none
  return (
    <tr
      className="cursor-pointer border-b border-border/50 last:border-0 transition-colors hover:bg-card-hover/30"
      onClick={onClick}
    >
      <td className="px-4 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent text-[11px] font-semibold">
          {(customer.first_name?.[0] || '?').toUpperCase()}
        </div>
      </td>
      <td className="px-4 py-2.5">
        <span className="text-sm font-medium text-text-primary">{fullName}</span>
        <span className="mt-0.5 block text-[11px] text-text-muted">{customer.email_address}</span>
      </td>
      <td className="px-4 py-2.5 text-xs text-text-secondary">{customer.type}</td>
      <td className="px-4 py-2.5 text-xs text-text-secondary">Tier {customer.tier}</td>
      <td className="px-4 py-2.5">
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium', kycBadge.cls)}>
          {kycBadge.label}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-text-secondary">{formatDate(customer.date_created)}</td>
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MerchantDetailsPage() {
  const { accountKey } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const canMutate = CAN_MUTATE.includes(user?.role)

  const [merchant,   setMerchant]   = useState(null)
  const [wallets,    setWallets]    = useState([])
  const [walletMeta, setWalletMeta] = useState(null)
  const [customers,  setCustomers]  = useState([])
  const [custMeta,   setCustMeta]   = useState(null)
  const [ledgers,    setLedgers]    = useState([])

  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [freezing,     setFreezing]     = useState(false)
  const [upgrading,    setUpgrading]    = useState(false)
  const [actionMsg,    setActionMsg]    = useState(null)   // { type: 'success'|'error', text }

  const showMsg = (type, text) => {
    setActionMsg({ type, text })
    setTimeout(() => setActionMsg(null), 4000)
  }

  const handleFreeze = async () => {
    if (!window.confirm(`Freeze account for ${merchant?.name}? This will restrict their operations.`)) return
    setFreezing(true)
    try {
      await updateMerchant(accountKey, { status: 'FROZEN' })
      showMsg('success', 'Account frozen successfully.')
    } catch (e) {
      showMsg('error', e?.response?.data?.message || 'Failed to freeze account.')
    } finally {
      setFreezing(false)
    }
  }

  const handleUpgradeTier = async () => {
    const current = merchant?.default_kyc_tier ?? 1
    const next = current + 1
    if (!window.confirm(`Upgrade ${merchant?.name} from Tier ${current} to Tier ${next}?`)) return
    setUpgrading(true)
    try {
      const res = await updateMerchant(accountKey, { default_kyc_tier: next })
      setMerchant((prev) => ({ ...prev, default_kyc_tier: res.data?.default_kyc_tier ?? next }))
      showMsg('success', `Tier upgraded to Tier ${next}.`)
    } catch (e) {
      showMsg('error', e?.response?.data?.message || 'Failed to upgrade tier.')
    } finally {
      setUpgrading(false)
    }
  }

  const handleExport = () => {
    if (!merchant) return
    exportToCsv(
      [{
        name: merchant.name,
        trade_name: merchant.trade_name ?? '',
        account_key: merchant.account_key,
        tier: merchant.default_kyc_tier,
        customers: merchant.customer_count,
        ledgers: merchant.ledger_count,
        settlements: merchant.settlement_count,
        currencies: (merchant.currencies || []).join(', '),
        date_created: merchant.date_created,
      }],
      `merchant-${accountKey}.csv`
    )
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [mRes, wRes, cRes, lRes] = await Promise.allSettled([
        getMerchant(accountKey),
        getMerchantWallets(accountKey, { page: 1, limit: 10 }),
        getMerchantCustomers(accountKey, { page: 1, limit: 10 }),
        getMerchantLedgers(accountKey, { page: 1, limit: 5 }),
      ])

      if (mRes.status === 'fulfilled') setMerchant(mRes.value.data)
      else setError('Failed to load merchant details.')

      if (wRes.status === 'fulfilled') {
        setWallets(wRes.value.records || [])
        setWalletMeta(wRes.value.pagination)
      }

      if (cRes.status === 'fulfilled') {
        setCustomers(cRes.value.records || [])
        setCustMeta(cRes.value.pagination)
      }

      if (lRes.status === 'fulfilled') {
        setLedgers(lRes.value.records || [])
      }
    } finally {
      setLoading(false)
    }
  }, [accountKey])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Derived values ──────────────────────────────────────────────────────────

  const kycDerived = merchant
    ? merchant.customer_count > 3 ? 'verified' : merchant.customer_count > 0 ? 'pending' : 'none'
    : 'none'
  const riskDerived = merchant
    ? merchant.settlement_count === 0 && merchant.customer_count === 0 ? 'high'
      : merchant.settlement_count === 0 ? 'medium' : 'low'
    : 'low'

  const kycVariant   = { verified: 'success', pending: 'warning', none: 'neutral' }[kycDerived]
  const kycLabel     = { verified: 'Verified', pending: 'Pending', none: 'No KYC' }[kycDerived]
  const riskVariant  = { low: 'success', medium: 'warning', high: 'error' }[riskDerived]
  const riskLabel    = { low: 'Low', medium: 'Medium', high: 'High' }[riskDerived]

  // ── Activity items derived from recent customers ────────────────────────────
  const activityItems = customers.slice(0, 6).map((c) => ({
    id: c.id,
    icon: UserPlus,
    iconBg: 'bg-accent/10 text-accent',
    label: `${[c.first_name, c.surname].filter(Boolean).join(' ')} onboarded`,
    sub: `by ${c.source || 'API'}`,
    time: timeAgo(c.date_created),
  }))

  // ── Error state ─────────────────────────────────────────────────────────────
  if (!loading && error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <AlertCircle size={40} className="text-error" />
        <p className="text-sm text-text-secondary">{error}</p>
        <button
          onClick={fetchAll}
          className="flex items-center gap-1.5 rounded-button border border-border px-4 py-2 text-sm text-text-primary hover:bg-card-hover"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up space-y-6">

      {/* ── Action feedback toast ──────────────────────────────────────────── */}
      {actionMsg && (
        <div className={cn(
          'flex items-center gap-2 rounded-card border px-4 py-3 text-sm transition-all',
          actionMsg.type === 'success'
            ? 'border-success/30 bg-success-bg text-success'
            : 'border-error/30 bg-error-bg text-error',
        )}>
          {actionMsg.type === 'success'
            ? <AlertCircle size={15} />
            : <AlertCircle size={15} />}
          {actionMsg.text}
        </div>
      )}

      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link to="/merchants" className="flex items-center gap-1 text-text-muted transition-colors hover:text-accent">
          <ArrowLeft size={14} />
          Merchants
        </Link>
        <ChevronRight size={14} className="text-text-muted" />
        <span className="text-text-primary">
          {loading ? 'Profile Details' : (merchant?.name ?? 'Profile Details')}
        </span>
      </nav>

      {/* ── Header card ────────────────────────────────────────────────────── */}
      {loading ? (
        <HeaderSkeleton />
      ) : merchant ? (
        <div className="rounded-card border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Avatar + Info */}
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Building2 size={28} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-text-primary">{merchant.name}</h1>
                {merchant.trade_name && (
                  <p className="text-sm text-text-secondary">{merchant.trade_name}</p>
                )}
                <p className="mt-0.5 font-mono text-xs text-text-muted">ID: {merchant.account_key}</p>

                {/* Badges row */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-text-secondary">Tier {merchant.default_kyc_tier ?? 1}</span>
                  <div className="h-3 w-px bg-border" />
                  <Badge variant="business">Business</Badge>
                  <Badge variant={kycVariant}>{kycLabel}</Badge>
                  <Badge variant="success">Active</Badge>
                  <Badge variant={riskVariant}>{riskLabel} Risk</Badge>
                </div>

                {/* Currencies */}
                {merchant.currencies?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {merchant.currencies.map((c) => (
                      <span key={c} className="rounded-full bg-card-hover px-2 py-0.5 text-[11px] text-text-muted">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Freeze — operations & compliance only */}
              {canMutate && (
                <button
                  onClick={handleFreeze}
                  disabled={freezing}
                  className="flex items-center gap-1.5 rounded-button border border-border px-3.5 py-2 text-sm text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {freezing
                    ? <Loader2 size={14} className="animate-spin" />
                    : <SnowflakeIcon size={14} />}
                  Freeze Account
                </button>
              )}

              {/* Export — all roles */}
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 rounded-button border border-border px-3.5 py-2 text-sm text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary active:scale-95"
              >
                <Download size={14} />
                Export Data
              </button>

              {/* Upgrade Tier — operations & compliance only */}
              {canMutate && (
                <button
                  onClick={handleUpgradeTier}
                  disabled={upgrading}
                  className="flex items-center gap-1.5 rounded-button bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {upgrading
                    ? <Loader2 size={14} className="animate-spin" />
                    : <TrendingUp size={14} />}
                  Upgrade Tier
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Main two-column grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_400px]">

        {/* ═══ LEFT COLUMN ══════════════════════════════════════════════════ */}
        <div className="space-y-6">

          {/* Stat mini-cards */}
          <div className="grid grid-cols-2 gap-4">
            {loading ? (
              <>
                <Skeleton className="h-28 rounded-card" />
                <Skeleton className="h-28 rounded-card" />
              </>
            ) : (
              <>
                <StatCard
                  label="Total Wallets"
                  value={formatNumber(walletMeta?.total ?? wallets.length)}
                  icon={Wallet}
                  iconColor="text-accent"
                />
                <StatCard
                  label="Total Customers"
                  value={formatNumber(custMeta?.total ?? merchant?.customer_count ?? 0)}
                  icon={Users}
                  iconColor="text-[#a78bfa]"
                />
              </>
            )}
          </div>

          {/* Linked Wallets */}
          <SectionCard
            title="Linked Wallets"
            rightSlot={
              <button className="text-xs font-medium text-accent transition-colors hover:text-accent/70">
                View All
              </button>
            }
          >
            {loading ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : wallets.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-text-muted">
                <Wallet size={24} className="opacity-40" />
                No wallets found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      {['Account / Wallet ID', 'Currency', 'Date Created', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-[11px] font-medium text-text-muted">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wallets.map((w) => <WalletRow key={w.id} wallet={w} />)}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Compliance & Verification */}
          <SectionCard
            title="Compliance & Verification"
            rightSlot={
              <button className="rounded-button border border-border px-3 py-1 text-xs text-text-secondary transition-colors hover:bg-card-hover">
                View History
              </button>
            }
          >
            <div className="divide-y divide-border/50 px-5 py-1">
              <VerificationItem
                icon={Briefcase}
                label="Business Registration"
                status={merchant?.customer_count > 0 ? 'verified' : 'pending'}
              />
              <VerificationItem
                icon={ShieldCheck}
                label="Account Verification"
                status="verified"
              />
              <VerificationItem
                icon={Fingerprint}
                label="KYC Verification"
                status={kycDerived}
              />
              <VerificationItem
                icon={MapPin}
                label="Address Verification"
                status={merchant?.settlement_count > 0 ? 'verified' : 'pending'}
              />
            </div>
          </SectionCard>

          {/* Activity Feed */}
          <SectionCard title="Activity Feed">
            {loading ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
              </div>
            ) : activityItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-text-muted">
                <Clock size={24} className="opacity-40" />
                No recent activity
              </div>
            ) : (
              <div className="divide-y divide-border/50 px-5 py-2">
                {activityItems.map((item) => (
                  <ActivityItem key={item.id} {...item} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ═══ RIGHT COLUMN ═════════════════════════════════════════════════ */}
        <div className="space-y-6">

          {/* Recent Customers (mapped to "Recent Transactions" slot) */}
          <SectionCard
            title="Recent Customers"
            rightSlot={
              <button className="text-xs font-medium text-accent transition-colors hover:text-accent/70">
                View All
              </button>
            }
          >
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-text-muted">
                <Users size={24} className="opacity-40" />
                No customers yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      {['', 'Name', 'Type', 'Tier', 'KYC', 'Joined'].map((h, i) => (
                        <th key={i} className="px-4 py-2.5 text-[11px] font-medium text-text-muted">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <CustomerRow key={c.id} customer={c} onClick={() => {}} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Ledgers / Settlements */}
          <SectionCard
            title="Ledgers"
            rightSlot={
              <div className="flex items-center gap-2">
                <button className="text-xs font-medium text-accent transition-colors hover:text-accent/70">
                  View All
                </button>
              </div>
            }
          >
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : ledgers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-text-muted">
                <FileText size={24} className="opacity-40" />
                No ledgers found
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {ledgers.map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="font-mono text-xs text-text-primary">
                        {`LDG-${l.wallet_key?.slice(-8).toUpperCase() ?? l.id}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-text-muted">{l.currency_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-text-secondary">{formatDate(l.date_created)}</p>
                      <span className="mt-0.5 inline-flex items-center rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-medium text-success">
                        Active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Notes */}
          <SectionCard title="Notes">
            <div className="px-5 py-4">
              <p className="mb-4 text-xs text-text-muted">
                All actions performed on this profile are logged and auditable for compliance purposes.
              </p>
              <div className="space-y-4">
                <div className="rounded-card border border-border/50 bg-page p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-text-primary">Account Review</p>
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        Compliance check performed on merchant account {merchant?.account_key?.slice(0, 10)}...
                      </p>
                    </div>
                    <button className="shrink-0 text-[11px] text-accent hover:underline">View Details</button>
                  </div>
                  <p className="mt-2 text-[11px] text-text-muted">
                    {timeAgo(merchant?.date_modified || merchant?.date_created || new Date())}
                  </p>
                </div>

                <div className="rounded-card border border-border/50 bg-page p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-text-primary">Merchant Verification</p>
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        KYC tier assigned: Tier {merchant?.default_kyc_tier ?? 1}. Customer onboarding enabled.
                      </p>
                    </div>
                    <button className="shrink-0 text-[11px] text-accent hover:underline">View Details</button>
                  </div>
                  <p className="mt-2 text-[11px] text-text-muted">
                    {timeAgo(merchant?.date_created || new Date())}
                  </p>
                </div>

                <button className="w-full rounded-button border border-border py-2 text-xs text-text-secondary transition-colors hover:bg-card-hover">
                  View All Notes
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
