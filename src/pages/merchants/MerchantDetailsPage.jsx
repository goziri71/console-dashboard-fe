import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  Snowflake,
  TrendingUp,
  Loader2,
  RefreshCw,
  AlertCircle,
  MoreHorizontal,
  ShieldCheck,
  Link2,
  X,
} from 'lucide-react'
import { getMerchant, getMerchantCustomers, updateMerchant, patchMerchantTier } from '../../services/merchants'
import { patchCustomerTier, postCustomerFreeze } from '../../services/customers'
import { useAuth } from '../../context/AuthContext'
import { canKycUpdate, canUpdateMerchant } from '../../lib/permissions'
import { cn, exportToCsv, formatNumber } from '../../lib/utils'
import Pagination from '../../components/ui/Pagination'
import MerchantToolbar from './MerchantToolbar'
import { CUSTOMER_SORT_OPTIONS } from './merchantToolbarOptions'
import MerchantCustomersTable from './MerchantCustomersTable'
import {
  countryToFlagEmoji,
  normalizeAccountStatusKey,
  typeLabel,
  tierLabel,
  merchantCustomerCount,
} from './merchantUi'
import {
  customerDisplayName,
  customerTypeLabel,
  customerTierLabel,
  customerKycKey,
  customerAccountStatusKey,
  customerWalletCount,
} from './merchantCustomerUi'
import MerchantKycPanel from './MerchantKycPanel'
import MerchantUdaraPanel from './MerchantUdaraPanel'
import { kycAggregateLabel, kycStatusPillClass, normalizeKycAggregateStatus } from '../../lib/kycUi'
import { useKycDisplayStatus } from '../../hooks/useKycDisplayStatus'

const CAN_MUTATE = ['operations', 'compliance']
const LIMIT = 20

function unwrapPayload(payload) {
  if (payload == null) return null
  if (payload.data != null && typeof payload.data === 'object') return payload.data
  return payload
}

/** Pills for the merchant profile banner (Figma node 8712-11162). */
function profileBannerPill(kind, label) {
  const styles = {
    'status-active': 'border border-[#1b4d2e]/70 bg-[#0f2418] text-[#86efac]',
    'status-suspended': 'border border-[#7f1d1d]/50 bg-[#2c1212] text-[#fca5a5]',
    'status-inactive': 'border border-white/[0.08] bg-[#161a22] text-[#9ca3af]',
    'type': 'border border-[#5b21b6]/35 bg-[#2d1248]/90 text-[#e9d5ff]',
  }
  return (
    <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-medium leading-none', styles[kind] || styles['status-inactive'])}>
      {label}
    </span>
  )
}

function ProfileDivider() {
  return <span className="mx-2 hidden h-3.5 w-px shrink-0 bg-[#3f4552] md:inline" aria-hidden />
}

export default function MerchantDetailsPage() {
  const { accountKey } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canMutate = CAN_MUTATE.includes(user?.role)
  const canApproveMerchantKyc = canKycUpdate(user?.permissions, user?.role)
  const canManageUdara = canUpdateMerchant(user?.permissions, user?.role)

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
  const [merchantKycStatus, setMerchantKycStatus] = useState(null)
  const [merchantKycPending, setMerchantKycPending] = useState(0)

  const [menuOpen, setMenuOpen] = useState(false)
  const [udaraModalOpen, setUdaraModalOpen] = useState(false)
  const [freezing, setFreezing] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [confirmState, setConfirmState] = useState({
    open: false,
    variant: 'default',
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    confirmClassName: 'bg-error text-white hover:brightness-105',
    showTierSelect: false,
    selectedTier: 1,
    onConfirm: null,
  })

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

  const refetchMerchant = useCallback(async () => {
    if (!accountKey) return
    const res = await getMerchant(accountKey)
    setMerchant(unwrapPayload(res))
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

  const closeConfirm = () => {
    setConfirmState((prev) => ({
      ...prev,
      open: false,
      variant: 'default',
      onConfirm: null,
      showTierSelect: false,
    }))
  }

  const openConfirm = ({
    title,
    message,
    confirmLabel,
    confirmClassName,
    showTierSelect,
    selectedTier,
    onConfirm,
    variant = 'default',
  }) => {
    setConfirmState({
      open: true,
      variant: variant === 'freeze' ? 'freeze' : 'default',
      title: title || 'Please confirm',
      message: message || '',
      confirmLabel: confirmLabel || 'Confirm',
      confirmClassName: confirmClassName || 'bg-error text-white hover:brightness-105',
      showTierSelect: !!showTierSelect,
      selectedTier: Number(selectedTier) >= 1 && Number(selectedTier) <= 3 ? Number(selectedTier) : 1,
      onConfirm: typeof onConfirm === 'function' ? onConfirm : null,
    })
  }

  const primaryFromList = customers[0]
  const phone = merchant?.phone ?? merchant?.phone_number ?? primaryFromList?.phone_number
  const email = merchant?.email ?? merchant?.email_address ?? primaryFromList?.email_address

  const accountStatusKey = merchant ? normalizeAccountStatusKey(merchant) : 'active'
  const typeStr = typeLabel(merchant)

  const merchantCustomerTotal = useMemo(() => {
    const fromMerchant = merchantCustomerCount(merchant)
    if (fromMerchant != null) return fromMerchant
    if (!search.trim() && !statusFilter) return total
    return null
  }, [merchant, total, search, statusFilter])

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

  const runFreezeMerchant = async () => {
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

  const handleFreeze = () => {
    openConfirm({
      variant: 'freeze',
      title: 'Freeze Account',
      message: `This will freeze the account for ${merchant?.name || 'this merchant'}. They will not be able to use it until unfrozen.`,
      confirmLabel: 'Confirm Freeze',
      confirmClassName: 'bg-[#C5DC4B] text-black hover:brightness-105',
      onConfirm: runFreezeMerchant,
    })
  }

  const runUpgradeTier = async (targetTier) => {
    const currentTier = Number(merchant?.default_kyc_tier ?? 1)
    const nextTier = Number(targetTier)
    if (!Number.isFinite(nextTier) || nextTier < 1 || nextTier > 3) {
      pushMsg('error', 'Select a valid tier (1 to 3).')
      return
    }
    setUpgrading(true)
    try {
      const res = await patchMerchantTier(accountKey, { tier: nextTier })
      const body = unwrapPayload(res)
      setMerchant((prev) => ({
        ...prev,
        default_kyc_tier: body?.default_kyc_tier ?? body?.tier ?? nextTier,
      }))
      pushMsg('success', `Tier upgraded to ${nextTier}.`)
    } catch (e) {
      pushMsg('error', e?.response?.data?.message || 'Failed to upgrade tier.')
    } finally {
      setUpgrading(false)
      setMenuOpen(false)
    }
  }

  const handleUpgradeTier = () => {
    const currentTier = Number(merchant?.default_kyc_tier ?? 1)
    openConfirm({
      title: 'Upgrade Merchant Tier',
      message: `Select target tier for ${merchant?.name || 'this merchant'}.`,
      confirmLabel: 'Upgrade Tier',
      confirmClassName: 'bg-[#C5DC4B] text-black hover:brightness-105',
      showTierSelect: true,
      selectedTier: currentTier >= 1 && currentTier <= 3 ? currentTier : 1,
      onConfirm: runUpgradeTier,
    })
  }

  const getCustomerId = (customer) => customer?.identifier ?? customer?.customer_identifier ?? customer?.id ?? ''

  const handleViewCustomerKyc = (customer) => {
    const id = getCustomerId(customer)
    if (!id) return
    navigate(`/merchants/${accountKey}/customers/${encodeURIComponent(String(id))}/kyc`)
  }

  const runFreezeCustomer = async (customer) => {
    const id = getCustomerId(customer)
    const label = customerDisplayName(customer)
    if (!id) return
    try {
      await postCustomerFreeze(id, { scope: 'full' })
      pushMsg('success', `${label} frozen successfully.`)
      await fetchCustomers()
    } catch (e) {
      pushMsg('error', e?.response?.data?.message || 'Failed to freeze customer account.')
    }
  }

  const handleFreezeCustomer = (customer) => {
    const label = customerDisplayName(customer)
    openConfirm({
      variant: 'freeze',
      title: 'Freeze Account',
      message: `This will freeze the account for ${label}. They will not be able to use it until unfrozen.`,
      confirmLabel: 'Confirm Freeze',
      confirmClassName: 'bg-[#C5DC4B] text-black hover:brightness-105',
      onConfirm: () => runFreezeCustomer(customer),
    })
  }

  const runUpgradeCustomer = async (customer, targetTier) => {
    const id = getCustomerId(customer)
    const label = customerDisplayName(customer)
    const current = Number(customer?.tier ?? customer?.default_kyc_tier ?? 1)
    const next = Number(targetTier)
    if (!id) return
    if (!Number.isFinite(next) || next < 1 || next > 3) {
      pushMsg('error', 'Select a valid tier (1 to 3).')
      return
    }
    try {
      await patchCustomerTier(id, { tier: next })
      pushMsg('success', `${label} upgraded to Tier ${next}.`)
      await fetchCustomers()
    } catch (e) {
      pushMsg('error', e?.response?.data?.message || 'Failed to upgrade customer tier.')
    }
  }

  const handleUpgradeCustomer = (customer) => {
    const label = customerDisplayName(customer)
    const current = Number(customer?.tier ?? customer?.default_kyc_tier ?? 1)
    openConfirm({
      title: 'Upgrade Customer Tier',
      message: `Select target tier for ${label}.`,
      confirmLabel: 'Upgrade Account',
      confirmClassName: 'bg-[#C5DC4B] text-black hover:brightness-105',
      showTierSelect: true,
      selectedTier: current >= 1 && current <= 3 ? current : 1,
      onConfirm: (tier) => runUpgradeCustomer(customer, tier),
    })
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

  const handleMerchantKycMeta = useCallback((meta) => {
    if (!meta) return
    setMerchantKycStatus(meta.status ?? null)
    setMerchantKycPending(Number(meta.pendingCount) || 0)
  }, [])

  const localMerchantKycKey = normalizeKycAggregateStatus(merchantKycStatus ?? merchant?.kyc_status)
  const { kycKey: merchantKycKey } = useKycDisplayStatus(merchant, localMerchantKycKey)

  if (merchantLoading && !merchant) {
    return (
      <div className="animate-fade-in-up mx-auto w-full max-w-[100vw] space-y-4 overflow-x-hidden px-3 pb-6 sm:space-y-6 sm:px-4 lg:px-0">
        <div className="h-6 w-48 max-w-full skeleton rounded-lg" />
        <div className="h-28 w-full skeleton rounded-card sm:h-32" />
        <div className="h-56 w-full skeleton rounded-card sm:h-64" />
      </div>
    )
  }

  if (merchantError || !merchant) {
    return (
      <div className="mx-auto flex w-full max-w-[100vw] flex-col items-center justify-center gap-4 overflow-x-hidden px-4 py-16 sm:py-24">
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
  const accountTypeLabel = typeStr === '—' ? '—' : `${String(typeStr).slice(0, 1).toUpperCase()}${String(typeStr).slice(1).toLowerCase()}`
  const showMerchantKycAlert =
    merchantKycKey === 'pending' || (Number(merchantKycPending) > 0 && merchantKycKey !== 'verified')

  const scrollToMerchantKyc = () => {
    setMenuOpen(false)
    document.getElementById('merchant-kyc')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToMerchantUdara = () => {
    setMenuOpen(false)
    document.getElementById('merchant-udara')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const openUdaraModal = () => {
    setMenuOpen(false)
    setUdaraModalOpen(true)
  }

  const udaraLinked = merchant?.udara360 != null && typeof merchant.udara360 === 'object'

  return (
    <div className="animate-fade-in-up mx-auto w-full max-w-[100vw] space-y-4 overflow-x-hidden px-3 pb-6 sm:space-y-6 sm:px-4 lg:px-0">
      {msg && (
        <div
          className={cn(
            'rounded-card border px-3 py-2.5 text-sm sm:px-4',
            msg.type === 'success' ? 'border-success/30 bg-success-bg text-success' : 'border-error/30 bg-error-bg text-error'
          )}
        >
          {msg.text}
        </div>
      )}

      {showMerchantKycAlert ? (
        <div className="flex flex-col gap-3 rounded-card border border-warning/40 bg-warning-bg/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-medium text-text-primary">Merchant KYC pending approval</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Scroll to the <strong>Merchant KYC approval</strong> section below the profile header to approve
                documents.
                {!canApproveMerchantKyc ? ' Your role needs kyc.update to approve.' : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={scrollToMerchantKyc}
            className="shrink-0 rounded-full bg-[#C5DC4B] px-4 py-2 text-xs font-semibold text-black hover:brightness-105"
          >
            Go to merchant KYC
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="inline-flex max-w-full min-w-0 items-center gap-2 self-start rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs text-text-muted sm:self-auto">
          <Link to="/merchants" className="inline-flex min-w-0 items-center gap-1 hover:text-accent">
            <ArrowLeft size={12} className="shrink-0" />
            <span className="truncate">Merchants</span>
          </Link>
          <span className="shrink-0 text-text-muted">›</span>
          <span className="truncate text-text-primary">Merchant profile</span>
        </div>
        <button
          type="button"
          onClick={scrollToMerchantKyc}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 sm:ml-auto sm:w-auto"
        >
          <ShieldCheck size={14} />
          Merchant KYC
          {merchantKycPending > 0 ? (
            <span className="rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-bold text-black">
              {merchantKycPending}
            </span>
          ) : null}
        </button>
        {canMutate && (
          <div className="relative w-full sm:w-auto sm:self-auto">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-3 py-2.5 text-xs text-text-secondary hover:bg-card-hover sm:w-auto sm:justify-center"
            >
              <MoreHorizontal size={16} />
              Actions
            </button>
            {menuOpen && (
              <>
                <button type="button" className="fixed inset-0 z-10 cursor-default bg-black/40" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 right-0 z-20 mt-1 max-h-[min(70vh,20rem)] overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-page py-1 shadow-lg sm:left-auto sm:right-0 sm:max-h-none sm:min-w-50 sm:max-w-none">
                  <button
                    type="button"
                    disabled={freezing}
                    onClick={handleFreeze}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-card-hover sm:py-2"
                  >
                    {freezing ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Snowflake size={14} className="shrink-0" />}
                    Freeze account
                  </button>
                  <button
                    type="button"
                    disabled={upgrading}
                    onClick={handleUpgradeTier}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-card-hover sm:py-2"
                  >
                    {upgrading ? <Loader2 size={14} className="animate-spin shrink-0" /> : <TrendingUp size={14} className="shrink-0" />}
                    Upgrade tier
                  </button>
                  <button
                    type="button"
                    onClick={scrollToMerchantKyc}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-card-hover sm:py-2"
                  >
                    <ShieldCheck size={14} className="shrink-0 text-accent" />
                    {showMerchantKycAlert && canApproveMerchantKyc
                      ? 'Approve merchant KYC'
                      : 'View merchant KYC'}
                  </button>
                  {canManageUdara ? (
                    <button
                      type="button"
                      onClick={udaraLinked ? openUdaraModal : scrollToMerchantUdara}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-card-hover sm:py-2"
                    >
                      <Link2 size={14} className="shrink-0 text-accent" />
                      {udaraLinked ? 'Update Udara credentials' : 'Link Udara account'}
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <section className="overflow-hidden rounded-card border border-white/8 bg-black px-3 py-4 sm:px-5 sm:py-5 md:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6 xl:gap-10">
          <div className="flex min-w-0 shrink-0 items-center gap-3 sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#14161c] text-[2rem] leading-none sm:h-[72px] sm:w-[72px] sm:text-[2.5rem]">
              {flag ? (
                <span aria-hidden>{flag}</span>
              ) : (
                <span className="text-lg text-text-muted sm:text-xl">—</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="min-w-0 text-balance text-base font-bold leading-tight tracking-tight text-white sm:text-lg md:text-xl">
                {merchant.name || '—'}
              </h1>
              <p className="mt-1 break-all text-xs text-text-secondary sm:text-sm">
                {email || '—'}
              </p>
              <p className="mt-1.5 break-all font-mono text-[11px] leading-snug text-[#7d8087] sm:text-[13px]">
                ID: {merchant.account_key || '—'}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 text-xs font-normal text-white md:flex-row md:flex-wrap md:items-center md:gap-x-1 md:text-sm">
            <span className="shrink-0 tabular-nums">{phone || '—'}</span>
            {merchantCustomerTotal != null ? (
              <>
                <ProfileDivider />
                <span className="shrink-0 tabular-nums">
                  {formatNumber(merchantCustomerTotal)} {merchantCustomerTotal === 1 ? 'Customer' : 'Customers'}
                </span>
              </>
            ) : null}
            <ProfileDivider />
            <span className="shrink-0">{tierLabel(merchant)}</span>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-4 border-t border-white/10 pt-4 min-[480px]:flex min-[480px]:flex-row min-[480px]:items-center min-[480px]:gap-8 min-[480px]:border-l min-[480px]:border-t-0 min-[480px]:pl-6 min-[480px]:pt-0 lg:pl-8 xl:pl-10">
            <div className="min-w-0 sm:min-w-30">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#6f747f]">Account Status</p>
              <div className="mt-2">
                {profileBannerPill(
                  accountStatusKey === 'active'
                    ? 'status-active'
                    : accountStatusKey === 'suspended'
                      ? 'status-suspended'
                      : 'status-inactive',
                  accountStatusKey === 'active' ? 'Active' : accountStatusKey === 'suspended' ? 'Suspended' : 'Inactive'
                )}
              </div>
            </div>
            <div className="min-w-0 sm:min-w-30">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#6f747f]">Account Type</p>
              <div className="mt-2">{profileBannerPill('type', accountTypeLabel)}</div>
            </div>
            <div className="min-w-0 sm:min-w-30">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#6f747f]">KYC Status</p>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={scrollToMerchantKyc}
                  className={cn(
                    'inline-flex rounded-full px-3 py-1 text-xs font-medium leading-none transition-opacity hover:opacity-90',
                    kycStatusPillClass(merchantKycKey)
                  )}
                  title="Jump to merchant KYC approval"
                >
                  {kycAggregateLabel(merchantKycKey)}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <MerchantUdaraPanel
        merchant={merchant}
        onMerchantRefresh={refetchMerchant}
        linkModalOpen={udaraModalOpen}
        onLinkModalOpenChange={setUdaraModalOpen}
      />

      <MerchantKycPanel
        accountKey={accountKey}
        merchantProfile={merchant}
        onKycMetaChange={handleMerchantKycMeta}
      />

      <div className="overflow-hidden rounded-card border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border px-3 py-3 sm:px-4 sm:py-4 lg:flex-row lg:items-center lg:gap-6">
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
          <MerchantCustomersTable
            customers={customers}
            onViewKyc={handleViewCustomerKyc}
            onFreezeAccount={handleFreezeCustomer}
            onUpgradeAccount={handleUpgradeCustomer}
          />
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

      {confirmState.open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm sm:p-6"
              role="presentation"
              onClick={closeConfirm}
            >
              {confirmState.variant === 'freeze' ? (
                <div
                  className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-[#2f2f2f] bg-[#141414] shadow-2xl"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="freeze-dialog-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 px-5 pt-5">
                    <h2 id="freeze-dialog-title" className="text-lg font-semibold leading-tight text-white">
                      {confirmState.title}
                    </h2>
                    <button
                      type="button"
                      onClick={closeConfirm}
                      className="rounded-lg p-1.5 text-[#9ca3af] transition-colors hover:bg-white/10 hover:text-white"
                      aria-label="Close"
                    >
                      <X size={18} strokeWidth={2} />
                    </button>
                  </div>
                  <div className="px-5 pb-1 pt-3">
                    <div className="rounded-xl border border-[#3a3a3a] bg-[#1a1a1a] px-4 py-4">
                      <p className="text-sm leading-relaxed text-[#e5e5e5]">{confirmState.message}</p>
                    </div>
                  </div>
                  <div className="flex items-stretch gap-3 px-5 pb-5 pt-4">
                    <button
                      type="button"
                      onClick={closeConfirm}
                      className="flex-1 rounded-xl border border-[#4b4b4b] bg-transparent py-3 text-sm font-medium text-[#d4d4d4] transition-colors hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const run = confirmState.onConfirm
                        closeConfirm()
                        if (run) await run()
                      }}
                      className={cn(
                        'min-w-[52%] flex-[1.35] rounded-full py-3 text-sm font-semibold transition-colors active:scale-[0.98]',
                        confirmState.confirmClassName
                      )}
                    >
                      {confirmState.confirmLabel}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-h-[calc(100vh-3rem)]"
                  role="dialog"
                  aria-modal="true"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-base font-semibold text-text-primary">{confirmState.title}</h3>
                  <p className="mt-2 text-sm text-text-secondary">{confirmState.message}</p>
                  {confirmState.showTierSelect ? (
                    <div className="mt-4">
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">Select Tier</label>
                      <select
                        value={confirmState.selectedTier}
                        onChange={(e) =>
                          setConfirmState((prev) => ({
                            ...prev,
                            selectedTier: Number(e.target.value),
                          }))
                        }
                        className="h-11 w-full appearance-none rounded-xl border border-[#313131] bg-[#181818] px-3 text-sm font-medium text-[#f7f7f7] outline-none transition-colors focus:border-[#717171]"
                      >
                        <option value={1}>Tier 1</option>
                        <option value={2}>Tier 2</option>
                        <option value={3}>Tier 3</option>
                      </select>
                    </div>
                  ) : null}
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeConfirm}
                      className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-card-hover"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const run = confirmState.onConfirm
                        const tier = confirmState.selectedTier
                        closeConfirm()
                        if (run) await run(tier)
                      }}
                      className={cn(
                        'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        confirmState.confirmClassName
                      )}
                    >
                      {confirmState.confirmLabel}
                    </button>
                  </div>
                </div>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
