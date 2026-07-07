import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import Pagination from '../../components/ui/Pagination'
import { useAuth } from '../../context/AuthContext'
import { canDisputeUpdate, canReadFinancial } from '../../lib/permissions'
import {
  canReviewRowActions,
  detailFieldsForRow,
  pickReference,
  pickRowStatus,
  reviewStatusBadge,
  reviewUrlSegment,
  REVIEW_TYPE_TABS,
  transactionTypeLabel,
  unwrapPendingReviewList,
  unwrapPendingReviewSummary,
} from '../../lib/transactionReview'
import { cn, formatBalance, formatDate, formatNumber } from '../../lib/utils'
import {
  approvePendingReviewTransaction,
  cancelPendingReviewTransaction,
  getPendingReviewSummary,
  getPendingReviewTransactions,
} from '../../services/transactions'

const LIMIT = 20

function SummaryCard({ label, value, icon: Icon, iconCls }) {
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', iconCls)}>
          <Icon size={15} />
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-card border border-border bg-card p-5 shadow-xl">
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
  )
}

function DetailDrawer({ row, canAct, acting, onClose, onApprove, onCancel }) {
  if (!row) return null
  const status = pickRowStatus(row)
  const badge = reviewStatusBadge(status)
  const fields = detailFieldsForRow(row)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]">
      <button type="button" className="flex-1 cursor-default" aria-label="Close detail" onClick={onClose} />
      <aside className="flex h-screen max-h-screen w-full max-w-lg shrink-0 flex-col overflow-hidden border-l border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-start justify-between border-b border-border px-4 py-4">
          <div className="min-w-0 pr-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Transaction review</p>
            <h2 className="mt-1 break-all font-mono text-sm text-text-primary">{pickReference(row) || '—'}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-text-secondary">{transactionTypeLabel(row.transaction_type)}</span>
              <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium', badge.cls)}>
                {badge.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-text-muted hover:bg-card-hover hover:text-text-primary"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <dl className="space-y-3">
            {fields.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border/60 bg-page/40 px-3 py-2.5">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{label}</dt>
                <dd className="mt-1 break-all text-sm text-text-primary">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </div>

        {canAct && canReviewRowActions(row) ? (
          <div className="flex shrink-0 gap-2 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={acting}
              onClick={onApprove}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-semibold text-page hover:brightness-105 disabled:opacity-50"
            >
              {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Approve
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={onCancel}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-error/40 bg-error-bg py-2.5 text-sm font-semibold text-error hover:bg-error/10 disabled:opacity-50"
            >
              <XCircle size={14} />
              Cancel
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

export default function DisputesPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const scopeAccountKey = searchParams.get('account_key')?.trim() || ''
  const scopeIdentifier = searchParams.get('identifier')?.trim() || ''

  const canAct = canDisputeUpdate(user?.permissions, user?.role)
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
  const [confirmCancel, setConfirmCancel] = useState(null)

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

  async function runReviewAction(row, action) {
    const reference = pickReference(row)
    const segment = reviewUrlSegment(row?.transaction_type)
    if (!reference || !segment) {
      setToast({ type: 'error', text: 'Missing reference or transaction type for this row.' })
      return
    }

    setActingRef(reference)
    try {
      if (action === 'approve') {
        await approvePendingReviewTransaction(segment, reference)
        setToast({ type: 'success', text: 'Transaction approved successfully.' })
      } else {
        await cancelPendingReviewTransaction(segment, reference)
        setToast({ type: 'success', text: 'Transaction cancelled (marked failed).' })
      }
      setSelected(null)
      setConfirmCancel(null)
      await Promise.all([fetchList(), fetchSummary()])
    } catch (err) {
      const status = err?.response?.status
      const msg = err?.response?.data?.message || err?.message || 'Request failed.'
      if (status === 409) {
        setToast({ type: 'error', text: 'Already processed — refreshing queue.' })
        await Promise.all([fetchList(), fetchSummary()])
        setSelected(null)
      } else if (status === 403) {
        setToast({ type: 'error', text: 'You do not have permission to review transactions.' })
      } else if (status === 404) {
        setToast({ type: 'error', text: 'Transaction not found.' })
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
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Pending review</h1>
        <p className="mt-1 max-w-3xl text-sm text-text-secondary">
          Transactions awaiting ops approval. Search the queue, review details, then approve or cancel pending items.
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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="overflow-hidden rounded-card border border-border bg-card">
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

        <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2">
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
          <div className="overflow-x-auto">
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
                    const showActions = canAct && canReviewRowActions(row)
                    const busy = actingRef === ref

                    return (
                      <tr key={`${row.transaction_type}-${ref}`} className="border-b border-border/40 hover:bg-card-hover/20">
                        <td className="px-4 py-3 text-text-secondary">{transactionTypeLabel(row.transaction_type)}</td>
                        <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-text-primary" title={ref}>
                          {ref || '—'}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-text-primary">{formatAmount(row)}</td>
                        <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-text-muted" title={row.wallet_key}>
                          {row.wallet_key || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium', badge.cls)}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary">
                          {row.date_created ? formatDate(row.date_created) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {showActions ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => runReviewAction(row, 'approve')}
                                  className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-page hover:brightness-105 disabled:opacity-50"
                                >
                                  {busy ? '…' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setConfirmCancel(row)}
                                  className="rounded-full border border-error/30 bg-error-bg px-3 py-1 text-[11px] font-semibold text-error hover:bg-error/20 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </>
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

        <div className="border-t border-border px-4 py-3">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} label="pending transactions" />
          {!loading && total > 0 ? (
            <p className="mt-2 text-center text-xs text-text-muted">{formatNumber(total)} pending total</p>
          ) : null}
        </div>
      </div>

      <DetailDrawer
        row={selected}
        canAct={canAct}
        acting={actingRef === pickReference(selected)}
        onClose={() => setSelected(null)}
        onApprove={() => selected && runReviewAction(selected, 'approve')}
        onCancel={() => selected && setConfirmCancel(selected)}
      />

      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancel pending transaction?"
        message="This will mark the transaction as failed. This action cannot be undone from the review queue."
        confirmLabel="Cancel transaction"
        danger
        loading={!!actingRef}
        onClose={() => setConfirmCancel(null)}
        onConfirm={() => confirmCancel && runReviewAction(confirmCancel, 'cancel')}
      />
    </div>
  )
}
