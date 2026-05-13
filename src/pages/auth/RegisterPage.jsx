import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { register as registerUser } from '../../services/auth'
import authBranding from '../../assets/Authlogo/Container.svg'

const inputClass =
  'rounded-2xl border border-border bg-card px-4 py-4 text-sm text-text-primary placeholder-text-muted outline-none transition-all duration-200 focus:border-accent/50 focus:ring-1 focus:ring-accent/20'

const ROLE_OPTIONS = [
  { value: 'operations', label: 'Operations' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'growth', label: 'Growth' },
  { value: 'management', label: 'Management' },
  { value: 'ops_support', label: 'Ops support' },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState('operations')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim() || !firstName.trim() || !lastName.trim()) {
      setError('Please fill in email, password, first name, and last name.')
      return
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await registerUser({
        email: email.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role,
      })
      navigate('/login', { state: { registrationSuccess: true } })
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Registration failed. Please check your details or try again later.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#000000] lg:h-screen lg:min-h-0 lg:flex-row">
      {/* Mobile — branding strip (keeps form below fold, header stays in scroll area from top) */}
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

      {/* Start-aligned scroll: avoid justify-center clipping the title when the form is tall */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-[#000000] px-4 pt-5 pb-[max(2rem,env(safe-area-inset-bottom,0px))] sm:px-8 sm:pt-8 sm:pb-10 lg:pt-[max(3rem,env(safe-area-inset-top,0px))] lg:pb-[max(3rem,env(safe-area-inset-bottom,0px))]">
        <div
          className="animate-fade-in-up mx-auto w-full max-w-[500px] shrink-0 py-2 sm:py-4"
          style={{ animationDelay: '100ms' }}
        >
          <div className="mb-6 text-center sm:mb-8">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-3xl lg:text-[42px]">
              Create account
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary sm:mt-3 sm:text-base">
              Register for the Sterllo Operations Console. You will sign in on the next screen after your account is
              created.
            </p>
          </div>

          <div className="mb-6 flex flex-col items-center gap-2 sm:mb-8 sm:gap-3">
            <p className="text-center text-xs text-text-secondary sm:text-sm">Confirm you are on</p>
            <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-2 sm:px-6">
              <ShieldCheck size={18} className="shrink-0 text-accent" aria-hidden />
              <span className="break-all text-center text-xs text-text-primary sm:break-normal sm:text-sm">
                https://console.sterllo.com
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col">
                <label className="mb-1 px-1 text-sm text-text-secondary">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  className={inputClass}
                  placeholder="John"
                />
              </div>
              <div className="flex flex-col">
                <label className="mb-1 px-1 text-sm text-text-secondary">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className={inputClass}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="mb-1 px-1 text-sm text-text-secondary">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={inputClass}
                placeholder="user@example.com"
              />
            </div>

            <div className="flex flex-col">
              <label className="mb-1 px-1 text-sm text-text-secondary">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={`${inputClass} appearance-none`}
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-1 px-1 text-sm text-text-secondary">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`w-full ${inputClass} pr-12`}
                  placeholder="••••••••"
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

            <div className="flex flex-col">
              <label className="mb-1 px-1 text-sm text-text-secondary">Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            {error ? <p className="animate-shake text-center text-sm text-error">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-full bg-[#B8CF33] py-4 text-base font-semibold text-page transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98] disabled:opacity-50 disabled:hover:shadow-none"
            >
              {submitting ? 'Creating account…' : 'Create account'}
            </button>

            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border py-3.5 text-sm font-medium text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary"
            >
              <ArrowLeft size={16} />
              Back to login
            </Link>
          </form>
        </div>
      </div>
    </div>
  )
}
