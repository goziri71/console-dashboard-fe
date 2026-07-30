import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Loader2,
  Wallet,
  Users,
  Search,
  ChevronDown,
  Snowflake,
  Download,
  TrendingUp,
  Unlock,
  ShieldCheck,
} from 'lucide-react'
import {
  getCustomer,
  getCustomerMetrics,
  getCustomerWallets,
  patchCustomerTier,
  postCustomerFreeze,
  postCustomerUnfreeze,
  getCustomerKycs,
  approveCustomerBusinessKyc,
} from '../../services/customers'
import { useAuth } from '../../context/AuthContext'
import { canReadFinancial, canKycUpdate, canUpdateCustomerRecord } from '../../lib/permissions'
import { patchKycCompliance } from '../../services/kyc'
import KycApproveConfirmDialog from '../../components/kyc/KycApproveConfirmDialog'
import { kycKeyToUpper } from '../../lib/kycUi'
import { useKycDisplayStatus } from '../../hooks/useKycDisplayStatus'
import {
  isKycRowPending,
  kycRowReference,
  kycRowStatusKey,
} from '../../lib/kycUi'
import {
  cn,
  formatDate,
  formatNumber,
  formatNaira,
  formatBalance,
  exportToCsv,
  deriveRiskLevel,
  flagYes,
} from '../../lib/utils'
import Pagination from '../../components/ui/Pagination'
import { countryToFlagEmoji } from './merchantUi'
import {
  customerDisplayName,
  customerTierLabel,
  customerKycKey,
  customerAccountStatusKey,
  customerTypeLabel,
  getCustomerIdentifier,
  isBusinessCustomer,
  pickCustomerFromKycListResponse,
} from './merchantCustomerUi'
import { pickMerchantAccountKeyFromCustomer } from '../../lib/walletNavigation'
import CustomerWalletTransactionsPanel from './CustomerWalletTransactionsPanel'

const CAN_MUTATE = ['operations', 'compliance']
const WALLET_PAGE_SIZE = 8
const KYC_PAGE_SIZE = 10

function unwrapPayload(payload) {
  if (payload == null) return null
  if (typeof payload === 'object' && payload.data != null && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data
  }
  return payload
}

function pickRecords(res) {
  const body = res == null ? null : typeof res === 'object' ? res : null
  const inner = unwrapPayload(body) ?? body
  if (Array.isArray(inner?.records)) return inner.records
  if (Array.isArray(inner?.transactions)) return inner.transactions
  if (Array.isArray(inner?.items)) return inner.items
  if (Array.isArray(inner?.results)) return inner.results
  if (Array.isArray(inner?.data)) return inner.data
  if (Array.isArray(inner)) return inner
  return []
}

function pickPagination(res) {
  const inner = unwrapPayload(res) ?? res ?? {}
  const nested =
    inner.pagination ??
    inner.meta?.pagination ??
    (inner.meta && typeof inner.meta === 'object' && (inner.meta.total != null || inner.meta.last_page != null) ? inner.meta : null) ??
    {}
  const rootHints = {
    total: inner.total ?? inner.count,
    total_pages: inner.total_pages ?? inner.totalPages ?? inner.last_page ?? inner.lastPage,
    last_page: inner.last_page ?? inner.lastPage,
  }
  const merged = { ...rootHints, ...nested }
  if ((merged.total_pages == null || merged.total_pages === '') && merged.last_page != null) {
    const lp = Number(merged.last_page)
    if (Number.isFinite(lp) && lp > 0) merged.total_pages = lp
  }
  return merged
}

function inferTotalPagesFromResponse(res, limit, currentPage) {
  const rows = pickRecords(res)
  const pag = pickPagination(res)
  const tp = Number(pag.total_pages ?? pag.last_page ?? pag.lastPage)
  const total = Number(pag.total ?? pag.count)
  if (Number.isFinite(tp) && tp > 0) return tp
  if (Number.isFinite(total) && total > 0) return Math.max(1, Math.ceil(total / limit))
  if (rows.length < limit) return Math.max(1, currentPage)
  return Math.max(currentPage + 1, 2)
}

function pickKycField(row, keys) {
  if (!row || typeof row !== 'object') return '—'
  for (const k of keys) {
    const v = row[k]
    if (v != null && v !== '') return String(v)
  }
  return '—'
}

function pickKycRaw(row, keys) {
  if (!row || typeof row !== 'object') return null
  for (const k of keys) {
    const v = row[k]
    if (v != null && v !== '') return v
  }
  return null
}

function walletDisplayId(w) {
  const id = w.wallet_key
  if (!id) return '—'
  return String(id)
}

function formatWalletBalance(w, financial) {
  if (!financial) return '—'
  const raw = w.current_balance
  if (raw == null || raw === '') return '—'
  const code = (w.currency_code || 'NGN').toUpperCase()
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw)
  if (Number.isNaN(n)) return String(raw)
  if (code === 'NGN') return formatNaira(n)
  return formatBalance(n, code)
}

export default function CustomerDetailsPage() {
  const { accountKey: accountKeyParam, identifier: identifierParam } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const walletFromQuery =
    searchParams.get('wallet')?.trim() ||
    (typeof location.state?.walletKey === 'string' ? location.state.walletKey.trim() : '') ||
    null
  const { user } = useAuth()
  const financial = canReadFinancial(user?.permissions)
  const canMutate = CAN_MUTATE.includes(user?.role)
  const canPatchTier = canMutate && canUpdateCustomerRecord(user?.permissions)
  const canApproveKyc = canKycUpdate(user?.permissions, user?.role)

  const customerId = useMemo(() => (identifierParam ? decodeURIComponent(identifierParam) : ''), [identifierParam])

  const [customer, setCustomer] = useState(null)

  const merchantAccountKey = useMemo(() => {
    const fromCustomer = customer ? pickMerchantAccountKeyFromCustomer(customer, customerId) : ''
    return fromCustomer || accountKeyParam || ''
  }, [customer, customerId, accountKeyParam])

  /** Canonical customer id for wallets and transaction calls. */
  const statementIdentifier = useMemo(() => {
    if (!customerId) return ''
    if (!customer) return customerId
    return getCustomerIdentifier(customer) || customerId
  }, [customer, customerId])

  const [metrics, setMetrics] = useState({ total_wallets: 0, sub_accounts: 0, disputes: 0 })
  const [wallets, setWallets] = useState([])
  const [walletPage, setWalletPage] = useState(1)
  const [walletTotalPages, setWalletTotalPages] = useState(1)
  const [walletSearchInput, setWalletSearchInput] = useState('')
  const [walletSearch, setWalletSearch] = useState('')
  const [walletsLoading, setWalletsLoading] = useState(false)

  const [selectedWalletKey, setSelectedWalletKey] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)
  const [mutating, setMutating] = useState(false)
  const [freezeMenuOpen, setFreezeMenuOpen] = useState(false)
  const freezeMenuRef = useRef(null)

  const [kycRows, setKycRows] = useState([])
  const [kycPage, setKycPage] = useState(1)
  const [kycTotalPages, setKycTotalPages] = useState(1)
  const [kycTotal, setKycTotal] = useState(0)
  const [kycLoading, setKycLoading] = useState(false)
  const [kycApproving, setKycApproving] = useState(false)
  const [kycApproveConfirm, setKycApproveConfirm] = useState({
    open: false,
    mode: 'document',
    reference: '',
    compliant: 'Y',
  })

  useEffect(() => {
    setCustomer(null)
  }, [customerId, accountKeyParam])

  useEffect(() => {
    const t = window.setTimeout(() => setWalletSearch(walletSearchInput), 400)
    return () => window.clearTimeout(t)
  }, [walletSearchInput])

  useEffect(() => {
    setWalletPage(1)
  }, [walletSearch])

  useEffect(() => {
    setKycPage(1)
  }, [statementIdentifier])

  const loadWallets = useCallback(async () => {
    if (!statementIdentifier) return
    setWalletsLoading(true)
    try {
      const res = await getCustomerWallets(statementIdentifier, {
        page: walletPage,
        limit: WALLET_PAGE_SIZE,
        search: walletSearch.trim() || undefined,
      })
      const rows = pickRecords(res)
      setWallets(rows)
      const pag = pickPagination(res)
      const tp = pag.total_pages
      const total = pag.total
      setWalletTotalPages(
        Number.isFinite(Number(tp)) && Number(tp) > 0 ? Number(tp) : Math.max(1, Math.ceil(Number(total ?? rows.length) / WALLET_PAGE_SIZE))
      )
      const keys = rows.map((w) => w.wallet_key || w.wallet_id).filter(Boolean)
      setSelectedWalletKey((prev) => {
        const preferred = walletFromQuery || prev
        if (preferred) {
          if (keys.includes(preferred)) return preferred
          if (walletFromQuery && preferred === walletFromQuery) return walletFromQuery
        }
        if (prev && keys.includes(prev)) return prev
        return keys[0] ?? null
      })
    } catch {
      setWallets([])
      setWalletTotalPages(1)
    } finally {
      setWalletsLoading(false)
    }
  }, [statementIdentifier, walletPage, walletSearch, walletFromQuery])

  useEffect(() => {
    if (walletFromQuery) setSelectedWalletKey(walletFromQuery)
  }, [customerId, walletFromQuery])

  useEffect(() => {
    if (!customer || !customerId) return
    const merchantFromCustomer = pickMerchantAccountKeyFromCustomer(customer, customerId)
    if (!merchantFromCustomer) return
    if (accountKeyParam === merchantFromCustomer) return
    const qs = walletFromQuery ? `?wallet=${encodeURIComponent(walletFromQuery)}` : ''
    navigate(
      `/merchants/${encodeURIComponent(merchantFromCustomer)}/customers/${encodeURIComponent(customerId)}${qs}`,
      { replace: true, state: location.state }
    )
  }, [customer, customerId, accountKeyParam, walletFromQuery, navigate, location.state])

  const fetchCore = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    setError(null)

    try {
      const cRes = await getCustomer(customerId).catch(() => null)
      const customerPayload = unwrapPayload(cRes) ?? cRes
      setCustomer(customerPayload && typeof customerPayload === 'object' ? customerPayload : null)

      const apiCustomerId =
        customerPayload && typeof customerPayload === 'object'
          ? getCustomerIdentifier(customerPayload) || customerId
          : customerId

      const metRes = await getCustomerMetrics(apiCustomerId).catch(() => null)
      if (metRes) {
        const m = unwrapPayload(metRes) ?? metRes ?? {}
        setMetrics({
          total_wallets: Number(m.total_wallets ?? 0),
          sub_accounts: Number(m.sub_accounts ?? 0),
          disputes: Number(m.disputes ?? 0),
        })
      } else {
        setMetrics({ total_wallets: 0, sub_accounts: 0, disputes: 0 })
      }

      if (!customerPayload || typeof customerPayload !== 'object') {
        setError('Customer profile not found.')
      }
    } catch {
      setError('Failed to load customer.')
    } finally {
      setLoading(false)
    }
  }, [accountKeyParam, customerId])

  useEffect(() => {
    fetchCore()
  }, [fetchCore])

  useEffect(() => {
    if (!freezeMenuOpen) return
    const onDoc = (e) => {
      const w = freezeMenuRef.current
      if (w && !w.contains(e.target)) setFreezeMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [freezeMenuOpen])

  const loadKycs = useCallback(async () => {
    if (!statementIdentifier) return
    setKycLoading(true)
    try {
      const res = await getCustomerKycs(statementIdentifier, { page: kycPage, limit: KYC_PAGE_SIZE })
      const nestedCustomer = pickCustomerFromKycListResponse(res)
      if (nestedCustomer) {
        setCustomer((prev) => {
          if (!prev) return nestedCustomer
          const businessName = nestedCustomer.business_name ?? nestedCustomer.businessName
          const nextCompliant = nestedCustomer.is_business_compliant
          const nextStatus = nestedCustomer.kyc_status
          const nextType = nestedCustomer.type ?? nestedCustomer.customer_type
          const unchanged =
            (businessName == null || businessName === prev.business_name) &&
            (nextCompliant == null || nextCompliant === prev.is_business_compliant) &&
            (nextStatus == null || nextStatus === prev.kyc_status) &&
            (nextType == null || nextType === prev.type)
          if (unchanged) return prev
          return { ...prev, ...nestedCustomer }
        })
      }
      const rows = pickRecords(res)
      setKycRows(rows)
      const pag = pickPagination(res)
      const total = Number(pag.total ?? pag.count)
      setKycTotal(Number.isFinite(total) && total >= 0 ? total : rows.length)
      setKycTotalPages(inferTotalPagesFromResponse(res, KYC_PAGE_SIZE, kycPage))
    } catch {
      setKycRows([])
      setKycTotal(0)
      setKycTotalPages(1)
    } finally {
      setKycLoading(false)
    }
  }, [statementIdentifier, kycPage])

  const hasCustomer = Boolean(customer)

  useEffect(() => {
    if (!statementIdentifier || !hasCustomer) return
    loadKycs()
  }, [statementIdentifier, hasCustomer, loadKycs])

  useEffect(() => {
    if (!statementIdentifier || !hasCustomer) return
    loadWallets()
  }, [statementIdentifier, hasCustomer, loadWallets])

  const pushMsg = (type, text) => {
    setMsg({ type, text })
    window.setTimeout(() => setMsg(null), 4000)
  }

  const runApproveCustomerKyc = async () => {
    if (!canApproveKyc) return
    if (kycApproveConfirm.mode === 'document' && !kycApproveConfirm.reference) return
    setKycApproving(true)
    try {
      if (kycApproveConfirm.mode === 'business') {
        const id = statementIdentifier || customerId
        const compliant = kycApproveConfirm.compliant === 'N' ? 'N' : 'Y'
        const res = await approveCustomerBusinessKyc(id, { is_business_compliant: compliant })
        applyCustomerResponse(res)
        pushMsg(
          'success',
          compliant === 'Y' ? 'Business KYC marked compliant.' : 'Business KYC marked non-compliant.'
        )
      } else {
        await patchKycCompliance(kycApproveConfirm.reference, { is_compliant: 'Y' })
        pushMsg('success', 'KYC record approved successfully.')
      }
      setKycApproveConfirm({ open: false, mode: 'document', reference: '', compliant: 'Y' })
      await fetchCore()
      await loadKycs()
    } catch (err) {
      pushMsg('error', err.response?.data?.message || 'Failed to update KYC.')
    } finally {
      setKycApproving(false)
    }
  }

  const applyCustomerResponse = (res) => {
    const body = unwrapPayload(res) ?? res
    if (body && typeof body === 'object') {
      setCustomer((prev) => (prev ? { ...prev, ...body } : prev))
    }
  }

  const runFreeze = async (scope) => {
    if (!customer || !canMutate) return
    const id = statementIdentifier || customerId
    const labels = {
      full: 'full freeze (PND + PNC)',
      debit_only: 'debit-only restriction (PND)',
      credit_only: 'credit-only restriction (PNC)',
    }
    if (!window.confirm(`Apply ${labels[scope] || scope} to ${displayName}?`)) return
    setFreezeMenuOpen(false)
    setMutating(true)
    try {
      const res = await postCustomerFreeze(id, { scope })
      applyCustomerResponse(res)
      pushMsg('success', 'Restriction updated.')
      void fetchCore()
    } catch (e) {
      pushMsg('error', e?.response?.data?.message || 'Failed to apply freeze.')
    } finally {
      setMutating(false)
    }
  }

  const handleUnfreeze = async () => {
    if (!customer || !canMutate) return
    if (!window.confirm(`Remove PND/PNC restrictions for ${displayName}?`)) return
    setMutating(true)
    try {
      const res = await postCustomerUnfreeze(statementIdentifier || customerId)
      applyCustomerResponse(res)
      pushMsg('success', 'Account unfrozen.')
      void fetchCore()
    } catch (e) {
      pushMsg('error', e?.response?.data?.message || 'Failed to unfreeze.')
    } finally {
      setMutating(false)
    }
  }

  const handleUpgradeTier = async () => {
    if (!customer || !canPatchTier) return
    const current = Number(customer.tier ?? customer.default_kyc_tier ?? 1)
    const next = Number.isFinite(current) ? current + 1 : 2
    if (next > 3) {
      pushMsg('error', 'Customer is already at the maximum tier (3).')
      return
    }
    if (!window.confirm(`Upgrade ${displayName} to tier ${next}?`)) return
    setMutating(true)
    try {
      const res = await patchCustomerTier(statementIdentifier || customerId, { tier: next })
      applyCustomerResponse(res)
      pushMsg('success', `Tier updated to ${next}.`)
      void fetchCore()
    } catch (e) {
      pushMsg('error', e?.response?.data?.message || 'Failed to upgrade tier.')
    } finally {
      setMutating(false)
    }
  }

  const handleExportCustomer = () => {
    if (!customer) return
    const rows = [
      {
        identifier: customer.identifier ?? customerId,
        name: customerDisplayName(customer),
        email: customer.email_address ?? '',
        phone: customer.phone_number ?? '',
        tier: customer.tier ?? customer.default_kyc_tier ?? '',
        status: customer.status ?? '',
        kyc_status: customer.kyc_status ?? '',
      },
      ...wallets.map((w) => ({
        wallet_key: w.wallet_key || w.wallet_id,
        currency: w.currency_code ?? '',
        balance: w.current_balance ?? '',
      })),
    ]
    exportToCsv(rows, `customer-${customerId.slice(0, 8)}.csv`)
  }

  const displayName = useMemo(() => (customer ? customerDisplayName(customer) : '—'), [customer])
  const displayNameUpper = useMemo(() => (displayName === '—' ? '—' : displayName.toUpperCase()), [displayName])
  const flag = countryToFlagEmoji(customer?.country_code ?? customer?.country)
  const selectedWallet = useMemo(
    () => wallets.find((w) => (w.wallet_key || w.wallet_id) === selectedWalletKey) || null,
    [wallets, selectedWalletKey]
  )
  const isBusiness = customer ? isBusinessCustomer(customer) : false
  const localKycKey = customer ? customerKycKey(customer) : 'none'
  const { kycKey } = useKycDisplayStatus(isBusiness ? null : customer, localKycKey)
  const acctKey = customer ? customerAccountStatusKey(customer) : 'active'
  const tierLine = customer ? customerTierLabel(customer) : '—'
  const typeRaw = customer ? customerTypeLabel(customer) : '—'
  const typeDisplay = typeRaw === '—' ? '—' : String(typeRaw).toUpperCase()

  const kycUpper = kycKeyToUpper(kycKey)

  const accountUpper =
    acctKey === 'active' ? 'ACTIVE' : acctKey === 'suspended' ? 'SUSPENDED' : acctKey === 'inactive' ? 'INACTIVE' : 'PENDING'

  const riskKey = customer ? deriveRiskLevel(customer) : 'low'
  const riskUpper = riskKey === 'high' ? 'HIGH' : riskKey === 'medium' ? 'MEDIUM' : 'LOW'

  const phone = customer?.phone_number ?? customer?.phone ?? '—'
  const email = customer?.email_address ?? customer?.email ?? '—'
  const idLine = customer?.identifier ?? customer?.id ?? customerId
  const selectedWalletBankDetails = Array.isArray(selectedWallet?.ngn_deposit_accounts)
    ? selectedWallet.ngn_deposit_accounts[0]
    : null
  const selectedWalletCryptoDetails = Array.isArray(selectedWallet?.crypto_deposit_addresses)
    ? selectedWallet.crypto_deposit_addresses[0]
    : null
  const selectedWalletAccountNumber =
    selectedWalletBankDetails?.account_number ??
    selectedWallet?.account_number ??
    selectedWallet?.bank_account_number ??
    selectedWallet?.virtual_account_number ??
    ''
  const selectedWalletBankSlug = selectedWalletBankDetails?.bank_slug ?? selectedWallet?.bank_slug ?? selectedWallet?.bank_code ?? ''
  const selectedWalletCryptoAddress =
    selectedWalletCryptoDetails?.address ??
    selectedWalletCryptoDetails?.wallet_address ??
    selectedWalletCryptoDetails?.deposit_address ??
    selectedWallet?.wallet_address ??
    ''
  const selectedWalletCurrency = String(selectedWallet?.currency_code || '').toUpperCase()
  const isCryptoWallet = selectedWalletCurrency !== 'NGN'
  const walletMetaLine = isCryptoWallet
    ? `Wallet: ${selectedWalletKey || '—'} | Address: ${selectedWalletCryptoAddress || '—'}`
    : `Wallet: ${selectedWalletKey || '—'} | Acct: ${selectedWalletAccountNumber || '—'} | Bank: ${selectedWalletBankSlug || '—'}`

  const currentTier = useMemo(() => {
    const t = Number(customer?.tier ?? customer?.default_kyc_tier ?? 1)
    if (Number.isFinite(t) && t >= 1 && t <= 3) return t
    return 1
  }, [customer])

  const isRestricted = useMemo(
    () => (customer ? flagYes(customer.is_pnd) || flagYes(customer.is_pnc) : false),
    [customer]
  )

  if (loading && !customer) {
    return (
      <div className="animate-fade-in-up space-y-6">
        <div className="h-6 w-56 skeleton rounded-lg" />
        <div className="h-40 skeleton rounded-card" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 skeleton rounded-card" />
          ))}
        </div>
        <div className="h-72 skeleton rounded-card" />
      </div>
    )
  }

  if (!loading && (error || !customer)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertCircle className="text-error" size={36} />
        <p className="text-sm text-text-secondary">{error || 'Customer not found.'}</p>
        <button
          type="button"
          onClick={() => fetchCore()}
          className="inline-flex items-center gap-2 rounded-button border border-border px-4 py-2 text-sm text-text-primary hover:bg-card-hover"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up min-w-0 max-w-full space-y-6">
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
        <div className="inline-flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <Link to={`/merchants/${merchantAccountKey}`} className="hover:text-accent">
            Customer
          </Link>
          <span className="text-text-muted">›</span>
          <span className="font-medium text-text-primary">Customer Profile</span>
          <Link
            to={`/merchants/${merchantAccountKey}/customers/${encodeURIComponent(customerId)}/kyc`}
            className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent/40 hover:bg-card-hover"
          >
            <ShieldCheck size={14} className="text-accent" />
            View KYC
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void fetchCore()
              void loadWallets()
              void loadKycs()
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs text-text-secondary hover:bg-card-hover disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-card border border-white/10 bg-[#0a0a0a]">
        <div className="flex flex-col gap-4 border-b border-white/8 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#111318] text-[2.35rem] leading-none">
              {flag ? (
                <span aria-hidden>{flag}</span>
              ) : (
                <span className="text-2xl font-semibold text-white">{displayName.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold uppercase tracking-wide text-white sm:text-2xl">{displayNameUpper}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="font-mono text-[13px] text-[#888888]">ID: {idLine}</p>
              </div>
              <p className="mt-1 break-all text-[11px] text-[#BAD133]">
                {walletMetaLine}
              </p>
            </div>
          </div>
          {canMutate ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <div className="relative" ref={freezeMenuRef}>
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => setFreezeMenuOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-transparent px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-white/6 disabled:opacity-60"
                  aria-expanded={freezeMenuOpen}
                  aria-haspopup="menu"
                >
                  <Snowflake size={14} />
                  Freeze
                  <ChevronDown size={14} className="opacity-80" />
                </button>
                {freezeMenuOpen ? (
                  <div
                    className="absolute right-0 top-full z-30 mt-1 min-w-[240px] overflow-hidden rounded-xl border border-white/15 bg-[#141414] py-1 text-left shadow-xl"
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full px-3 py-2.5 text-left text-xs text-white transition-colors hover:bg-white/10"
                      onClick={() => runFreeze('full')}
                    >
                      Full freeze (PND + PNC)
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full px-3 py-2.5 text-left text-xs text-white transition-colors hover:bg-white/10"
                      onClick={() => runFreeze('debit_only')}
                    >
                      Debit only (PND)
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full px-3 py-2.5 text-left text-xs text-white transition-colors hover:bg-white/10"
                      onClick={() => runFreeze('credit_only')}
                    >
                      Credit only (PNC)
                    </button>
                  </div>
                ) : null}
              </div>
              {isRestricted ? (
                <button
                  type="button"
                  disabled={mutating}
                  onClick={handleUnfreeze}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-transparent px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-white/6 disabled:opacity-60"
                >
                  <Unlock size={14} />
                  Unfreeze
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleExportCustomer}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-transparent px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-white/6"
              >
                <Download size={14} />
                Export Customer Data
              </button>
              {canPatchTier ? (
                <button
                  type="button"
                  disabled={mutating || currentTier >= 3}
                  onClick={handleUpgradeTier}
                  className="inline-flex items-center gap-2 rounded-full border border-transparent bg-[#C5DC4B] px-4 py-2.5 text-xs font-semibold text-black shadow-sm transition-colors hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
                >
                  {mutating ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                  Upgrade Tier
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleExportCustomer}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-transparent px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-white/6"
            >
              <Download size={14} />
              Export Customer Data
            </button>
          )}
        </div>

        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="flex min-w-0 flex-wrap items-center gap-x-0 gap-y-2 text-sm text-white">
            <span className="shrink-0 tabular-nums">{phone}</span>
            <span className="mx-3 hidden h-3.5 w-px shrink-0 bg-white/20 sm:inline" aria-hidden />
            <span className="min-w-0 break-all">{email}</span>
            <span className="mx-3 hidden h-3.5 w-px shrink-0 bg-white/20 sm:inline" aria-hidden />
            <span className="shrink-0">{tierLine}</span>
          </div>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4 sm:gap-x-10">
            <div className="min-w-[72px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888888]">Account Type</p>
              <p className="mt-1 text-sm font-bold uppercase tracking-wide text-[#c084fc]">{typeDisplay}</p>
            </div>
            <div className="min-w-[72px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888888]">KYC Status</p>
              <p
                className={cn(
                  'mt-1 text-sm font-bold uppercase tracking-wide',
                  kycKey === 'verified' ? 'text-[#22c55e]' : kycKey === 'pending' ? 'text-[#f59e0b]' : 'text-[#888888]'
                )}
              >
                {kycUpper}
              </p>
            </div>
            <div className="min-w-[72px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888888]">Account Status</p>
              <p
                className={cn(
                  'mt-1 text-sm font-bold uppercase tracking-wide',
                  acctKey === 'active' ? 'text-[#22c55e]' : acctKey === 'suspended' ? 'text-[#f87171]' : 'text-[#888888]'
                )}
              >
                {accountUpper}
              </p>
            </div>
            <div className="min-w-[72px]">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888888]">Risk Level</p>
              <p
                className={cn(
                  'mt-1 text-sm font-bold uppercase tracking-wide',
                  riskKey === 'high' ? 'text-[#f87171]' : riskKey === 'medium' ? 'text-[#f59e0b]' : 'text-[#888888]'
                )}
              >
                {riskUpper}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-4 rounded-card border border-white/6 bg-[#141414] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C5DC4B]/25 text-white">
              <Wallet size={18} strokeWidth={2} />
            </div>
            <span className="text-xs text-[#888888]">Total Wallets</span>
          </div>
          <p className="text-3xl font-bold tabular-nums leading-none text-white">{formatNumber(metrics.total_wallets)}</p>
        </div>
        <div className="flex flex-col gap-4 rounded-card border border-white/6 bg-[#141414] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#14532d] text-white">
              <Users size={18} strokeWidth={2} />
            </div>
            <span className="text-xs text-[#888888]">Sub-accounts</span>
          </div>
          <p className="text-3xl font-bold tabular-nums leading-none text-white">{formatNumber(metrics.sub_accounts)}</p>
        </div>
        <div className="flex flex-col gap-4 rounded-card border border-white/6 bg-[#141414] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ea580c] text-white">
              <AlertCircle size={18} strokeWidth={2} />
            </div>
            <span className="text-xs text-[#888888]">Disputes</span>
          </div>
          <p className="text-3xl font-bold tabular-nums leading-none text-white">{formatNumber(metrics.disputes)}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-card border border-border/70 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              {isBusiness ? 'Business KYC' : 'KYC records'}
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              {isBusiness
                ? 'Compliance status for this business customer (is_business_compliant)'
                : 'Verification history for this customer'}
            </p>
          </div>
          <Link
            to={`/merchants/${merchantAccountKey}/customers/${encodeURIComponent(customerId)}/kyc`}
            className="text-xs font-medium text-accent hover:underline"
          >
            Open full KYC page
          </Link>
        </div>

        {isBusiness ? (
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-text-muted">Business name</p>
              <p className="mt-0.5 text-sm font-medium text-text-primary">{displayName}</p>
              <p className="mt-2 text-xs text-text-muted">
                Status:{' '}
                <span
                  className={cn(
                    'font-semibold uppercase',
                    kycKey === 'verified' ? 'text-success' : 'text-warning'
                  )}
                >
                  {kycKey === 'verified' ? 'Verified' : 'Pending'}
                </span>
              </p>
            </div>
            {canApproveKyc ? (
              <div className="flex flex-wrap gap-2">
                {kycKey !== 'verified' ? (
                  <button
                    type="button"
                    disabled={kycApproving}
                    onClick={() =>
                      setKycApproveConfirm({
                        open: true,
                        mode: 'business',
                        reference: '',
                        compliant: 'Y',
                      })
                    }
                    className="rounded-lg bg-[#C5DC4B] px-3 py-1.5 text-xs font-semibold text-black hover:brightness-105 disabled:opacity-50"
                  >
                    Approve
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={kycApproving}
                  onClick={() =>
                    setKycApproveConfirm({
                      open: true,
                      mode: 'business',
                      reference: '',
                      compliant: 'N',
                    })
                  }
                  className="rounded-lg border border-error/40 px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/10 disabled:opacity-50"
                >
                  Mark non-compliant
                </button>
              </div>
            ) : (
              <p className="text-xs text-text-muted">Requires kyc.update to change status.</p>
            )}
          </div>
        ) : null}

        {kycLoading ? (
          <div className="flex flex-col gap-2 px-4 py-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : kycRows.length ? (
          <>
            <div className="table-scroll px-2 pb-2">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs text-text-muted">
                    <th className="px-3 py-2.5 font-medium">Document Number</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Created</th>
                    {canApproveKyc && !isBusiness ? (
                      <th className="px-3 py-2.5 font-medium w-24" />
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {kycRows.map((row, ri) => {
                    const reference = kycRowReference(row)
                    const pending = isKycRowPending(row)
                    const sk = kycRowStatusKey(row)
                    const idNumber =
                      pickKycRaw(row, [
                        'identification_number',
                        'document_number',
                        'bvn',
                        'tin',
                        'registration_number',
                      ]) || '—'
                    return (
                      <tr key={reference || row.id || row.kyc_id || ri} className="border-b border-border/40">
                        <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">
                          {idNumber}
                        </td>
                        <td className="px-3 py-2.5 text-text-primary capitalize">
                          {pickKycField(row, ['compliance_status', 'status', 'kyc_status', 'verification_status']) ||
                            sk}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-text-muted">
                          {(() => {
                            const d = pickKycRaw(row, ['date_created', 'created_at', 'date_modified'])
                            return d != null ? formatDate(d) : '—'
                          })()}
                        </td>
                        {canApproveKyc && !isBusiness ? (
                          <td className="px-3 py-2.5">
                            {pending && reference ? (
                              <button
                                type="button"
                                disabled={kycApproving}
                                onClick={() =>
                                  setKycApproveConfirm({
                                    open: true,
                                    mode: 'document',
                                    reference,
                                    compliant: 'Y',
                                  })
                                }
                                className="rounded-lg bg-[#C5DC4B] px-2.5 py-1 text-[11px] font-semibold text-black hover:brightness-105 disabled:opacity-50"
                              >
                                Approve
                              </button>
                            ) : (
                              <span className="text-xs text-text-muted">—</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={kycPage}
              totalPages={kycTotalPages}
              total={kycTotal}
              limit={KYC_PAGE_SIZE}
              label="KYC records"
              onPageChange={setKycPage}
            />
          </>
        ) : (
          <p className="py-10 text-center text-sm text-text-muted">No KYC records returned.</p>
        )}
      </section>

      <section className="min-w-0 overflow-hidden rounded-card border border-border/70 bg-card">
        <div className="grid min-h-0 min-w-0 grid-cols-1 divide-y divide-border/60 lg:max-h-[min(640px,calc(100dvh-260px))] lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] lg:grid-rows-1 lg:divide-x lg:divide-y-0 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
          <div className="flex min-h-0 min-w-0 flex-col bg-[#0b0d11] p-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                placeholder="Search Wallets..."
                value={walletSearchInput}
                onChange={(e) => setWalletSearchInput(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-[#11141b] py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
              />
            </div>
            <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 lg:max-h-none">
              {walletsLoading ? (
                <div className="space-y-2 py-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="skeleton h-[72px] w-full rounded-xl" />
                  ))}
                </div>
              ) : wallets.length ? (
                wallets.map((w, wi) => {
                  const wk = w.wallet_key || w.wallet_id
                  const selected = wk && selectedWalletKey === wk
                  return (
                    <button
                      key={wk || `w-${wi}`}
                      type="button"
                      onClick={() => {
                        if (!wk) return
                        setSelectedWalletKey(wk)
                      }}
                      className={cn(
                        'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                        selected
                          ? 'border-accent bg-[#12170c] ring-1 ring-accent/60'
                          : 'border-border/70 bg-[#0d1016] hover:border-border hover:bg-[#11151d]'
                      )}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Wallet Key</p>
                      <p className="mt-0.5 break-all font-mono text-xs text-text-primary">{walletDisplayId(w)}</p>
                      <p className="mt-2 text-[24px] font-normal tabular-nums leading-none text-[#dfe4ec]">{formatWalletBalance(w, financial)}</p>
                    </button>
                  )
                })
              ) : (
                <p className="py-10 text-center text-sm text-text-muted">No wallets found.</p>
              )}
            </div>
            <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-[10px] text-text-muted">
              <span className="min-w-0">
                Page {walletPage} of {walletTotalPages}
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={walletPage <= 1 || walletsLoading}
                  onClick={() => setWalletPage((p) => Math.max(1, p - 1))}
                  className="rounded-full border border-border px-3 py-1 text-[10px] text-text-secondary hover:bg-card-hover disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={walletPage >= walletTotalPages || walletsLoading}
                  onClick={() => setWalletPage((p) => p + 1)}
                  className="rounded-full border border-border px-3 py-1 text-[10px] text-text-secondary hover:bg-card-hover disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <div className="flex min-h-[280px] min-w-0 flex-col bg-[#090b0f] p-0 lg:min-h-0">
            <CustomerWalletTransactionsPanel
              customerIdentifier={statementIdentifier}
              merchantAccountKey={merchantAccountKey}
              walletKey={selectedWalletKey}
              financial={financial}
            />
          </div>
        </div>
      </section>

      <div className="flex justify-center pb-4">
        <Link
          to="/merchants"
          className="inline-flex items-center gap-2 text-xs text-text-muted hover:text-accent"
        >
          <ArrowLeft size={12} />
          Back to Merchants
        </Link>
      </div>

      <KycApproveConfirmDialog
        open={kycApproveConfirm.open}
        title={
          kycApproveConfirm.mode === 'business'
            ? kycApproveConfirm.compliant === 'N'
              ? 'Mark business KYC non-compliant'
              : 'Approve business KYC'
            : 'Approve KYC'
        }
        message={
          kycApproveConfirm.mode === 'business'
            ? kycApproveConfirm.compliant === 'N'
              ? `Mark ${displayName} as non-compliant (is_business_compliant = N)?`
              : `Approve business KYC for ${displayName}? This sets is_business_compliant = Y.`
            : `Approve KYC record ${kycApproveConfirm.reference}?`
        }
        confirmLabel={
          kycApproveConfirm.mode === 'business' && kycApproveConfirm.compliant === 'N'
            ? 'Mark non-compliant'
            : 'Approve'
        }
        confirmClassName={
          kycApproveConfirm.mode === 'business' && kycApproveConfirm.compliant === 'N'
            ? 'bg-error text-white hover:brightness-105'
            : 'bg-[#C5DC4B] text-black hover:brightness-105'
        }
        loading={kycApproving}
        onCancel={() =>
          !kycApproving &&
          setKycApproveConfirm({ open: false, mode: 'document', reference: '', compliant: 'Y' })
        }
        onConfirm={runApproveCustomerKyc}
      />
    </div>
  )
}
