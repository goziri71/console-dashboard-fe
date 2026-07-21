import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { cn } from '../../lib/utils'
import { createRbacUser } from '../../services/rbac'

const CONSOLE_ROLE_OPTIONS = [
  { value: 'operations', label: 'Operations' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'growth', label: 'Growth' },
  { value: 'management', label: 'Management' },
  { value: 'ops_support', label: 'Ops support' },
]

/**
 * Admin-only console user provisioning.
 */
export default function AdminCreateUserForm({
  disabled,
  inputCls,
  onSuccess,
  onError,
  pending,
  setPending,
}) {
  const [email, setEmail] = useState('')
  const [billerId, setBillerId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState('operations')

  const isSubmitting = pending === 'create-user'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (disabled) return

    if (!email.trim() || !firstName.trim() || !lastName.trim()) {
      onError('Email, first name, and last name are required.')
      return
    }

    setPending('create-user')
    try {
      await createRbacUser({
        email: email.trim(),
        ...(billerId.trim() ? { biller_id: billerId.trim() } : {}),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role_slug: role,
      })
      setEmail('')
      setBillerId('')
      setFirstName('')
      setLastName('')
      setRole('operations')
      onSuccess(`Console account created for ${email.trim()}. The user can sign in from the login page.`)
    } catch (err) {
      onError(err.response?.data?.message || err.message || 'Failed to create account.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="h-fit overflow-hidden rounded-card border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success-bg text-success">
            <UserPlus size={16} />
          </div>
          <div>
            <h2 className="text-base font-medium text-text-primary">Create console account</h2>
            <p className="text-xs text-text-muted">Add a new team member who can sign in from the login page.</p>
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-create-first" className="text-sm text-text-secondary">
              First name
            </label>
            <input
              id="admin-create-first"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="off"
              disabled={disabled}
              className={cn(inputCls, disabled && 'cursor-not-allowed opacity-60')}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-create-last" className="text-sm text-text-secondary">
              Last name
            </label>
            <input
              id="admin-create-last"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="off"
              disabled={disabled}
              className={cn(inputCls, disabled && 'cursor-not-allowed opacity-60')}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-create-email" className="text-sm text-text-secondary">
            Email
          </label>
          <input
            id="admin-create-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            disabled={disabled}
            className={cn(inputCls, disabled && 'cursor-not-allowed opacity-60')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-create-role" className="text-sm text-text-secondary">
            Initial role
          </label>
          <select
            id="admin-create-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={disabled}
            className={cn(inputCls, disabled && 'cursor-not-allowed opacity-60')}
          >
            {CONSOLE_ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-create-biller-id" className="text-sm text-text-secondary">
            Redbiller ID <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="admin-create-biller-id"
            type="text"
            value={billerId}
            onChange={(e) => setBillerId(e.target.value)}
            autoComplete="off"
            disabled={disabled}
            className={cn(inputCls, disabled && 'cursor-not-allowed opacity-60')}
          />
        </div>
        <button
          type="submit"
          disabled={disabled || isSubmitting}
          className={cn(
            'rounded-lg px-4 py-3 text-sm font-medium transition-colors active:scale-[0.98]',
            !disabled
              ? 'bg-accent text-[#1a1c12] hover:brightness-105 disabled:opacity-50'
              : 'cursor-not-allowed bg-card-hover text-text-muted'
          )}
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
