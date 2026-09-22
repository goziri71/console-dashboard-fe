import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
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

function authErrorMessage(error, stage) {
  const status = error.response?.status
  const serverMessage = error.response?.data?.message
  if (status === 400) {
    return serverMessage || 'Check your email and password and try again.'
  }
  if (status === 401) {
    return stage === 'credentials'
      ? serverMessage || 'Invalid email or password.'
      : serverMessage || 'The code is incorrect, expired, or has already been used.'
  }
  if (status === 404) {
    return (
      serverMessage ||
      'User not provisioned. Contact an administrator to be added to Sterllo Console.'
    )
  }
  if (status === 409) {
    return serverMessage || 'This authentication request is no longer valid.'
  }
  if (status === 429) return 'Too many attempts. Wait a moment and try again.'
  if (status === 500 || status === 502) {
    return (
      serverMessage ||
      'The login service is temporarily unavailable. Try again shortly.'
    )
  }
  return serverMessage || error.message || 'Authentication failed. Please try again.'
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
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)
  const [error, setError] = useState(() => consumeAuthNotice() || '')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

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
      setError(authErrorMessage(err, 'credentials'))
    } finally {
      setSubmitting(false)
    }
  }

  const submitCode = async (event) => {
    event.preventDefault()
    setError('')
    const value = code.trim()
    if (!useRecoveryCode && !/^\d{6}$/.test(value)) {
      setError('Enter the six-digit code from your authenticator app.')
      return
    }
    if (useRecoveryCode && !value) {
      setError('Enter one of your unused recovery codes.')
      return
    }

    setSubmitting(true)
    try {
      if (flow.status === 'enrollment') {
        const data = await confirmMfaEnrollment(flow.data.challenge_token, value)
        if (!extractAuthenticatedSession(data)) {
          throw new Error('MFA enrollment was not completed.')
        }
        const recoveryCodes = Array.isArray(data.recovery_codes) ? data.recovery_codes : []
        if (recoveryCodes.length) {
          setCode('')
          activeMfaChallenge = { status: 'recovery_codes', data, recoveryCodes }
          setFlow(activeMfaChallenge)
        } else {
          clearActiveMfaChallenge()
          completeAuthentication(data)
          navigate('/dashboard', { replace: true })
        }
      } else if (flow.status === 'verification') {
        const data = await verifyMfaChallenge(flow.data.challenge_token, {
          type: useRecoveryCode ? 'recovery_code' : 'totp',
          value,
        })
        clearActiveMfaChallenge()
        completeAuthentication(data)
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(authErrorMessage(err, 'mfa'))
    } finally {
      setSubmitting(false)
    }
  }

  const copyRecoveryCodes = async () => {
    try {
      await navigator.clipboard.writeText(flow.recoveryCodes.join('\n'))
      setCopied(true)
    } catch {
      setError('Could not copy automatically. Save the codes manually.')
    }
  }

  const finishEnrollment = () => {
    clearActiveMfaChallenge()
    completeAuthentication(flow.data)
    navigate('/dashboard', { replace: true })
  }

  const renderFlow = () => {
    if (flow.status === 'recovery_codes') {
      return (
        <div className="space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-text-primary">Save your recovery codes</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Each code can be used once if you lose access to your authenticator.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
            {flow.recoveryCodes.map((recoveryCode) => (
              <code
                key={recoveryCode}
                className="rounded-lg bg-page px-3 py-2 text-center text-sm text-text-primary"
              >
                {recoveryCode}
              </code>
            ))}
          </div>
          {error ? <p className="text-center text-sm text-error">{error}</p> : null}
          <button
            type="button"
            onClick={copyRecoveryCodes}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border text-sm font-semibold text-text-primary hover:border-accent/50"
          >
            {copied ? <Check size={17} /> : <Copy size={17} />}
            {copied ? 'Copied' : 'Copy recovery codes'}
          </button>
          <button
            type="button"
            onClick={finishEnrollment}
            className="min-h-12 w-full rounded-full bg-accent py-3.5 font-semibold text-page hover:opacity-90"
          >
            I have saved my recovery codes
          </button>
        </div>
      )
    }

    if (flow.status === 'enrollment' || flow.status === 'verification') {
      const enrollment = flow.status === 'enrollment'
      return (
        <form onSubmit={submitCode} className="space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-text-primary">
              {enrollment ? 'Set up multi-factor authentication' : 'Verify your identity'}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {enrollment
                ? 'Scan the QR code with your authenticator app, then enter its six-digit code.'
                : 'Enter the code from your authenticator app.'}
            </p>
          </div>

          {enrollment && flow.data.factor?.otpauth_uri ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-2xl bg-white p-4">
                <QRCodeSVG value={flow.data.factor.otpauth_uri} size={184} level="M" />
              </div>
              <div className="w-full rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xs text-text-muted">Manual setup key</p>
                <code className="mt-1 block break-all text-sm text-text-primary">
                  {flow.data.factor.secret}
                </code>
              </div>
            </div>
          ) : null}

          <div>
            <label htmlFor="mfa-code" className="mb-1 block px-1 text-sm text-text-secondary">
              {useRecoveryCode ? 'Recovery code' : 'Authenticator code'}
            </label>
            <input
              id="mfa-code"
              type="text"
              inputMode={useRecoveryCode ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              value={code}
              onChange={(event) =>
                setCode(
                  useRecoveryCode
                    ? event.target.value.toUpperCase()
                    : event.target.value.replace(/\D/g, '').slice(0, 6)
                )
              }
              placeholder={useRecoveryCode ? 'ABCD-1234-EF56-7890' : '123456'}
              autoFocus
              className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 text-center text-lg tracking-[0.3em] text-text-primary outline-none focus:border-accent/50"
            />
          </div>

          {!enrollment && flow.data.methods?.includes('recovery_code') ? (
            <button
              type="button"
              onClick={() => {
                setUseRecoveryCode((current) => !current)
                setCode('')
                setError('')
              }}
              className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-accent hover:underline"
            >
              <KeyRound size={16} />
              {useRecoveryCode ? 'Use an authenticator code' : 'Use a recovery code instead'}
            </button>
          ) : null}

          {error ? <p className="text-center text-sm text-error">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-full bg-accent py-3.5 font-semibold text-page hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Verifying…' : enrollment ? 'Confirm setup' : 'Verify and continue'}
          </button>
        </form>
      )
    }

    return (
      <form onSubmit={submitCredentials} className="space-y-5">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-text-primary">Sign in</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Use your Sterllo account email and password.
          </p>
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
