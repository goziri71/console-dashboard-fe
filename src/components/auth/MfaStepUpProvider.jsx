import { useEffect, useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import { stepUpMfa } from '../../services/auth'
import { registerMfaStepUpHandler } from '../../lib/mfaStepUp'
import OverlayPortal from '../ui/OverlayPortal'

export default function MfaStepUpProvider({ children }) {
  const [request, setRequest] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(
    () =>
      registerMfaStepUpHandler(
        () =>
          new Promise((resolve, reject) => {
            setCode('')
            setError('')
            setRequest({ resolve, reject })
          })
      ),
    []
  )

  const cancel = () => {
    request?.reject(new Error('MFA verification was cancelled.'))
    setRequest(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the six-digit code from your authenticator app.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await stepUpMfa(code)
      request?.resolve()
      setRequest(null)
      setCode('')
    } catch (err) {
      setError(err.response?.data?.message || 'The code could not be verified.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {children}
      <OverlayPortal open={Boolean(request)}>
        <div className="modal-overlay" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-mfa-title"
            className="modal-panel max-w-md p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <ShieldCheck className="text-accent" size={22} />
                </div>
                <div>
                  <h2 id="pricing-mfa-title" className="text-xl font-semibold text-text-primary">
                    Verify pricing change
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Enter a fresh authenticator code. Your pricing changes will be preserved.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cancel}
                disabled={submitting}
                className="rounded-full p-2 text-text-muted hover:bg-card-hover"
                aria-label="Cancel verification"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="123456"
                aria-label="Authenticator code"
                className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 text-center text-lg tracking-[0.3em] text-text-primary outline-none focus:border-accent/50"
              />
              {error ? <p className="text-sm text-error">{error}</p> : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancel}
                  disabled={submitting}
                  className="min-h-11 flex-1 rounded-full border border-border text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-11 flex-1 rounded-full bg-accent font-semibold text-page disabled:opacity-50"
                >
                  {submitting ? 'Verifying…' : 'Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </OverlayPortal>
    </>
  )
}
