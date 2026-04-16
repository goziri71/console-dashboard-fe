import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Loader2,
  Wallet,
  Users,
  Search,
  ChevronRight,
  Snowflake,
  Download,
  TrendingUp,
} from 'lucide-react'
import {
  getCustomer,
  getCustomerMetrics,
  getCustomerWallets,
  getCustomerWalletLedger,
  patchCustomer,
} from '../../services/customers'
import { getMerchantCustomerTransactions } from '../../services/merchants'
import { getDisputes, getDisputesSummary } from '../../services/disputes'
import { useAuth } from '../../context/AuthContext'
import { canReadFinancial } from '../../lib/permissions'
import {
  cn,
  formatDate,
  formatNumber,
  formatNaira,
  formatBalance,
  exportToCsv,
  deriveRiskLevel,
} from '../../lib/utils'
import { countryToFlagEmoji } from './merchantUi'
import {
  customerDisplayName,
  customerTierLabel,
  customerKycKey,
  customerAccountStatusKey,
  customerTypeLabel,
  getCustomerIdentifier,
} from './merchantCustomerUi'

const CAN_MUTATE = ['operations', 'compliance']
const WALLET_PAGE_SIZE = 8
const LEDGER_PAGE_SIZE = 15
/** Statement lists all wallets for the customer; larger page = fewer round-trips vs API default caps. */
const STATEMENT_PAGE_SIZE = 100

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

function normalizeDisputesSummary(payload) {
  const d = unwrapPayload(payload) ?? payload ?? {}
  return {
    total: Number(d.total ?? 0),
    in_review: Number(d.in_review ?? 0),
    escalated: Number(d.escalated ?? 0),
    resolved: Number(d.resolved ?? 0),
  }
}

function dotBadge(type, label) {
  const styles = {
    active: 'bg-success-bg text-success border-success/20',
    verified: 'bg-success-bg text-success border-success/20',
    medium: 'bg-warning-bg text-warning border-warning/20',
    processing: 'bg-[#072a66] text-[#2970ff] border-[#1d4ed8]/30',
    completed: 'bg-success-bg text-success border-success/20',
    failed: 'bg-[#5b1f1f] text-[#fca5a5] border-[#ef4444]/30',
    inactive: 'bg-card-hover text-text-muted border-border',
    pending: 'bg-warning-bg text-warning border-warning/20',
  }
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium', styles[type] || styles.inactive)}>
      {label}
    </span>
  )
}

function ledgerStatusKind(status) {
  const s = String(status || '')
    .toLowerCase()
    .trim()
  if (s.includes('fail') || s.includes('declin')) return { kind: 'failed', label: 'Failed' }
  if (s.includes('success') || s.includes('complete')) return { kind: 'completed', label: 'Completed' }
  if (s.includes('pend')) return { kind: 'pending', label: 'Pending' }
  return { kind: 'processing', label: status || 'Processing' }
}

function ledgerStatusPill(kind, label) {
  const styles = {
    completed: 'border-[#0b5c39] bg-[#053321] text-[#17b26a]',
    pending: 'border-[#b45309] bg-[#f59e0b] text-[#271406]',
    failed: 'border-[#7f1d1d] bg-[#d98282] text-[#3f1111]',
    processing: 'border-[#1d4ed8]/40 bg-[#072a66] text-[#60a5fa]',
    inactive: 'border-border bg-card-hover text-text-muted',
  }
  return (
    <span className={cn('inline-flex min-w-[74px] items-center justify-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium', styles[kind] || styles.inactive)}>
      {label}
    </span>
  )
}

function statementStatusKind(status) {
  const s = String(status || '')
    .toLowerCase()
    .trim()
  if (s.includes('fail') || s.includes('declin')) return { kind: 'failed', label: 'Failed' }
  if (s.includes('success') || s === 'completed') return { kind: 'completed', label: 'Completed' }
  if (s.includes('inactive') || s.includes('void')) return { kind: 'inactive', label: 'Inactive' }
  if (s.includes('pend') || s.includes('process')) return { kind: 'processing', label: 'Processing' }
  return { kind: 'processing', label: status || 'Processing' }
}

function walletDisplayId(w) {
  const id = w.wallet_id || w.wallet_key
  if (!id) return '—'
  if (String(id).length <= 24) return String(id)
  return `${String(id).slice(0, 10)}…${String(id).slice(-6)}`
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
  const { accountKey, identifier: identifierParam } = useParams()
  const { user } = useAuth()
  const financial = canReadFinancial(user?.permissions)
  const canMutate = CAN_MUTATE.includes(user?.role)

  const customerId = useMemo(() => (identifierParam ? decodeURIComponent(identifierParam) : ''), [identifierParam])

  const [customer, setCustomer] = useState(null)

  /** Canonical customer id for wallets, ledger, disputes, and GET /merchants/.../customers/.../transactions (all wallets). */
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

  const [statementRows, setStatementRows] = useState([])
  const [statementPage, setStatementPage] = useState(1)
  const [statementTotalPages, setStatementTotalPages] = useState(1)
  const [statementLoading, setStatementLoading] = useState(false)
  const [statementFetchKey, setStatementFetchKey] = useState(0)
  const [disputeSummary, setDisputeSummary] = useState({ total: 0, in_review: 0, escalated: 0, resolved: 0 })
  const [disputeRows, setDisputeRows] = useState([])
  const [selectedWalletKey, setSelectedWalletKey] = useState(null)
  const [ledgerRows, setLedgerRows] = useState([])
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [statementNote, setStatementNote] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mainTab, setMainTab] = useState('transactions')
  const [msg, setMsg] = useState(null)
  const [mutating, setMutating] = useState(false)

  const ledgerScopeRef = useRef('')

  useEffect(() => {
    setCustomer(null)
  }, [customerId, accountKey])

  useEffect(() => {
    const t = window.setTimeout(() => setWalletSearch(walletSearchInput), 400)
    return () => window.clearTimeout(t)
  }, [walletSearchInput])

  useEffect(() => {
    setWalletPage(1)
  }, [walletSearch])

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
        if (prev && keys.includes(prev)) return prev
        return keys[0] ?? null
      })
    } catch {
      setWallets([])
      setWalletTotalPages(1)
    } finally {
      setWalletsLoading(false)
    }
  }, [statementIdentifier, walletPage, walletSearch])

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

      const [metRes, sumRes, listRes] = await Promise.allSettled([
        getCustomerMetrics(apiCustomerId),
        getDisputesSummary({ identifier: apiCustomerId, account_key: accountKey }),
        getDisputes({ identifier: apiCustomerId, account_key: accountKey, page: 1, limit: 25 }),
      ])

      if (metRes.status === 'fulfilled') {
        const m = unwrapPayload(metRes.value) ?? metRes.value ?? {}
        setMetrics({
          total_wallets: Number(m.total_wallets ?? 0),
          sub_accounts: Number(m.sub_accounts ?? 0),
          disputes: Number(m.disputes ?? 0),
        })
      } else {
        setMetrics({ total_wallets: 0, sub_accounts: 0, disputes: 0 })
      }

      if (sumRes.status === 'fulfilled') {
        setDisputeSummary(normalizeDisputesSummary(sumRes.value))
      } else {
        setDisputeSummary({ total: 0, in_review: 0, escalated: 0, resolved: 0 })
      }

      if (listRes.status === 'fulfilled') {
        setDisputeRows(pickRecords(listRes.value))
      } else {
        setDisputeRows([])
      }

      if (!customerPayload || typeof customerPayload !== 'object') {
        setError('Customer profile not found.')
      }
    } catch {
      setError('Failed to load customer.')
    } finally {
      setLoading(false)
    }
  }, [accountKey, customerId])

  useEffect(() => {
    fetchCore()
  }, [fetchCore])

  useEffect(() => {
    if (!statementIdentifier || !customer) return
    loadWallets()
  }, [statementIdentifier, customer, loadWallets])

  useEffect(() => {
    setStatementPage(1)
    setStatementRows([])
  }, [customerId, accountKey, statementIdentifier])

  useEffect(() => {
    if (!statementIdentifier || !accountKey) {
      setStatementRows([])
      setStatementTotalPages(1)
      setStatementNote(null)
      setStatementLoading(false)
      return
    }
    if (!financial) {
      setStatementRows([])
      setStatementTotalPages(1)
      setStatementLoading(false)
      setStatementNote('Financial statement requires financial.read permission.')
      return
    }

    let cancelled = false
    setStatementLoading(true)
    setStatementNote(null)
    getMerchantCustomerTransactions(accountKey, statementIdentifier, {
      page: statementPage,
      limit: STATEMENT_PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return
        const rows = pickRecords(res)
        setStatementRows(rows)
        setStatementTotalPages(inferTotalPagesFromResponse(res, STATEMENT_PAGE_SIZE, statementPage))
      })
      .catch((e) => {
        if (!cancelled) {
          setStatementRows([])
          setStatementTotalPages(1)
          setStatementNote(e?.response?.data?.message || 'Unable to load transaction statement.')
        }
      })
      .finally(() => {
        if (!cancelled) setStatementLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountKey, financial, statementFetchKey, statementIdentifier, statementPage])

  useEffect(() => {
    if (!statementIdentifier || !selectedWalletKey || !financial) {
      setLedgerRows([])
      setLedgerTotalPages(1)
      ledgerScopeRef.current = ''
      return
    }

    const scopeKey = `${statementIdentifier}:${selectedWalletKey}`
    if (ledgerScopeRef.current !== scopeKey) {
      ledgerScopeRef.current = scopeKey
      if (ledgerPage !== 1) {
        setLedgerPage(1)
        return
      }
    }

    let cancelled = false
    setLedgerLoading(true)
    getCustomerWalletLedger(statementIdentifier, selectedWalletKey, { page: ledgerPage, limit: LEDGER_PAGE_SIZE })
      .then((res) => {
        if (cancelled) return
        const rows = pickRecords(res)
        setLedgerRows(rows)
        setLedgerTotalPages(inferTotalPagesFromResponse(res, LEDGER_PAGE_SIZE, ledgerPage))
      })
      .catch(() => {
        if (!cancelled) {
          setLedgerRows([])
          setLedgerTotalPages(1)
        }
      })
      .finally(() => {
        if (!cancelled) setLedgerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [statementIdentifier, selectedWalletKey, financial, ledgerPage])

  const pushMsg = (type, text) => {
    setMsg({ type, text })
    window.setTimeout(() => setMsg(null), 4000)
  }

  const handleFreeze = async () => {
    if (!customer || !canMutate) return
    if (!window.confirm(`Place post-no-debit restriction on ${displayName}?`)) return
    setMutating(true)
    try {
      const res = await patchCustomer(statementIdentifier || customerId, { is_pnd: '1' })
      const body = unwrapPayload(res) ?? res
      setCustomer((prev) => ({ ...prev, ...body }))
      pushMsg('success', 'Customer updated.')
    } catch (e) {
      pushMsg('error', e?.response?.data?.message || 'Failed to freeze account.')
    } finally {
      setMutating(false)
    }
  }

  const handleUpgradeTier = async () => {
    if (!customer || !canMutate) return
    const current = Number(customer.tier ?? customer.default_kyc_tier ?? 1)
    const next = Number.isFinite(current) ? current + 1 : 2
    if (!window.confirm(`Upgrade ${displayName} to tier ${next}?`)) return
    setMutating(true)
    try {
      const res = await patchCustomer(statementIdentifier || customerId, { tier: next })
      const body = unwrapPayload(res) ?? res
      setCustomer((prev) => ({ ...prev, ...body, tier: body?.tier ?? next }))
      pushMsg('success', `Tier updated to ${next}.`)
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

  const handleExportStatementRows = () => {
    if (!statementRows.length) return
    exportToCsv(
      statementRows,
      `customer-${String(statementIdentifier).slice(0, 8)}-transactions-page-${statementPage}.csv`
    )
  }

  const displayName = useMemo(() => (customer ? customerDisplayName(customer) : '—'), [customer])
  const displayNameUpper = useMemo(() => (displayName === '—' ? '—' : displayName.toUpperCase()), [displayName])
  const flag = countryToFlagEmoji(customer?.country_code ?? customer?.country)
  const kycKey = customer ? customerKycKey(customer) : 'none'
  const acctKey = customer ? customerAccountStatusKey(customer) : 'active'
  const tierLine = customer ? customerTierLabel(customer) : '—'
  const typeRaw = customer ? customerTypeLabel(customer) : '—'
  const typeDisplay = typeRaw === '—' ? '—' : String(typeRaw).toUpperCase()

  const kycUpper = kycKey === 'verified' ? 'VERIFIED' : kycKey === 'pending' ? 'PENDING' : kycKey === 'rejected' ? 'REJECTED' : 'NONE'

  const accountUpper =
    acctKey === 'active' ? 'ACTIVE' : acctKey === 'suspended' ? 'SUSPENDED' : acctKey === 'inactive' ? 'INACTIVE' : 'PENDING'

  const riskKey = customer ? deriveRiskLevel(customer) : 'low'
  const riskUpper = riskKey === 'high' ? 'HIGH' : riskKey === 'medium' ? 'MEDIUM' : 'LOW'

  const phone = customer?.phone_number ?? customer?.phone ?? '—'
  const email = customer?.email_address ?? customer?.email ?? '—'
  const idLine = customer?.identifier ?? customer?.id ?? customerId

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
        <div className="inline-flex items-center gap-2 text-xs text-text-muted">
          <Link to={`/merchants/${accountKey}`} className="hover:text-accent">
            Customer
          </Link>
          <span className="text-text-muted">›</span>
          <span className="font-medium text-text-primary">Customer Profile</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void fetchCore()
              void loadWallets()
              setStatementFetchKey((k) => k + 1)
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
              <p className="mt-1.5 font-mono text-[13px] text-[#888888]">ID: {idLine}</p>
            </div>
          </div>
          {canMutate ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                type="button"
                disabled={mutating}
                onClick={handleFreeze}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-transparent px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-white/6"
              >
                <Snowflake size={14} />
                Freeze Account
              </button>
              <button
                type="button"
                onClick={handleExportCustomer}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-transparent px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-white/6"
              >
                <Download size={14} />
                Export Customer Data
              </button>
              <button
                type="button"
                disabled={mutating}
                onClick={handleUpgradeTier}
                className="inline-flex items-center gap-2 rounded-full border border-transparent bg-[#C5DC4B] px-4 py-2.5 text-xs font-semibold text-black shadow-sm transition-colors hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
              >
                {mutating ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                Upgrade Tier
              </button>
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
        <div className="grid min-h-0 lg:grid-cols-[minmax(285px,320px)_1fr] lg:max-h-[min(640px,calc(100dvh-260px))] lg:grid-rows-1 lg:divide-x lg:divide-border/60">
          <div className="flex min-h-0 flex-col border-b border-border/60 bg-[#0b0d11] p-3 lg:border-b-0">
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
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-muted">
                  <Loader2 size={16} className="animate-spin" />
                  Loading wallets…
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
                        setLedgerPage(1)
                        setSelectedWalletKey(wk)
                      }}
                      className={cn(
                        'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                        selected
                          ? 'border-accent bg-[#12170c] ring-1 ring-accent/60'
                          : 'border-border/70 bg-[#0d1016] hover:border-border hover:bg-[#11151d]'
                      )}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Wallet ID</p>
                      <p className="mt-0.5 font-mono text-sm text-text-primary">{walletDisplayId(w)}</p>
                      <p className="mt-2 text-[38px] font-semibold tabular-nums leading-none text-[#dfe4ec]">{formatWalletBalance(w, financial)}</p>
                    </button>
                  )
                })
              ) : (
                <p className="py-10 text-center text-sm text-text-muted">No wallets found.</p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-[10px] text-text-muted">
              <span>
                Page {walletPage} of {walletTotalPages}
              </span>
              <div className="flex gap-2">
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

          <div className="flex min-h-[280px] flex-col bg-[#090b0f] p-3 lg:min-h-0">
            {!financial ? (
              <p className="py-12 text-center text-sm text-text-muted">Wallet activity requires financial.read to view amounts and ledger.</p>
            ) : ledgerLoading ? (
              <div className="flex h-full min-h-[200px] flex-1 items-center justify-center gap-2 text-sm text-text-muted">
                <Loader2 size={18} className="animate-spin" />
                Loading ledger…
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/60 bg-[#0b0d12]">
                    <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-linear-to-b from-[#3a3d44] to-[#2d3037] shadow-sm">
                    <tr className="text-xs font-medium text-[#c6cad1]">
                      <th className="px-3 py-3">S/N</th>
                      <th className="px-3 py-3">Service</th>
                      <th className="px-3 py-3">Amount</th>
                      <th className="px-3 py-3">Balance</th>
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.length ? (
                      ledgerRows.map((row, idx) => {
                        const sn = (ledgerPage - 1) * LEDGER_PAGE_SIZE + idx + 1
                        const st = ledgerStatusKind(row.status)
                        const amt =
                          row.amount != null
                            ? `${(row.currency_code || 'NGN').toUpperCase() === 'NGN' ? '₦' : ''}${row.amount}`.trim()
                            : '—'
                        const bal =
                          row.closing_balance != null
                            ? String(row.closing_balance)
                            : row.opening_balance != null
                              ? String(row.opening_balance)
                              : '—'
                        return (
                          <tr key={row.reference || idx} className="border-t border-[#171b24] hover:bg-[#10141b]">
                            <td className="px-3 py-2.5 tabular-nums text-[#8c939f]">{sn}</td>
                            <td className="max-w-[220px] px-3 py-2.5 text-[#c8e64a]">
                              <span className="line-clamp-2 text-[9px] font-medium uppercase leading-4">{row.service || row.narration || '—'}</span>
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-[#8e95a1]">{amt}</td>
                            <td className="px-3 py-2.5 tabular-nums text-[#17b26a]">{bal !== '—' ? `+${bal}` : '—'}</td>
                            <td className="px-3 py-2.5 text-xs text-[#8e95a1]">{formatDate(row.date_created).split(' ')[0]}</td>
                            <td className="px-3 py-2.5">{ledgerStatusPill(st.kind, st.label)}</td>
                            <td className="px-3 py-2.5">
                              <button type="button" className="rounded p-1 text-[#8e95a1] hover:bg-card-hover" aria-label="Row actions">
                                <ChevronRight size={16} />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr className="border-t border-border/50">
                        <td colSpan={7} className="px-3 py-10 text-center text-sm text-text-muted">
                          {selectedWalletKey ? 'No ledger entries for this wallet.' : 'Select a wallet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
                <div className="flex shrink-0 items-center justify-between rounded-lg border border-border/50 bg-[#0b0d12] px-3 py-2 text-[10px] text-[#8e95a1]">
                  <span>
                    Page {ledgerPage} of {ledgerTotalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={ledgerPage <= 1 || ledgerLoading}
                      onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                      className="rounded-full border border-border px-3 py-1 text-[10px] text-text-secondary hover:bg-card-hover disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={ledgerPage >= ledgerTotalPages || ledgerLoading}
                      onClick={() => setLedgerPage((p) => p + 1)}
                      className="rounded-full border border-border px-3 py-1 text-[10px] text-text-secondary hover:bg-card-hover disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-card border border-border/70 bg-card">
        <div className="flex border-b border-border/60">
          {[
            { id: 'transactions', label: 'Recent Transactions' },
            { id: 'activity', label: 'Activity Feeds' },
            { id: 'disputes', label: 'Disputes' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMainTab(t.id)}
              className={cn(
                'relative flex-1 px-4 py-3 text-center text-sm font-medium transition-colors',
                mainTab === t.id ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {t.label}
              {mainTab === t.id ? (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-accent" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="p-4">
          {mainTab === 'transactions' && (
            <div>
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  title="Download this page as CSV"
                  disabled={!financial || !statementRows.length || statementLoading}
                  onClick={handleExportStatementRows}
                  className="text-sm font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
                >
                  View All
                </button>
              </div>
              {!financial ? (
                <p className="py-8 text-center text-sm text-text-muted">{statementNote}</p>
              ) : statementLoading && !statementRows.length ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
                  <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden />
                  Loading transactions…
                </div>
              ) : statementRows.length ? (
                <div className="flex flex-col gap-2">
                  <div className="relative overflow-x-auto rounded-xl border border-border/60">
                    {statementLoading ? (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-card/60 backdrop-blur-[1px]">
                        <Loader2 className="h-6 w-6 animate-spin text-accent" aria-label="Loading" />
                      </div>
                    ) : null}
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-card-hover/60">
                        <tr className="text-xs font-medium text-text-muted">
                          <th className="px-3 py-3">Transaction ID</th>
                          <th className="px-3 py-3">Amount</th>
                          <th className="px-3 py-3">Type</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3">Date</th>
                          <th className="w-10 px-3 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {statementRows.map((tx, idx) => {
                          const st = statementStatusKind(tx.status)
                          const amt =
                            tx.amount != null
                              ? formatBalance(Number(String(tx.amount).replace(/,/g, '')), tx.currency_code || 'USD')
                              : '—'
                          return (
                            <tr key={`${tx.reference}-${idx}`} className="border-t border-border/50">
                              <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">{tx.reference || '—'}</td>
                              <td className="px-3 py-2.5 tabular-nums text-text-secondary">{amt}</td>
                              <td className="px-3 py-2.5 uppercase text-text-secondary">{tx.transaction_type || '—'}</td>
                              <td className="px-3 py-2.5">{dotBadge(st.kind, st.label)}</td>
                              <td className="px-3 py-2.5 text-xs text-text-muted">{formatDate(tx.date_created)}</td>
                              <td className="px-3 py-2.5">
                                <span className="inline-flex rounded p-1 text-text-muted" aria-hidden>
                                  <ChevronRight size={16} />
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex shrink-0 items-center justify-between rounded-lg border border-border/50 bg-[#0b0d12] px-3 py-2 text-[10px] text-[#8e95a1]">
                    <span>
                      Page {statementPage} of {statementTotalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={statementPage <= 1 || statementLoading}
                        onClick={() => setStatementPage((p) => Math.max(1, p - 1))}
                        className="rounded-full border border-border px-3 py-1 text-[10px] text-text-secondary hover:bg-card-hover disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={statementPage >= statementTotalPages || statementLoading}
                        onClick={() => setStatementPage((p) => p + 1)}
                        className="rounded-full border border-border px-3 py-1 text-[10px] text-text-secondary hover:bg-card-hover disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-text-muted">{statementNote || 'No transactions.'}</p>
              )}
            </div>
          )}

          {mainTab === 'activity' && (
            <div className="max-h-[360px] space-y-2 overflow-y-auto">
              {wallets.length ? (
                wallets.map((w, idx) => (
                  <div key={w.wallet_key || idx} className="flex items-start gap-3 rounded-xl border border-border/50 bg-card-hover/20 px-3 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                      <Wallet size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-secondary">Wallet {walletDisplayId(w)} created</p>
                      <p className="text-xs text-text-muted">{formatDate(w.date_created)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-10 text-center text-sm text-text-muted">No activity yet.</p>
              )}
            </div>
          )}

          {mainTab === 'disputes' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { k: 'Total', v: disputeSummary.total },
                  { k: 'In review', v: disputeSummary.in_review },
                  { k: 'Escalated', v: disputeSummary.escalated },
                  { k: 'Resolved', v: disputeSummary.resolved },
                ].map(({ k, v }) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card-hover/40 px-3 py-1.5 text-xs"
                  >
                    <span className="text-text-muted">{k}</span>
                    <span className="font-semibold tabular-nums text-text-primary">{formatNumber(v)}</span>
                  </span>
                ))}
              </div>
              {disputeRows.length ? (
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-card-hover/60">
                      <tr className="text-xs text-text-muted">
                        <th className="px-3 py-2.5 font-medium">Reference</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-3 py-2.5 font-medium">Amount</th>
                        <th className="px-3 py-2.5 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disputeRows.map((row, idx) => (
                        <tr key={row.dispute_reference || row.reference || idx} className="border-t border-border/50">
                          <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                            {row.dispute_reference || row.reference || '—'}
                          </td>
                          <td className="px-3 py-2 text-text-secondary">{row.status || '—'}</td>
                          <td className="px-3 py-2 tabular-nums text-text-secondary">
                            {row.currency_code || ''} {row.amount != null ? String(row.amount) : '—'}
                          </td>
                          <td className="px-3 py-2 text-xs text-text-muted">{formatDate(row.date_created)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-sm text-text-muted">No disputes for this customer.</p>
              )}
            </div>
          )}
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
    </div>
  )
}
