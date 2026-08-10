import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Loader2,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import Pagination from '../../components/ui/Pagination'
import OverlayPortal from '../../components/ui/OverlayPortal'
import { useAuth } from '../../context/AuthContext'
import { canUpdateMerchant, canReadFinancial } from '../../lib/permissions'
import {
  canResolveNgnTsq,
  detailFieldsForRow,
  pickAccountKey,
  pickReference,
  pickRecord,
  pickRowStatus,
  reviewStatusBadge,
  normalizeReviewStatus,
  REVIEW_TYPE_TABS,
  transactionTypeLabel,
  unwrapPendingReviewList,
  unwrapPendingReviewSummary,
} from '../../lib/transactionReview'
import { cn, formatBalance, formatDate, formatNumber } from '../../lib/utils'
import { parseBeamerResponse, isIsvsDirectSuccess, getBeamerErrorMessage } from '../../lib/beamerUi'
import { getPendingReviewSummary, getPendingReviewTransactions } from '../../services/transactions'
import { beamerNgnTsq } from '../../services/merchants'

const LIMIT = 20

function SummaryCard({ label, value, icon, iconCls }) {
  const Icon = icon
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', iconCls)}>
          {Icon ? <Icon size={15} /> : null}
        </div>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <p className="text-3xl font-semibold tabular-nums text-text-primary">{value}</p>
    </div>
  )
}

function ConfirmDialog({ open, title, message, confirmLabel, danger, loading, onClose, onConfirm }) {
  if (!open) return null
  return (
    <OverlayPortal open={open}>
      <div className="modal-overlay" onClick={onClose} role="presentation">
        <div
          className="modal-panel max-h-none p-5"
          onClick={(e) => e.stopPropagation()}
        >
        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        <p className="mt-2 text-sm text-text-secondary">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm text-text-secondary hover:bg-card-hover"
          >
            Back
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium',
              danger
                ? 'bg-error text-white hover:brightness-110'
                : 'bg-accent text-page hover:brightness-105'
            )}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
        </div>
      </div>
    </OverlayPortal>
  )
}

function reviewStatusKind(status) {
  const s = normalizeReviewStatus(status)
  if (s === 'SUCCESSFUL' || s === 'SUCCESS') return 'completed'
  if (s === 'FAILED' || s === 'FAIL') return 'failed'
  if (s === 'PENDING' || s === 'PROCESSING') return 'processing'
  return 'neutral'
}

function reviewStatusLabel(status) {
  const s = normalizeReviewStatus(status)
  return s || 'PENDING'
}

function copyText(value) {
  if (!value) return
  navigator.clipboard?.writeText(String(value)).catch(() => {})
}

function formatDrawerAmount(row, canShowAmounts) {
  const rec = pickRecord(row)
  const raw = row?.amount ?? rec?.amount
  if (!canShowAmounts) return '••••'
  const n = Number(raw)
  if (Number.isNaN(n)) return raw ?? '—'
  return formatBalance(n, 'NGN')
}

function DetailDrawer({ row, canAct, canShowAmounts, acting, onClose, onResolve }) {
  if (!row) return null
  const status = pickRowStatus(row)
  const statusKind = reviewStatusKind(status)
  const fields = detailFieldsForRow(row)
  const showActions = canAct && canResolveNgnTsq(row)
  const amountDisplay = formatDrawerAmount(row, canShowAmounts)
  const dateValue = fields.find(([label]) => label === 'Date created')?.[1] ?? '—'
  const detailRows = fields.filter(([label]) => !['Amount', 'Date created'].includes(label))
  const amountLabels = new Set([
    'Amount',
    'Charge',
    'VAT',
    'Settlement',
    'Opening balance',
    'Closing balance',
    'Opening Balance',
    'Closing Balance',
  ])

  return (
    <OverlayPortal open>
      <div className="drawer-overlay" onClick={onClose} role="presentation">
        <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
          <div className="relative shrink-0 border-b border-border px-6 pb-5 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-5 top-5 rounded-md p-1 text-text-muted transition-colors hover:bg-card-hover hover:text-text-secondary"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div
              className={cn(
                'mx-auto flex h-20 w-20 items-center justify-center rounded-full',
                statusKind === 'completed' && 'bg-success-bg/20',
                statusKind === 'failed' && 'bg-error-bg/20',
                statusKind === 'processing' && 'bg-warning-bg/20',
                statusKind === 'neutral' && 'bg-card-hover'
              )}
            >
              {statusKind === 'completed' && <CheckCircle2 size={36} className="text-success" />}
              {statusKind === 'failed' && <XCircle size={36} className="text-error" />}
              {statusKind === 'processing' && <Clock3 size={36} className="text-warning" />}
              {statusKind === 'neutral' && <Clock3 size={36} className="text-text-muted" />}
            </div>
            <p className="mt-4 text-center text-xl font-semibold uppercase tracking-wide text-text-primary">
              {reviewStatusLabel(status)}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            <div className="mb-6 text-center">
              <p className="text-sm text-text-muted">Amount</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-text-primary">{amountDisplay}</p>
              <p className="mt-1 text-sm text-text-secondary">{dateValue}</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <div className="border-b border-border bg-card-hover px-4 py-3 text-sm font-medium text-text-primary">
                Payment Details
              </div>
              {detailRows.map(([label, value], idx, arr) => (
                <div
                  key={label}
                  className={cn(
                    'flex items-start justify-between gap-3 px-4 py-3',
                    idx < arr.length - 1 && 'border-b border-border/60'
                  )}
                >
                  <span className="shrink-0 text-sm text-text-secondary">{label}</span>
                  <span
                    className={cn(
                      'flex min-w-0 items-center justify-end gap-2 text-right text-sm text-text-primary',
                      amountLabels.has(label) && 'shrink-0 whitespace-nowrap tabular-nums',
                      !amountLabels.has(label) && 'break-all'
                    )}
                  >
                    {value ?? '—'}
                    {(label === 'Reference' || label === 'Live reference') && value && value !== '—' ? (
                      <button
                        type="button"
                        onClick={() => copyText(value)}
                        className="shrink-0 rounded-md p-1 text-text-muted hover:bg-card-hover hover:text-text-secondary"
                        title="Copy reference"
                      >
                        <Copy size={14} />
                      </button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {showActions ? (
            <div className="flex shrink-0 gap-2 border-t border-border px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={acting}
                onClick={onResolve}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-semibold text-page hover:brightness-105 disabled:opacity-50"
              >
                {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Resolve payout
              </button>
            </div>
          ) : null}
        </aside>
      </div>
    </OverlayPortal>
  )
}

export default function DisputesPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const scopeAccountKey = searchParams.get('account_key')?.trim() || ''
  const scopeIdentifier = searchParams.get('identifier')?.trim() || ''

  const canAct = canUpdateMerchant(user?.permissions, user?.role)
  const canShowAmounts = canReadFinancial(user?.permissions)

  const [summary, setSummary] = useState({ total_pending: 0, by_type: {} })
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [query, setQuery] = useState({
    search: '',
    transaction_type: '',
    from_date: '',
    to_date: '',
  })

  const [selected, setSelected] = useState(null)
  const [actingRef, setActingRef] = useState(null)
  const [toast, setToast] = useState(null)
  const [confirmResolve, setConfirmResolve] = useState(null)

  const abortRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery({
        search: search.trim(),
        transaction_type: typeFilter,
        from_date: fromDate,
        to_date: toDate,
      })
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search, typeFilter, fromDate, toDate])

  const scopeParams = useMemo(() => {
    const p = {}
    if (scopeAccountKey) p.account_key = scopeAccountKey
    if (scopeIdentifier) p.identifier = scopeIdentifier
    return p
  }, [scopeAccountKey, scopeIdentifier])

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const res = await getPendingReviewSummary(scopeParams)
      setSummary(unwrapPendingReviewSummary(res))
    } catch {
      setSummary({ total_pending: 0, by_type: {} })
    } finally {
      setSummaryLoading(false)
    }
  }, [scopeParams])

  const fetchList = useCallback(async () => {
    abortRef.current?.abort?.()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const params = {
        page,
        limit: LIMIT,
        ...scopeParams,
      }
      if (query.search) params.search = query.search
      if (query.transaction_type) params.transaction_type = query.transaction_type
      if (query.from_date) params.from_date = query.from_date
      if (query.to_date) params.to_date = query.to_date

      const res = await getPendingReviewTransactions(params, controller.signal)
      const { records, pagination } = unwrapPendingReviewList(res)
      setRows(records)
      const t = Number(pagination.total ?? records.length ?? 0)
      setTotal(t)
      setTotalPages(
        Math.max(1, Number(pagination.total_pages || Math.ceil(t / LIMIT) || 1))
      )
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
      setError(err?.response?.data?.message || 'Failed to load pending transactions.')
      setRows([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [page, query, scopeParams])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  function formatAmount(row) {
    const raw = row?.amount ?? row?.record?.amount
    if (!canShowAmounts) return '••••'
    const n = Number(raw)
    if (Number.isNaN(n)) return raw ?? '—'
    return formatBalance(n, 'NGN')
  }

  async function runResolveTsq(row) {
    const reference = pickReference(row)
    const accountKey = pickAccountKey(row)
    if (!reference || !accountKey) {
      setToast({
        type: 'error',
        text: 'Missing merchant account key or payout live reference for TSQ.',
      })
      return
    }
    if (!canResolveNgnTsq(row)) {
      setToast({ type: 'error', text: 'TSQ resolve is only available for pending NGN payouts.' })
      return
    }

    setActingRef(reference)
    try {
      const res = await beamerNgnTsq(accountKey, { data: { reference } })
      const parsed = parseBeamerResponse(res)
      if (isIsvsDirectSuccess(parsed) || parsed.isvsState === true) {
        setToast({
          type: 'success',
          text: parsed.isvsMessage || 'Payout status queried successfully.',
        })
        setSelected(null)
        setConfirmResolve(null)
        await Promise.all([fetchList(), fetchSummary()])
      } else {
        const reason =
          parsed.isvs?.data?.reason ||
          parsed.isvsMessage ||
          'Could not resolve payout status.'
        setToast({ type: 'error', text: String(reason) })
      }
    } catch (err) {
      const status = err?.response?.status
      const msg = getBeamerErrorMessage(err, err?.response?.data?.message || 'TSQ request failed.')
      if (status === 403) {
        setToast({
          type: 'error',
          text: 'You do not have permission to resolve payouts (merchant.update required).',
        })
      } else if (status === 404) {
        setToast({ type: 'error', text: 'Merchant or payout reference not found.' })
      } else {
        setToast({ type: 'error', text: msg })
      }
    } finally {
      setActingRef(null)
    }
  }

  const topTypeCounts = useMemo(() => {
    const entries = Object.entries(summary.by_type || {})
    return entries.slice(0, 4)
  }, [summary.by_type])

  return (
    <>
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Pending review</h1>
        <p className="mt-1 max-w-3xl text-sm text-text-secondary">
          Pending transactions queue. For NGN payouts, use Resolve to query status via Beamer TSQ
          (requires merchant.update).
          {scopeAccountKey ? ` Scoped to merchant ${scopeAccountKey}.` : ''}
          {scopeIdentifier ? ` Scoped to customer ${scopeIdentifier}.` : ''}
        </p>
      </div>

      {toast ? (
        <div
          className={cn(
            'mb-4 rounded-lg border px-4 py-3 text-sm',
            toast.type === 'success'
              ? 'border-success/30 bg-success-bg text-success'
              : 'border-error/30 bg-error-bg text-error'
          )}
          role="status"
        >
          {toast.text}
        </div>
      ) : null}

      <div className="mb-6 stat-grid">
        <SummaryCard
          label="Total pending"
          value={summaryLoading ? '…' : formatNumber(summary.total_pending)}
          icon={Clock3}
          iconCls="bg-warning-bg text-warning"
        />
        {topTypeCounts.map(([type, count]) => (
          <SummaryCard
            key={type}
            label={transactionTypeLabel(type)}
            value={summaryLoading ? '…' : formatNumber(count)}
            icon={AlertTriangle}
            iconCls="bg-card-hover text-text-secondary"
          />
        ))}
      </div>

      <div className="card-shell">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 max-w-xl">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, wallet, account, sender, amount, session…"
              className="h-10 w-full rounded-xl border border-border bg-page pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/40"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-10 rounded-xl border border-border bg-page px-3 text-xs text-text-secondary outline-none"
              aria-label="From date"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-10 rounded-xl border border-border bg-page px-3 text-xs text-text-secondary outline-none"
              aria-label="To date"
            />
          </div>
        </div>

        <div className="tab-scroll">
          {REVIEW_TYPE_TABS.map((tab) => (
            <button
              key={tab.value || 'all'}
              type="button"
              onClick={() => setTypeFilter(tab.value)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                typeFilter === tab.value
                  ? 'bg-accent text-page'
                  : 'bg-card-hover text-text-secondary hover:text-text-primary'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-error">{error}</div>
        ) : (
          <div className="table-scroll">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-card-hover/50 text-xs text-text-muted">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Wallet</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-text-muted">
                      No pending transactions found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const ref = pickReference(row)
                    const status = pickRowStatus(row)
                    const badge = reviewStatusBadge(status)
                    const showActions = canAct && canResolveNgnTsq(row)
                    const busy = actingRef === ref

                    return (
                      <tr key={`${row.transaction_type}-${ref}`} className="border-b border-border/40 hover:bg-card-hover/20">
                        <td className="px-4 py-3 text-text-secondary">{transactionTypeLabel(row.transaction_type)}</td>
                        <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-text-primary" title={ref}>
                          {ref || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-text-primary">{formatAmount(row)}</td>
                        <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-text-muted" title={row.wallet_key}>
                          {row.wallet_key || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium', badge.cls)}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-text-secondary">
                          {row.date_created ? formatDate(row.date_created) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {showActions ? (
                              <div className="hidden items-center gap-1.5 sm:flex">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setConfirmResolve(row)}
                                  className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-page hover:brightness-105 disabled:opacity-50"
                                >
                                  {busy ? '…' : 'Resolve'}
                                </button>
                              </div>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setSelected(row)}
                              className="rounded-md p-1 text-text-muted hover:bg-card-hover hover:text-text-primary"
                              aria-label="View details"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} label="pending transactions" limit={LIMIT} />
        {!loading && total > 0 ? (
          <p className="border-t border-border px-4 py-2 text-center text-xs text-text-muted">{formatNumber(total)} pending total</p>
        ) : null}
      </div>
    </div>

      <DetailDrawer
        row={selected}
        canAct={canAct}
        canShowAmounts={canShowAmounts}
        acting={actingRef === pickReference(selected)}
        onClose={() => setSelected(null)}
        onResolve={() => selected && setConfirmResolve(selected)}
      />

      <ConfirmDialog
        open={!!confirmResolve}
        title="Resolve pending NGN payout?"
        message={`Query payout status via Beamer TSQ for reference ${pickReference(confirmResolve) || '—'}?`}
        confirmLabel="Resolve payout"
        danger={false}
        loading={!!actingRef}
        onClose={() => setConfirmResolve(null)}
        onConfirm={() => confirmResolve && runResolveTsq(confirmResolve)}
      />
    </>
  )
}
