import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../../context/AuthContext'
import { consumeAuthNotice } from '../../lib/authStorage'
import { extractAuthenticatedSession } from '../../lib/authUser'
import authBranding from '../../assets/Authlogo/Container.svg'

/** Survive React StrictMode remounts during MFA without resetting mid-challenge. */
let activeMfaChallenge = null

function clearActiveMfaChallenge() {
  activeMfaChallenge = null
}

const ALPHA_MFA_REQUIRED_DEFAULT =
  'MFA is not enabled on your Alpha account. Enable MFA on Redbiller/Alpha, then sign in to Console again.'

function authErrorMessage(error) {
  const status = error.response?.status
  const body = error.response?.data
  const serverMessage = body?.message
  const dataCode = body?.data?.code ?? body?.code

  if (status === 400) {
    return serverMessage || 'Check your email and password and try again.'
  }
  if (status === 401) {
    return serverMessage || 'Invalid email, password, or authenticator code.'
  }
  if (status === 403) {
    const mfaGate =
      dataCode === 'alpha_mfa_required' ||
      dataCode === 'account_mfa_disabled' ||
      /account\.mfa|mfa.*not enabled|enable mfa/i.test(String(serverMessage ?? ''))
    if (mfaGate || !serverMessage) {
      return serverMessage || ALPHA_MFA_REQUIRED_DEFAULT
    }
    return serverMessage
  }
  if (status === 404) {
    return serverMessage || 'User not provisioned. Contact admin.'
  }
  if (status === 409) {
    return serverMessage || 'This authentication request is no longer valid.'
  }
  if (status === 429) return 'Too many attempts. Wait a moment and try again.'
  if (status === 502) {
    return serverMessage || 'Alpha Account Auth is unreachable or misconfigured. Try again shortly.'
  }
  if (status === 500) {
    return serverMessage || 'The login service is temporarily unavailable. Try again shortly.'
  }
  return serverMessage || error.message || 'Authentication failed. Please try again.'
}

function isAlphaMfa(data) {
  const provider = String(data?.provider ?? '').toLowerCase()
  return provider === 'alpha' || provider === ''
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { token, login, confirmMfaEnrollment, verifyMfaChallenge, completeAuthentication } =
    useAuth()
  const [flow, setFlow] = useState(() => activeMfaChallenge || { status: 'credentials' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState(() => consumeAuthNotice() || '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (token) {
      clearActiveMfaChallenge()
      navigate('/dashboard', { replace: true })
    }
  }, [token, navigate])

  const applyLoginResult = (data) => {
    if (data?.state === 'mfa_enrollment_required') {
      activeMfaChallenge = { status: 'enrollment', data }
      setFlow(activeMfaChallenge)
      return
    }
    if (data?.state === 'mfa_required') {
      activeMfaChallenge = { status: 'verification', data }
      setFlow(activeMfaChallenge)
      return
    }
    if (!extractAuthenticatedSession(data)) {
      throw new Error(`Unexpected login state "${data?.state ?? 'unknown'}".`)
    }
    clearActiveMfaChallenge()
    completeAuthentication(data)
    navigate('/dashboard', { replace: true })
  }

  const handleLoginFailure = (err) => {
    if (err.response?.status === 403) {
      clearActiveMfaChallenge()
      setFlow({ status: 'credentials' })
      setCode('')
    }
    setError(authErrorMessage(err))
  }

  const submitCredentials = async (event) => {
    event.preventDefault()
    setError('')
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError('Enter your email and password.')
      return
    }

    setSubmitting(true)
    try {
      const data = await login(trimmedEmail, password)
      applyLoginResult(data)
    } catch (err) {
      handleLoginFailure(err)
    } finally {
      setSubmitting(false)
    }
  }

  const submitCode = async (event) => {
    event.preventDefault()
    setError('')
    const value = code.trim()
    if (!/^\d{6}$/.test(value)) {
      setError('Enter the six-digit code from your Alpha authenticator app.')
      return
    }

    setSubmitting(true)
    try {
      const challengeToken = flow.data.challenge_token
      const data =
        flow.status === 'enrollment'
          ? await confirmMfaEnrollment(challengeToken, value)
          : await verifyMfaChallenge(challengeToken, value)
      applyLoginResult(data)
    } catch (err) {
      handleLoginFailure(err)
    } finally {
      setSubmitting(false)
    }
  }

  const renderFlow = () => {
    if (flow.status === 'enrollment' || flow.status === 'verification') {
      const enrollment = flow.status === 'enrollment'
      const otpauthUri = flow.data.factor?.otpauth_uri
      const manualSecret = flow.data.factor?.secret
      const showQr = enrollment && typeof otpauthUri === 'string' && otpauthUri.length > 0

      return (
        <form onSubmit={submitCode} className="space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-text-primary">
              {enrollment ? 'Alpha MFA enrollment' : 'Alpha MFA verification'}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {enrollment
                ? showQr
                  ? 'Scan the QR code with your authenticator app, then enter the six-digit code.'
                  : 'Complete MFA setup in your Alpha account security settings, then enter the six-digit code from your authenticator app.'
                : 'Enter the six-digit code from your Alpha authenticator app (TOTP).'}
            </p>
            {isAlphaMfa(flow.data) ? (
              <p className="mt-2 text-xs text-text-muted">
                Secured by Alpha Account Auth. Console recovery codes are not used at login.
              </p>
            ) : null}
          </div>

          {showQr ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-2xl bg-white p-4">
                <QRCodeSVG value={otpauthUri} size={184} level="M" />
              </div>
              {manualSecret ? (
                <div className="w-full rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-xs text-text-muted">Manual setup key</p>
                  <code className="mt-1 block break-all text-sm text-text-primary">
                    {manualSecret}
                  </code>
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <label htmlFor="mfa-code" className="mb-1 block px-1 text-sm text-text-secondary">
              Authenticator code
            </label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder="123456"
              autoFocus
              className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 text-center text-lg tracking-[0.3em] text-text-primary outline-none focus:border-accent/50"
            />
          </div>

          {error ? <p className="text-center text-sm text-error">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-full bg-accent py-3.5 font-semibold text-page hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Verifying…' : enrollment ? 'Confirm enrollment' : 'Verify and continue'}
          </button>
        </form>
      )
    }

    return (
      <form onSubmit={submitCredentials} className="space-y-5">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-text-primary">Sign in</h2>
          <p className="mt-2 text-sm text-text-secondary">Enter your email and password.</p>
        </div>

        <div>
          <label htmlFor="login-email" className="mb-1 block px-1 text-sm text-text-secondary">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoFocus
            required
            className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 text-sm text-text-primary outline-none focus:border-accent/50"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="mb-1 block px-1 text-sm text-text-secondary">
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 pr-12 text-sm text-text-primary outline-none focus:border-accent/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-0 flex items-center px-4 text-text-muted hover:text-text-primary"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-center text-sm text-error">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="min-h-12 w-full rounded-full bg-accent py-3.5 font-semibold text-page hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-center text-xs leading-relaxed text-text-muted">
          Signing in successfully on this device will sign out the previously active device.
        </p>
      </form>
    )
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#000000] lg:h-screen lg:min-h-0 lg:flex-row">
      <div className="relative h-28 w-full shrink-0 overflow-hidden bg-[#181818] sm:h-36 lg:hidden">
        <img
          src={authBranding}
          alt="Sterllo"
          className="h-full w-full object-cover object-[center_20%]"
        />
      </div>

      <div className="animate-fade-in relative hidden w-[478px] shrink-0 overflow-hidden bg-[#181818] lg:block">
        <img src={authBranding} alt="Sterllo" className="h-full w-full object-cover" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-y-contain bg-[#000000] px-4 py-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:px-8 sm:py-10">
        <div
          className="animate-fade-in-up mx-auto w-full max-w-[500px] py-2 sm:py-4"
          style={{ animationDelay: '100ms' }}
        >
          <div className="mb-6 text-center sm:mb-8">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-3xl lg:text-[42px]">
              Sterllo Console
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary sm:mt-3 sm:text-base">
              Secure access for operational and financial workflows.
            </p>
          </div>

          <div className="mb-6 flex flex-col items-center gap-2 sm:mb-10 sm:gap-3">
            <p className="text-center text-xs text-text-secondary sm:text-sm">
              Kindly confirm that you are on
            </p>
            <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-2 sm:px-6">
              <ShieldCheck size={18} className="shrink-0 text-accent" aria-hidden />
              <span className="break-all text-center text-xs text-text-primary sm:break-normal sm:text-sm">
                https://console.sterllo.com
              </span>
            </div>
          </div>

          {renderFlow()}
        </div>
      </div>
    </div>
  )
}
