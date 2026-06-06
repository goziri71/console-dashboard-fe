import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, CheckCircle, Download, FileText, Loader2, RefreshCw, XCircle, HelpCircle } from 'lucide-react'
import { getCustomer, getCustomerKycs } from '../../services/customers'
import { patchKycCompliance } from '../../services/kyc'
import { useAuth } from '../../context/AuthContext'
import { canKycUpdate } from '../../lib/permissions'
import { cn, formatDate, exportToCsv, deriveRiskLevel } from '../../lib/utils'
import KycApproveConfirmDialog from '../../components/kyc/KycApproveConfirmDialog'
import {
  isKycRowPending,
  kycIdentificationLabel,
  kycRowReference,
  kycRowStatusKey,
} from '../../lib/kycUi'
import { countryToFlagEmoji } from './merchantUi'
import {
  customerDisplayName,
  customerTierLabel,
  customerKycKey,
  customerAccountStatusKey,
  customerTypeLabel,
  getCustomerIdentifier,
} from './merchantCustomerUi'
import { kycKeyToUpper } from '../../lib/kycUi'
import { useKycDisplayStatus } from '../../hooks/useKycDisplayStatus'
import Pagination from '../../components/ui/Pagination'

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

function maskValue(s) {
  if (s == null || s === '') return '—'
  const str = String(s)
  if (str.length <= 4) return '***'
  return `*** ****** ${str.slice(-4)}`
}

/** Submitted line to match design: "12 Mar 2024 . 10:30 AM" */
function formatKycSubmittedAt(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '—'
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = d.getDate()
  const mon = months[d.getMonth()]
  const y = d.getFullYear()
  const h12 = d.getHours() % 12 || 12
  const min = String(d.getMinutes()).padStart(2, '0')
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM'
  return `${day} ${mon} ${y} . ${h12}:${min} ${ampm}`
}

function humanizeDocTitle(row) {
  const raw =
    row.document_type ||
    row.doc_type ||
    row.type ||
    row.kyc_type ||
    row.title ||
    row.name ||
    row.verification_type ||
    ''
  const t = String(raw).toUpperCase().replace(/_/g, ' ')
  if (t.includes('BVN')) return 'Bank Verification Number (BVN)'
  if (t.includes('VAT')) return 'Value Added Tax Number (VAT)'
  if (t.includes('CAC')) return 'Corporate Affairs Commission (CAC)'
  if (t.includes('TIN')) return 'Tax Identification Number (TIN)'
  if (!raw) return 'Verification document'
  return String(raw).replace(/_/g, ' ')
}

function rowStatusKey(statusStr) {
  const s = String(statusStr || '')
    .toLowerCase()
    .trim()
  if (s.includes('verif') || s.includes('approved') || s === 'active') return 'verified'
  if (s.includes('pend') || s.includes('submitted')) return 'pending'
  if (s.includes('reject') || s.includes('fail')) return 'rejected'
  return 'none'
}

/** Same layout as verified banner; colors per aggregate KYC status. */
const KYC_SUMMARY_BANNER = {
  verified: {
    Icon: CheckCircle,
    iconSize: 28,
    iconStroke: 1.5,
    title: 'KYC Verified',
    body: "This customer's KYC has been verified successfully.",
    wrap: 'flex flex-col items-center justify-center gap-3 rounded-lg border border-[#5c6639]/90 bg-[#161a12] p-12',
    iconRing: 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#14532d]/80 text-[#97AB27]',
    titleClass: 'text-center text-[21px] font-semibold text-[#97AB27]',
    bodyClass: 'mt-1.5 max-w-md text-center text-[16px] font-normal leading-relaxed text-[#97AB27]/95',
  },
  pending: {
    Icon: AlertCircle,
    iconSize: 28,
    iconStroke: 1.5,
    title: 'KYC Pending',
    body: 'Verification is still in progress for this customer.',
    wrap: 'flex flex-col items-center justify-center gap-3 rounded-lg border border-[#a16207]/55 bg-[#1c1810] p-12',
    iconRing: 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#713f12]/55 text-[#fbbf24]',
    titleClass: 'text-center text-[21px] font-semibold text-[#fbbf24]',
    bodyClass: 'mt-1.5 max-w-md text-center text-[16px] font-normal leading-relaxed text-[#d4c4a0]',
  },
  rejected: {
    Icon: XCircle,
    iconSize: 28,
    iconStroke: 1.5,
    title: 'KYC Rejected',
    body: "This customer's KYC was not approved.",
    wrap: 'flex flex-col items-center justify-center gap-3 rounded-lg border border-[#b91c1c]/55 bg-[#1a1010] p-12',
    iconRing: 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#7f1d1d]/50 text-[#f87171]',
    titleClass: 'text-center text-[21px] font-semibold text-[#fca5a5]',
    bodyClass: 'mt-1.5 max-w-md text-center text-[16px] font-normal leading-relaxed text-[#d4a8a8]',
  },
  none: {
    Icon: HelpCircle,
    iconSize: 28,
    iconStroke: 1.5,
    title: 'KYC Status',
    body: 'No aggregate KYC status is available for this customer yet.',
    wrap: 'flex flex-col items-center justify-center gap-3 rounded-lg border border-[#3f3f3f] bg-[#161616] p-12',
    iconRing: 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] text-[#9ca3af]',
    titleClass: 'text-center text-[21px] font-semibold text-[#d4d4d4]',
    bodyClass: 'mt-1.5 max-w-md text-center text-[16px] font-normal leading-relaxed text-[#9ca3af]',
  },
}

function KycSummaryStatusBanner({ kycKey }) {
  const key = kycKey === 'verified' ? 'verified' : kycKey === 'pending' ? 'pending' : kycKey === 'rejected' ? 'rejected' : 'none'
  const cfg = KYC_SUMMARY_BANNER[key]
  const Icon = cfg.Icon
  return (
    <div className={cfg.wrap}>
      <div className={cfg.iconRing}>
        <Icon size={cfg.iconSize} strokeWidth={cfg.iconStroke} />
      </div>
      <div className="min-w-0">
        <p className={cfg.titleClass}>{cfg.title}</p>
        <p className={cfg.bodyClass}>{cfg.body}</p>
      </div>
    </div>
  )
}

/** Dark green pill on document rows (matches Sterllo KYC design). */
function documentRowStatusPillClass(key) {
  if (key === 'verified') return 'bg-[#14532d] text-white'
  if (key === 'pending') return 'bg-[#713f12] text-[#fcd34d]'
  if (key === 'rejected') return 'bg-[#7f1d1d] text-[#fecaca]'
  return 'bg-[#2a2a2a] text-[#a3a3a3]'
}

export default function CustomerKycPage() {
  const { accountKey, identifier: identifierParam } = useParams()
  const { user } = useAuth()
  const canApprove = canKycUpdate(user?.permissions, user?.role)
  const customerId = useMemo(() => (identifierParam ? decodeURIComponent(identifierParam) : ''), [identifierParam])

  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [kycRows, setKycRows] = useState([])
  const [kycPage, setKycPage] = useState(1)
  const [kycTotalPages, setKycTotalPages] = useState(1)
  const [kycTotal, setKycTotal] = useState(0)
  const [kycLoading, setKycLoading] = useState(false)
  const [kycMsg, setKycMsg] = useState(null)
  const [approving, setApproving] = useState(false)
  const [approveConfirm, setApproveConfirm] = useState({ open: false, reference: '' })

  const statementIdentifier = useMemo(() => {
    if (!customerId) return ''
    if (!customer) return customerId
    return getCustomerIdentifier(customer) || customerId
  }, [customer, customerId])

  const profilePath = `/merchants/${accountKey}/customers/${encodeURIComponent(customerId)}`

  const fetchCore = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    setError(null)
    try {
      const cRes = await getCustomer(customerId).catch(() => null)
      const customerPayload = unwrapPayload(cRes) ?? cRes
      setCustomer(customerPayload && typeof customerPayload === 'object' ? customerPayload : null)
      if (!customerPayload || typeof customerPayload !== 'object') {
        setError('Customer profile not found.')
      }
    } catch {
      setError('Failed to load customer.')
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    fetchCore()
  }, [fetchCore])

  /** KYC document rows: GET /customers/:identifier/kycs via getCustomerKycs (src/services/customers.js). */
  const loadKycs = useCallback(async () => {
    if (!statementIdentifier) return
    setKycLoading(true)
    try {
      const res = await getCustomerKycs(statementIdentifier, { page: kycPage, limit: KYC_PAGE_SIZE })
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

  useEffect(() => {
    if (!statementIdentifier || !customer) return
    loadKycs()
  }, [statementIdentifier, customer, loadKycs])

  useEffect(() => {
    setKycPage(1)
  }, [statementIdentifier])

  useEffect(() => {
    if (kycMsg?.type !== 'success') return undefined
    const timer = window.setTimeout(() => setKycMsg(null), 5000)
    return () => window.clearTimeout(timer)
  }, [kycMsg])

  const runApproveKyc = async () => {
    const reference = approveConfirm.reference
    if (!reference || !canApprove) return
    setApproving(true)
    setKycMsg(null)
    try {
      await patchKycCompliance(reference, { is_compliant: 'Y' })
      setKycMsg({ type: 'success', text: 'KYC record approved successfully.' })
      setApproveConfirm({ open: false, reference: '' })
      await fetchCore()
      await loadKycs()
    } catch (err) {
      setKycMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to approve KYC record.',
      })
    } finally {
      setApproving(false)
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
    ]
    exportToCsv(rows, `customer-kyc-${String(customerId).slice(0, 12)}.csv`)
  }

  const displayName = useMemo(() => (customer ? customerDisplayName(customer) : '—'), [customer])
  const displayNameUpper = useMemo(() => (displayName === '—' ? '—' : displayName.toUpperCase()), [displayName])
  const flag = countryToFlagEmoji(customer?.country_code ?? customer?.country)
  const localKycKey = customer ? customerKycKey(customer) : 'none'
  const { kycKey } = useKycDisplayStatus(customer, localKycKey)
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

  const kycValidUntil = customer?.kyc_valid_until ?? customer?.kyc_expires_at ?? customer?.kyc_expiry ?? null
  const sanctionStatus =
    customer?.sanction_status ?? customer?.sanctions_status ?? customer?.aml_sanction_status ?? null
  const sanctionDisplay =
    sanctionStatus != null && sanctionStatus !== ''
      ? String(sanctionStatus).replace(/_/g, ' ')
      : customer && kycKey === 'verified'
        ? 'Cleared'
        : '—'

  if (loading && !customer) {
    return (
      <div className="animate-fade-in-up space-y-6">
        <div className="h-6 w-64 skeleton rounded-lg" />
        <div className="h-40 skeleton rounded-card" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-80 skeleton rounded-card" />
          <div className="h-80 skeleton rounded-card" />
        </div>
      </div>
    )
  }

  if (!loading && (error || !customer)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertCircle className="text-error" size={36} />
        <p className="text-sm text-text-secondary">{error || 'Customer not found.'}</p>
        <Link
          to={`/merchants/${accountKey}`}
          className="inline-flex items-center gap-2 rounded-button border border-border px-4 py-2 text-sm text-text-primary hover:bg-card-hover"
        >
          <ArrowLeft size={14} />
          Back to merchant
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-text-muted">
          <Link
            to={profilePath}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-1 text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary"
          >
            <ArrowLeft size={12} />
            Customer Details
          </Link>
          <ChevronSep />
          <span className="font-medium text-text-primary">View KYC</span>
        </div>
        <button
          type="button"
          onClick={() => {
            void fetchCore()
            void loadKycs()
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs text-text-secondary hover:bg-card-hover disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh
        </button>
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
          <button
            type="button"
            onClick={handleExportCustomer}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-transparent bg-[#C5DC4B] px-5 py-2.5 text-xs font-semibold text-black shadow-sm transition-colors hover:brightness-105 active:scale-[0.98]"
          >
            <Download size={14} />
            Export Customer Data
          </button>
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

      {kycMsg ? (
        <div
          className={cn(
            'rounded-lg border px-4 py-2.5 text-sm',
            kycMsg.type === 'success'
              ? 'border-[#5c6639]/90 bg-[#161a12] text-[#97AB27]'
              : 'border-[#b91c1c]/55 bg-[#1a1010] text-[#fca5a5]'
          )}
          role="status"
        >
          {kycMsg.text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
        {/* Document list: rows from GET /customers/:id/kycs — see loadKycs + getCustomerKycs */}
        <section className="flex flex-col overflow-hidden rounded-[30px] border border-[#2a2a2a] bg-[#111111]">
          <div className="border-b border-[#2a2a2a] px-5 py-4">
            <h2 className="text-[13px] font-semibold leading-snug tracking-[0.02em] text-[#C5DC4B]">
              KYC Documents — Submitted Documents
            </h2>
          </div>
          {kycLoading ? (
            <div className="flex flex-col gap-2 px-4 py-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-20 w-full rounded-lg bg-[#1a1a1a]" />
              ))}
            </div>
          ) : kycRows.length ? (
            <>
              <ul className="flex-1 divide-y divide-[#2a2a2a]">
                {kycRows.map((row, ri) => {
                  const statusStr = pickKycField(row, ['status', 'kyc_status', 'verification_status', 'compliance_status'])
                  const sk = kycRowStatusKey(row) !== 'none' ? kycRowStatusKey(row) : rowStatusKey(statusStr)
                  const reference = kycRowReference(row)
                  const pending = isKycRowPending(row)
                  const rawId =
                    pickKycRaw(row, ['document_number', 'identifier', 'bvn', 'tin', 'registration_number', 'value']) ?? ''
                  const submitted = pickKycRaw(row, ['date_created', 'created_at', 'date_modified', 'submitted_at'])
                  const downloadUrl =
                    pickKycRaw(row, ['document_url', 'file_url', 'download_url', 'url']) || (typeof rawId === 'string' && rawId.startsWith('http') ? rawId : null)
                  return (
                    <li key={row.id ?? row.kyc_id ?? ri} className="flex items-start gap-4 px-5 py-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3d442e] text-white/95">
                        <FileText size={18} strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">
                          {humanizeDocTitle(row) !== 'Verification document'
                            ? humanizeDocTitle(row)
                            : kycIdentificationLabel(row)}
                        </p>
                        {reference ? (
                          <p className="mt-1 text-xs text-[#9ca3af]">
                            Reference: <span className="font-mono text-[#b4b9c4]">{reference}</span>
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-[#9ca3af]">
                          Document Number: <span className="font-mono text-[#b4b9c4]">{maskValue(rawId)}</span>
                        </p>
                        <p className="mt-1 text-xs text-[#9ca3af]">
                          Submitted on {submitted != null ? formatKycSubmittedAt(submitted) : '—'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 self-center">
                        <span
                          className={cn(
                            'inline-flex min-w-[72px] items-center justify-center rounded-full px-3 py-1 text-[11px] font-medium',
                            documentRowStatusPillClass(sk)
                          )}
                        >
                          {sk === 'verified' ? 'Verified' : sk === 'pending' ? 'Pending' : sk === 'rejected' ? 'Rejected' : statusStr || '—'}
                        </span>
                        {canApprove && pending && reference ? (
                          <button
                            type="button"
                            disabled={approving}
                            onClick={() => setApproveConfirm({ open: true, reference })}
                            className="rounded-full bg-[#C5DC4B] px-3 py-1.5 text-[11px] font-semibold text-black hover:brightness-105 disabled:opacity-50"
                          >
                            Approve
                          </button>
                        ) : null}
                        {downloadUrl ? (
                          <a
                            href={String(downloadUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-[#4b4b4b] bg-transparent p-2 text-white/80 transition-colors hover:border-[#6b6b6b] hover:bg-white/5 hover:text-white"
                            aria-label="Download document"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download size={16} strokeWidth={2} />
                          </a>
                        ) : (
                          <span
                            className="rounded-md border border-[#3a3a3a] p-2 text-white/25"
                            title="No download available"
                            aria-hidden
                          >
                            <Download size={16} />
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="border-t border-[#2a2a2a] bg-[#0c0c0c]">
                <Pagination
                  page={kycPage}
                  totalPages={kycTotalPages}
                  total={kycTotal}
                  limit={KYC_PAGE_SIZE}
                  label="KYC documents"
                  onPageChange={setKycPage}
                />
              </div>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-[#9ca3af]">No KYC documents returned.</p>
          )}
        </section>

        <section className="flex flex-col overflow-hidden rounded-[24px] border border-[#2a2a2a] bg-[#111111]">
          <div className="border-b border-[#2a2a2a] px-5 py-4">
            <h2 className="text-[16px] font-bold tracking-[0.02em] text-[#BAD133]">KYC Summary</h2>
          </div>
          <div className="flex flex-1 flex-col gap-5 p-6">
            <KycSummaryStatusBanner kycKey={kycKey} />

            <dl className="mt-auto divide-y divide-[#2a2a2a] text-sm">
              <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
                <dt className="text-[#F8FAEA] text-[17.838px] font-normal">KYC Status</dt>
                <dd>
                  <span
                    className={cn(
                      'inline-flex rounded-[20px] px-7 py-2 text-[16px] tracking-wide',
                      kycKey === 'verified'
                        ? 'bg-[#053321] text-[#17B26A]'
                        : kycKey === 'pending'
                          ? 'bg-[#713f12] text-[#fcd34d]'
                          : kycKey === 'rejected'
                            ? 'bg-[#7f1d1d] text-[#fecaca]'
                            : 'bg-[#2a2a2a] text-[#a3a3a3]'
                    )}
                  >
                    {kycKey === 'verified' ? 'Verified' : kycKey === 'pending' ? 'Pending' : kycKey === 'rejected' ? 'Rejected' : 'None'}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-[#9ca3af]">Risk Level</dt>
                <dd>
                  <span
                    className={cn(
                      'inline-flex rounded-[20px] px-7 py-2 text-[16px]',
                      riskKey === 'high'
                        ? 'bg-[#7f1d1d] text-[#fecaca]'
                        : riskKey === 'medium'
                          ? 'bg-[#713f12] text-[#fcd34d]'
                          : 'bg-[#14532d] text-white'
                    )}
                  >
                    {riskKey === 'high' ? 'High' : riskKey === 'medium' ? 'Medium' : 'Low'}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-[#9ca3af]">KYC Valid Until</dt>
                <dd className="text-right font-medium text-white">{kycValidUntil != null ? formatDate(kycValidUntil) : '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
                <dt className="text-[#9ca3af]">Sanction Status</dt>
                <dd className="text-right font-medium text-white">{sanctionDisplay}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      <KycApproveConfirmDialog
        open={approveConfirm.open}
        message={`Approve KYC record ${approveConfirm.reference}? This marks the document as compliant.`}
        loading={approving}
        onCancel={() => !approving && setApproveConfirm({ open: false, reference: '' })}
        onConfirm={runApproveKyc}
      />
    </div>
  )
}

function ChevronSep() {
  return <span className="text-text-muted">›</span>
}
