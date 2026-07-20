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
    setCode('')
    setError('')
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
      setError(err.response?.data?.message || 'The code could not be verified. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {children}
      <OverlayPortal open={Boolean(request)}>
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="step-up-title"
            className="w-full max-w-md rounded-3xl border border-border bg-page p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <ShieldCheck className="text-accent" size={22} />
                </div>
                <div>
                  <h2 id="step-up-title" className="text-xl font-semibold text-text-primary">
                    Verify this sensitive action
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Enter a fresh code from your authenticator. The action will continue after verification.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cancel}
                disabled={submitting}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-card hover:text-text-primary"
                aria-label="Cancel verification"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="step-up-code" className="mb-1 block text-sm text-text-secondary">
                  Authenticator code
                </label>
                <input
                  id="step-up-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="123456"
                  className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 text-center text-lg tracking-[0.3em] text-text-primary outline-none focus:border-accent/50"
                />
              </div>
              {error && <p className="text-sm text-error">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancel}
                  disabled={submitting}
                  className="min-h-11 flex-1 rounded-full border border-border font-semibold text-text-primary hover:border-accent/40 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-11 flex-1 rounded-full bg-accent font-semibold text-page hover:opacity-90 disabled:opacity-50"
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
