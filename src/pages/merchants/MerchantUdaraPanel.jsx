import { useState } from 'react'
import { Link2, RefreshCw } from 'lucide-react'
import { cn, formatDate } from '../../lib/utils'
import { canUpdateMerchant } from '../../lib/permissions'
import { useAuth } from '../../context/AuthContext'
import { isUdaraLinked } from '../../lib/beamerUi'
import UdaraLinkModal from '../../components/merchants/UdaraLinkModal'

export default function MerchantUdaraPanel({
  merchant,
  onMerchantRefresh,
  linkModalOpen: linkModalOpenProp,
  onLinkModalOpenChange,
}) {
  const { user } = useAuth()
  const canManage = canUpdateMerchant(user?.permissions, user?.role)
  const linked = isUdaraLinked(merchant)
  const udara = merchant?.udara360

  const [internalModalOpen, setInternalModalOpen] = useState(false)
  const modalOpen = linkModalOpenProp ?? internalModalOpen
  const setModalOpen = onLinkModalOpenChange ?? setInternalModalOpen
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    if (!onMerchantRefresh) return
    setRefreshing(true)
    try {
      await onMerchantRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <>
      <section
        id="merchant-udara"
        className={cn(
          'scroll-mt-6 overflow-hidden rounded-card border bg-card shadow-sm',
          linked ? 'border-success/30' : 'border-warning/40'
        )}
      >
        <div className="flex flex-col gap-3 border-b border-border bg-[#0d0f14] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                linked ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'
              )}
            >
              <Link2 size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Udara (Beamer) integration</h2>
              <p className="mt-0.5 max-w-xl text-xs text-text-muted">
                NGN deposit rails via Udara360. Link once with account-link; refresh credentials with account-update
                when already linked.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex rounded-full px-3 py-1 text-xs font-medium',
                linked ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'
              )}
            >
              {linked ? 'Linked' : 'Not linked'}
            </span>
            <button
              type="button"
              disabled={refreshing}
              onClick={handleRefresh}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-card-hover"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : undefined} />
              Refresh
            </button>
            {canManage ? (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#C5DC4B] px-4 py-2 text-xs font-semibold text-black hover:brightness-105"
              >
                <Link2 size={14} />
                {linked ? 'Update credentials' : 'Link Udara account'}
              </button>
            ) : null}
          </div>
        </div>

        {!canManage ? (
          <div className="mx-4 mt-3 rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-xs text-warning">
            merchant.update permission is required to link or update Udara credentials.
          </div>
        ) : null}

        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-[#0b0d12] px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Account number</p>
            <p className="mt-1 font-mono text-sm text-text-primary">{udara?.account_number || '—'}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-[#0b0d12] px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Client ID</p>
            <p className="mt-1 font-mono text-sm text-text-primary break-all">{udara?.client_id || '—'}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-[#0b0d12] px-4 py-3 sm:col-span-2 lg:col-span-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Expiry date</p>
            <p className="mt-1 text-sm text-text-primary">
              {udara?.expiry_date ? formatDate(udara.expiry_date) : '—'}
            </p>
          </div>
        </div>

        {!linked ? (
          <p className="border-t border-border/60 px-4 py-3 text-xs text-text-muted">
            No Udara360 record on this merchant yet. Use <strong>Link Udara account</strong> to call{' '}
            <code className="text-[10px]">POST …/integrations/beamer/account-link</code>.
          </p>
        ) : null}
      </section>

      <UdaraLinkModal
        open={modalOpen}
        merchant={merchant}
        onClose={() => setModalOpen(false)}
        onSuccess={onMerchantRefresh}
      />
    </>
  )
}
