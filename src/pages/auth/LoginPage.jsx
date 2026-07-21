import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoaderCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { consumeAuthNotice } from '../../lib/authStorage'
import { extractAuthenticatedSession } from '../../lib/authUser'
import authBranding from '../../assets/Authlogo/Container.svg'

const PENDING_CROSSLINK_KEY = 'sterllo_pending_crosslink'
const ACCOUNT_LOGIN_URL =
  'https://account.redbiller.com/login?rr=https%3A%2F%2Fwww.console.sterllo.com%2F'

/** Survive React StrictMode remounts without burning the one-time Crosslink token twice. */
let inflightCrosslink = null
let inflightCrosslinkToken = null

function readCrosslinkTokenFromLocation() {
  const params = new URLSearchParams(window.location.search)
  const value = params.get('x92Qko8x9UwMs8') ?? params.get('token')
  return value ? value.trim() : null
}

function removeCrosslinkTokenFromLocation() {
  window.history.replaceState({}, '', window.location.pathname)
}

function redirectToAccountLogin() {
  window.location.replace(ACCOUNT_LOGIN_URL)
}

function captureCrosslinkTokenEarly() {
  try {
    const fromUrl = readCrosslinkTokenFromLocation()
    if (!fromUrl) return
    sessionStorage.setItem(PENDING_CROSSLINK_KEY, fromUrl)
    removeCrosslinkTokenFromLocation()
  } catch {
    // Ignore storage/history failures during boot.
  }
}

captureCrosslinkTokenEarly()

function takeCrosslinkTokenFromUrl() {
  const fromUrl = readCrosslinkTokenFromLocation()
  if (fromUrl) {
    sessionStorage.setItem(PENDING_CROSSLINK_KEY, fromUrl)
    removeCrosslinkTokenFromLocation()
    return fromUrl
  }
  return sessionStorage.getItem(PENDING_CROSSLINK_KEY)
}

function clearPendingCrosslinkToken() {
  sessionStorage.removeItem(PENDING_CROSSLINK_KEY)
  inflightCrosslink = null
  inflightCrosslinkToken = null
}

function crosslinkErrorMessage(error) {
  const status = error.response?.status
  const serverMessage = error.response?.data?.message
  if (status === 422) return serverMessage || 'Crosslink token is missing.'
  if (status === 401) {
    return (
      serverMessage ||
      'This Crosslink login is invalid, expired, or has already been used.'
    )
  }
  if (status === 404) {
    return serverMessage || 'Your account has not been provisioned for the Sterllo Console.'
  }
  if (status === 500 || status === 502) {
    return serverMessage || 'The login service is temporarily unavailable. Try again shortly.'
  }
  return serverMessage || error.message || 'Crosslink login failed.'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { token, startCrosslink, completeAuthentication } = useAuth()
  const [processing, setProcessing] = useState(() => Boolean(takeCrosslinkTokenFromUrl()))
  const [error, setError] = useState(() => consumeAuthNotice() || '')

  useEffect(() => {
    if (token) {
      clearPendingCrosslinkToken()
      navigate('/', { replace: true })
      return undefined
    }

    // Normal /login with no token starts the external account login flow.
    const crosslinkToken = takeCrosslinkTokenFromUrl()
    if (!crosslinkToken) {
      redirectToAccountLogin()
      return undefined
    }

    let cancelled = false

    if (!inflightCrosslink || inflightCrosslinkToken !== crosslinkToken) {
      inflightCrosslinkToken = crosslinkToken
      inflightCrosslink = startCrosslink(crosslinkToken)
    }

    inflightCrosslink
      .then((data) => {
        const session = extractAuthenticatedSession(data)
        if (!session) {
          throw new Error('Crosslink login did not return an authToken.')
        }
        // Persist even if this effect instance was cancelled (StrictMode).
        clearPendingCrosslinkToken()
        completeAuthentication(data)
        if (!cancelled) navigate('/', { replace: true })
      })
      .catch((err) => {
        if (cancelled) return
        clearPendingCrosslinkToken()
        setError(crosslinkErrorMessage(err))
        setProcessing(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, startCrosslink, completeAuthentication, navigate])

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

          {processing ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <LoaderCircle className="animate-spin text-accent" size={34} />
              <p className="text-sm text-text-secondary">Signing in…</p>
            </div>
          ) : (
            <div className="space-y-4">
              {error ? (
                <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-center text-sm text-error">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setError('')
                  redirectToAccountLogin()
                }}
                className="min-h-12 w-full cursor-pointer rounded-full bg-accent py-3.5 font-semibold text-page hover:opacity-90 active:scale-[0.98]"
              >
                Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
