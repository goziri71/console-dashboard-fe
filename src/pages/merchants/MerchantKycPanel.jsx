import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { approveMerchantKyc, getMerchantKycs } from '../../services/kyc'
import { canKycUpdate } from '../../lib/permissions'
import { useAuth } from '../../context/AuthContext'
import { cn, formatDate, formatNumber } from '../../lib/utils'
import KycApproveConfirmDialog from '../../components/kyc/KycApproveConfirmDialog'
import {
  getApiErrorMessage,
  isKycRowApprovable,
  kycAggregateLabel,
  kycIdentificationLabel,
  kycRowReference,
  kycRowStatusKey,
  kycStatusPillClass,
  normalizeKycAggregateStatus,
  parseMerchantKycApproveResponse,
  parseMerchantKycListResponse,
} from '../../lib/kycUi'
import { useKycDisplayStatus } from '../../hooks/useKycDisplayStatus'

const KYC_PAGE_SIZE = 10

function inferTotalPages(total, limit, currentPage, rowCount) {
  const t = Number(total)
  if (Number.isFinite(t) && t > 0) return Math.max(1, Math.ceil(t / limit))
  if (rowCount < limit) return Math.max(1, currentPage)
  return Math.max(currentPage + 1, 2)
}

export default function MerchantKycPanel({ accountKey, merchantProfile, onKycMetaChange }) {
  const { user } = useAuth()
  const canApprove = canKycUpdate(user?.permissions, user?.role)
  const onMetaRef = useRef(onKycMetaChange)
  onMetaRef.current = onKycMetaChange

  const [records, setRecords] = useState([])
  const [merchantKyc, setMerchantKyc] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [approving, setApproving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [confirm, setConfirm] = useState({ open: false, reference: null, approveAll: false })

  const profileKycStatus = merchantProfile?.kyc_status ?? merchantProfile?.kyc_verification_status

  const localAggregateKey = useMemo(
    () => normalizeKycAggregateStatus(merchantKyc?.kyc_status ?? profileKycStatus),
    [merchantKyc?.kyc_status, profileKycStatus]
  )
  const { kycKey: aggregateKey } = useKycDisplayStatus(merchantProfile, localAggregateKey)

  const approvableRows = useMemo(() => records.filter(isKycRowApprovable), [records])
  const showApproveAll =
    canApprove &&
    (pendingCount > 0 ||
      aggregateKey === 'pending' ||
      approvableRows.length > 0)

  const emitMeta = useCallback((meta) => {
    onMetaRef.current?.(meta)
  }, [])

  const loadKycs = useCallback(async () => {
    if (!accountKey) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getMerchantKycs(accountKey, { page, limit: KYC_PAGE_SIZE })
      const parsed = parseMerchantKycListResponse(res)
      setRecords(parsed.records)
      setMerchantKyc(parsed.merchant)
      const rowPending = parsed.records.filter(isKycRowApprovable).length
      const pending =
        Number.isFinite(parsed.pendingCount) && parsed.pendingCount > 0
          ? parsed.pendingCount
          : rowPending
      setPendingCount(pending)
      const total = Number(
        parsed.pagination?.total ?? parsed.merchant?.kyc_record_count ?? parsed.records.length
      )
      setTotalPages(inferTotalPages(total, KYC_PAGE_SIZE, page, parsed.records.length))
      emitMeta({
        status: parsed.merchant?.kyc_status ?? profileKycStatus,
        pendingCount: pending,
        recordCount: parsed.merchant?.kyc_record_count ?? parsed.records.length,
      })
    } catch (err) {
      setRecords([])
      setMerchantKyc(null)
      const profilePending =
        normalizeKycAggregateStatus(profileKycStatus) === 'pending' ? 1 : 0
      setPendingCount(profilePending)
      setTotalPages(1)
      setLoadError(getApiErrorMessage(err, 'Failed to load merchant KYC.'))
      emitMeta({
        status: profileKycStatus ?? null,
        pendingCount: profilePending,
        recordCount: 0,
      })
    } finally {
      setLoading(false)
    }
  }, [accountKey, page, profileKycStatus, emitMeta])

  useEffect(() => {
    loadKycs()
  }, [loadKycs])

  const runApprove = async () => {
    if (!accountKey || !canApprove) return
    setApproving(true)
    setMsg(null)
    try {
      const body = confirm.approveAll ? {} : confirm.reference ? { reference: confirm.reference } : {}
      const res = await approveMerchantKyc(accountKey, body)
      const parsed = parseMerchantKycApproveResponse(res)
      const count =
        parsed.approvedCount > 0
          ? parsed.approvedCount
          : confirm.approveAll
            ? Math.max(pendingCount, 1)
            : 1
      setMsg({
        type: 'success',
        text: count > 1 ? `${count} KYC records approved.` : 'Merchant KYC approved.',
      })
      setConfirm({ open: false, reference: null, approveAll: false })
      await loadKycs()
    } catch (err) {
      setMsg({
        type: 'error',
        text: getApiErrorMessage(err, 'Failed to approve merchant KYC.'),
      })
    } finally {
      setApproving(false)
    }
  }

  const confirmMessage = confirm.approveAll
    ? 'Approve all pending merchant KYC documents for this account?'
    : `Approve merchant KYC record ${confirm.reference || ''}?`

  return (
    <section
      id="merchant-kyc"
      className={cn(
        'scroll-mt-6 overflow-hidden rounded-card border-2 bg-card shadow-sm',
        aggregateKey === 'pending' || pendingCount > 0
          ? 'border-warning/50 ring-1 ring-warning/20'
          : 'border-accent/30'
      )}
    >
      <div className="flex flex-col gap-3 border-b border-border bg-[#0d0f14] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Merchant KYC approval</h2>
            <p className="mt-0.5 max-w-xl text-xs text-text-muted">
              To approve: click <strong>Approve</strong> on a pending row, or{' '}
              <strong>Approve all pending</strong>. This calls{' '}
              <code className="text-[10px]">POST /merchants/…/kyc/approve</code> (not Upgrade tier).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex rounded-full px-3 py-1 text-xs font-medium',
              kycStatusPillClass(aggregateKey)
            )}
          >
            {kycAggregateLabel(aggregateKey)}
          </span>
          <span className="text-xs text-text-muted tabular-nums">
            {formatNumber(merchantKyc?.kyc_record_count ?? records.length)} records
            {pendingCount > 0 ? ` · ${formatNumber(pendingCount)} pending` : ''}
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={() => loadKycs()}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-card-hover"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : undefined} />
            Refresh
          </button>
          {showApproveAll ? (
            <button
              type="button"
              disabled={approving || loading}
              onClick={() => setConfirm({ open: true, reference: null, approveAll: true })}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#C5DC4B] px-4 py-2 text-xs font-semibold text-black hover:brightness-105 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              Approve all pending
            </button>
          ) : null}
        </div>
      </div>

      {!canApprove ? (
        <div className="mx-4 mt-3 rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-xs text-warning">
          You need <strong>kyc.update</strong> or <strong>*</strong> on your profile, or an{' '}
          <strong>operations</strong> / <strong>compliance</strong> role to approve. Ask an admin to
          assign the permission in Admin → Roles.
        </div>
      ) : null}

      {loadError ? (
        <div className="mx-4 mt-3 space-y-2 rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm text-error">
          <p>{loadError}</p>
          {canApprove && aggregateKey === 'pending' ? (
            <button
              type="button"
              disabled={approving}
              onClick={() => setConfirm({ open: true, reference: null, approveAll: true })}
              className="inline-flex items-center gap-2 rounded-full bg-[#C5DC4B] px-3 py-1.5 text-xs font-semibold text-black"
            >
              <CheckCircle2 size={14} />
              Try approve all pending anyway
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => loadKycs()}
            className="block text-xs font-medium underline"
          >
            Retry load
          </button>
        </div>
      ) : null}

      {msg ? (
        <div
          className={cn(
            'mx-4 mt-3 rounded-lg border px-3 py-2 text-sm',
            msg.type === 'success'
              ? 'border-success/30 bg-success-bg text-success'
              : 'border-error/30 bg-error-bg text-error'
          )}
        >
          {msg.text}
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : records.length ? (
        <div className="table-scroll p-2">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs text-text-muted">
                <th className="px-3 py-2.5 font-medium">Reference</th>
                <th className="px-3 py-2.5 font-medium">Identification</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Created</th>
                <th className="px-3 py-2.5 font-medium w-28">Approve</th>
              </tr>
            </thead>
            <tbody>
              {records.map((row, ri) => {
                const ref = kycRowReference(row)
                const sk = kycRowStatusKey(row)
                const approvable = isKycRowApprovable(row)
                const dateRaw = row.date_created ?? row.created_at ?? row.date_modified
                return (
                  <tr key={ref || `mkyc-${ri}`} className="border-b border-border/40">
                    <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">{ref || '—'}</td>
                    <td className="px-3 py-2.5 text-text-primary">{kycIdentificationLabel(row)}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize',
                          kycStatusPillClass(sk)
                        )}
                      >
                        {row.compliance_status || sk}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-text-muted">
                      {dateRaw ? formatDate(dateRaw) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {canApprove && approvable && ref ? (
                        <button
                          type="button"
                          disabled={approving}
                          onClick={() => setConfirm({ open: true, reference: ref, approveAll: false })}
                          className="rounded-lg bg-[#C5DC4B] px-3 py-1.5 text-[11px] font-semibold text-black hover:brightness-105 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      ) : (
                        <span className="text-xs text-text-muted">{approvable ? '—' : 'Done'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-text-muted">
            {loadError
              ? 'Could not load KYC rows. If status is still Pending, use Approve all above.'
              : 'No merchant KYC records returned.'}
          </p>
          {canApprove && (aggregateKey === 'pending' || pendingCount > 0) ? (
            <button
              type="button"
              disabled={approving}
              onClick={() => setConfirm({ open: true, reference: null, approveAll: true })}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#C5DC4B] px-4 py-2 text-sm font-semibold text-black hover:brightness-105"
            >
              <CheckCircle2 size={16} />
              Approve pending merchant KYC
            </button>
          ) : null}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-text-muted">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full border border-border px-3 py-1 hover:bg-card-hover disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border border-border px-3 py-1 hover:bg-card-hover disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <KycApproveConfirmDialog
        open={confirm.open}
        title={confirm.approveAll ? 'Approve all pending KYC' : 'Approve KYC record'}
        message={confirmMessage}
        loading={approving}
        onCancel={() => !approving && setConfirm({ open: false, reference: null, approveAll: false })}
        onConfirm={runApprove}
      />
    </section>
  )
}
