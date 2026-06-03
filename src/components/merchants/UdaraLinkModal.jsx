import { useEffect, useState } from 'react'
import { Link2, Loader2, X } from 'lucide-react'
import { beamerAccountLink, beamerAccountUpdate } from '../../services/merchants'
import {
  buildBeamerLinkBody,
  buildBeamerUpdateBody,
  getBeamerErrorMessage,
  isBeamerNoIntegrationError,
  isBeamerSuccess,
  isUdaraLinked,
} from '../../lib/beamerUi'

/**
 * Link or update Udara (Beamer) credentials for a merchant.
 * Uses account-link when udara360 is null; account-update when linked.
 */
export default function UdaraLinkModal({ open, merchant, onClose, onSuccess }) {
  const linked = isUdaraLinked(merchant)
  const udara = merchant?.udara360

  const [mode, setMode] = useState(linked ? 'update' : 'link')
  const [accountNumber, setAccountNumber] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientKey, setClientKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!open) return
    const isLinked = isUdaraLinked(merchant)
    setMode(isLinked ? 'update' : 'link')
    setAccountNumber(String(merchant?.udara360?.account_number ?? ''))
    setClientId(String(merchant?.udara360?.client_id ?? ''))
    setClientKey('')
    setMsg(null)
  }, [open, merchant])

  if (!open || !merchant) return null

  const isUpdate = mode === 'update'

  async function handleSubmit(e) {
    e.preventDefault()
    const accountKey = merchant.account_key
    if (!accountKey) return

    if (!accountNumber.trim() || !clientId.trim() || !clientKey.trim()) {
      setMsg({
        type: 'error',
        text: 'Account number, client id, and client key are required.',
      })
      return
    }

    setSubmitting(true)
    setMsg(null)
    const requestId = crypto.randomUUID()

    try {
      const body = isUpdate
        ? buildBeamerUpdateBody({
            udara360: udara,
            accountNumber,
            clientId,
            clientKey,
          })
        : buildBeamerLinkBody({ accountNumber, clientId, clientKey })

      const res = isUpdate
        ? await beamerAccountUpdate(accountKey, body, requestId)
        : await beamerAccountLink(accountKey, body, requestId)

      if (!isBeamerSuccess(res)) {
        const isvs = res?.data?.isvs ?? res?.isvs
        if (isvs) console.warn('[beamer] ISVS response', isvs)
        setMsg({
          type: 'error',
          text: isvs?.message || res?.message || 'Integration request did not succeed.',
        })
        return
      }

      setMsg({
        type: 'success',
        text: isUpdate
          ? 'Udara credentials updated successfully.'
          : `Linked ${merchant.name || accountKey} to Udara successfully.`,
      })
      await onSuccess?.()
      window.setTimeout(() => onClose?.(), 1200)
    } catch (err) {
      const text = getBeamerErrorMessage(err)
      const isvs = err?.response?.data?.data?.isvs ?? err?.response?.data?.isvs
      if (isvs) console.warn('[beamer] ISVS error', isvs)

      if (isUpdate && isBeamerNoIntegrationError(text)) {
        setMode('link')
        setMsg({
          type: 'error',
          text: `${text} Switched to link flow — enter credentials to link this merchant.`,
        })
        return
      }

      setMsg({ type: 'error', text })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-card border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="udara-link-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 id="udara-link-title" className="text-base font-medium text-text-primary">
              {isUpdate ? 'Update Udara credentials' : 'Link Udara account'}
            </h3>
            <p className="text-xs text-text-muted">
              {isUpdate
                ? 'Refresh Beamer integration credentials. Client secret is required and is never stored in merchant API responses.'
                : 'Enter Udara (Beamer) account number and client credentials from the Udara dashboard.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-card-hover hover:text-text-primary"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {msg ? (
          <div
            className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-xs ${
              msg.type === 'success'
                ? 'border-success/30 bg-success-bg text-success'
                : 'border-error/30 bg-error-bg text-error'
            }`}
            role="status"
          >
            {msg.text}
          </div>
        ) : null}

        <div className="mx-auto max-w-lg p-4">
          <form onSubmit={handleSubmit} className="rounded-xl border border-border/70 p-4">
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-page px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-text-muted">Merchant</p>
                <p className="mt-1 text-sm text-text-primary">{merchant.name || '—'}</p>
                <p className="font-mono text-[11px] text-text-muted break-all">{merchant.account_key || '—'}</p>
              </div>

              {isUpdate && udara?.identifier ? (
                <div className="rounded-lg border border-border/60 bg-page/50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-text-muted">Integration id</p>
                  <p className="mt-1 font-mono text-[11px] text-text-secondary break-all">{udara.identifier}</p>
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-xs text-text-muted">Account number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-page px-3 text-sm text-text-primary outline-none focus:border-accent/50"
                  placeholder="From Udara dashboard"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Client ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-page px-3 text-sm text-text-primary outline-none focus:border-accent/50"
                  placeholder="From Udara dashboard"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Client key</label>
                <input
                  type="text"
                  value={clientKey}
                  onChange={(e) => setClientKey(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-page px-3 text-sm text-text-primary outline-none focus:border-accent/50"
                  placeholder="Client secret (required)"
                  autoComplete="off"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-4 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent bg-[#F7F7F7] px-3 text-sm font-medium text-[#1a1c12] transition-all duration-150 hover:bg-[#e4e4e0] hover:text-[#0d0f0a] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              {isUpdate ? 'Update credentials' : 'Link to Udara'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
