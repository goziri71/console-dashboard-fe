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
    <div className="flex h-screen w-full">
      {/* Left Panel — Branding image from Figma */}
      <div className="animate-fade-in relative hidden w-[478px] shrink-0 overflow-hidden lg:block bg-[#181818]">
        <img
          src={authBranding}
          alt="Sterllo"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#000000] px-4 py-8 sm:px-8">
        <div className="animate-fade-in-up w-full max-w-[500px]" style={{ animationDelay: '100ms' }}>
          {/* Welcome heading */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold leading-tight text-text-primary sm:text-[42px]">
              Welcome back 👋
            </h1>
            <p className="mt-3 text-base leading-relaxed text-text-secondary">
              Access the Sterllo Operations Console to manage customers, balances,
              transactions, compliance reporting, and operational workflows.
            </p>
          </div>

          {/* URL confirmation */}
          <div className="mb-10 flex flex-col items-center gap-3">
            <p className="text-sm text-text-secondary">
              Kindly confirm that you you're on
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-6 py-2">
              <ShieldCheck size={18} className="text-accent" />
              <span className="text-sm text-text-primary">https://console.sterllo.com</span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col">
              <label className="mb-1 px-1 text-sm text-text-secondary">
                Username / Email
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="johndoe@youremail.com"
                className="rounded-2xl border border-border bg-card px-4 py-4 text-sm text-text-primary placeholder-text-muted outline-none transition-all duration-200 focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
              />
            </div>

            <div className="flex flex-col">
              <label className="mb-1 px-1 text-sm text-text-secondary">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-border bg-card px-4 py-4 pr-12 text-sm text-text-primary placeholder-text-muted outline-none transition-all duration-200 focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                className="text-sm font-semibold text-accent hover:underline"
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
              className="mt-4 w-full rounded-full bg-[#B8CF33] py-4 text-base font-semibold text-page transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-none"
            >
              {submitting ? 'Signing in...' : 'Login to Console'}
            </button>

            <p className="mt-2 text-center text-base text-text-secondary">
              Don't have an account?{' '}
              <button type="button" className="font-semibold text-accent hover:underline">
                Create Account
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
