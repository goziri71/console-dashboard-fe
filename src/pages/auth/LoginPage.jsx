import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import authBranding from '../../assets/Authlogo/Container.svg'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.')
      return
    }

    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Login failed. Please check your credentials.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#000000] lg:h-screen lg:min-h-0 lg:flex-row">
      {/* Mobile / tablet — compact branding strip */}
      <div className="relative h-28 w-full shrink-0 overflow-hidden bg-[#181818] sm:h-36 lg:hidden">
        <img
          src={authBranding}
          alt="Sterllo"
          className="h-full w-full object-cover object-[center_20%]"
        />
      </div>

      {/* Desktop — full-height branding */}
      <div className="animate-fade-in relative hidden w-[478px] shrink-0 overflow-hidden bg-[#181818] lg:block">
        <img
          src={authBranding}
          alt="Sterllo"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Login form — scrolls on short viewports / when keyboard opens */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-[#000000] px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:px-8 sm:pt-8 sm:pb-10 lg:min-h-0 lg:pt-[max(3rem,env(safe-area-inset-top,0px))] lg:pb-[max(3rem,env(safe-area-inset-bottom,0px))]">
        <div
          className="animate-fade-in-up mx-auto w-full max-w-[500px] py-2 sm:py-4"
          style={{ animationDelay: '100ms' }}
        >
          <div className="mb-6 text-center sm:mb-8">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-3xl lg:text-[42px]">
              Welcome back 👋
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary sm:mt-3 sm:text-base">
              Access the Sterllo Operations Console to manage customers, balances,
              transactions, compliance reporting, and operational workflows.
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-col">
              <label className="mb-1 px-1 text-sm text-text-secondary" htmlFor="login-email">
                Username / Email
              </label>
              <input
                id="login-email"
                type="text"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="johndoe@youremail.com"
                className="min-h-11 rounded-2xl border border-border bg-card px-4 py-3 text-base text-text-primary placeholder-text-muted outline-none transition-all duration-200 focus:border-accent/50 focus:ring-1 focus:ring-accent/20 sm:min-h-0 sm:py-4 sm:text-sm"
              />
            </div>

            <div className="flex flex-col">
              <label className="mb-1 px-1 text-sm text-text-secondary" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="min-h-11 w-full rounded-2xl border border-border bg-card px-4 py-3 pr-12 text-base text-text-primary placeholder-text-muted outline-none transition-all duration-200 focus:border-accent/50 focus:ring-1 focus:ring-accent/20 sm:min-h-0 sm:py-4 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-text-muted transition-colors hover:text-text-secondary sm:right-2 sm:h-10 sm:w-10"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                className="min-h-11 px-3 py-2 text-sm font-semibold text-accent hover:underline sm:min-h-0"
              >
                Forgot Password?
              </button>
            </div>

            {error && (
              <p className="animate-shake text-center text-sm text-error">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 min-h-12 w-full rounded-full bg-[#B8CF33] py-3.5 text-base font-semibold text-page transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-none sm:mt-4 sm:min-h-0 sm:py-4"
            >
              {submitting ? 'Signing in…' : 'Login to Console'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
