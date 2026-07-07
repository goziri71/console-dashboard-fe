import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  KeyRound,
  Lock,
  Search,
  Shield,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import OverlayPortal from '../../components/ui/OverlayPortal'
import { useAuth } from '../../context/AuthContext'
import Pagination from '../../components/ui/Pagination'
import { cn, formatDate } from '../../lib/utils'
import {
  PERMISSION_ALL,
  PERMISSION_FINANCIAL_READ,
  canManageRbac,
  isManagementRoleSlug,
  sanitizePermissionKeysForRole,
  validateRolePermissionKeysForSave,
} from '../../lib/permissions'
import {
  assignUserRole,
  createRbacRole,
  listRbacPermissions,
  listRbacRoles,
  listRbacUsers,
  patchRolePermissions,
  revokeUserRole,
} from '../../services/rbac'
import AdminCreateUserForm from './AdminCreateUserForm'

const BANNER_AUTO_DISMISS_MS = 5000

function normalizePermission(p) {
  const key = p.key ?? p.permission_key ?? p.slug ?? p.id
  return {
    key: String(key ?? ''),
    description: String(p.description ?? p.label ?? p.name ?? ''),
  }
}

function normalizeRole(r) {
  const id = r.id ?? r.role_id ?? r.uuid
  const slug = r.slug ?? r.role_slug ?? ''
  const keys = r.permission_keys ?? r.permissionKeys ?? r.keys ?? []
  const pathId = id != null && id !== '' ? String(id) : String(slug)
  return {
    pathId,
    slug: String(slug),
    label: String((r.label ?? r.name ?? slug) || 'Role'),
    permission_keys: Array.isArray(keys) ? keys.map(String) : [],
  }
}

function normalizeTeamUser(row) {
  const roleRows = Array.isArray(row.roles) ? row.roles : []
  return {
    id: row.id,
    email: String(row.email ?? ''),
    userKey: String(row.user_key ?? row.userKey ?? ''),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    dateCreated: row.date_created,
    lastLogin: row.last_login,
    roles: roleRows.map((r) => ({
      slug: String(r.slug ?? ''),
      label: String(r.label ?? r.slug ?? ''),
    })),
  }
}

function SummaryCard({ label, value, hint, icon: Icon, iconWrapCls }) {
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className={iconWrapCls}>
          <Icon size={14} />
        </div>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <p className="text-[34px] font-semibold leading-none text-text-primary">{value}</p>
      <p className="mt-2 text-[11px] leading-snug text-text-muted">{hint}</p>
    </div>
  )
}

function PermChip({ children, highlight, title: titleAttr }) {
  return (
    <span
      title={titleAttr}
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        highlight
          ? 'bg-accent/15 text-accent'
          : 'bg-card-hover text-text-secondary'
      )}
    >
      {children}
    </span>
  )
}

function permissionChipLabel(key, catalogByKey) {
  const meta = catalogByKey.get(key)
  if (key === PERMISSION_FINANCIAL_READ) {
    return meta?.description || 'View balances & amounts'
  }
  if (meta?.description) return meta.description
  return key
}

const ADMIN_TABS = [
  { id: 'team', label: 'Team', icon: Users },
  { id: 'roles', label: 'Roles & access', icon: Shield },
]

function UserRoleModal({ user, mode, rolesList, roleSlug, onRoleSlugChange, pending, onClose, onSubmit }) {
  if (!user) return null
  const isAssign = mode === 'assign'
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email

  return (
    <OverlayPortal open>
      <div className="modal-overlay" onClick={onClose} role="presentation">
        <div className="modal-panel max-w-md p-0" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-border px-5 py-4">
            <div className="min-w-0 pr-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {isAssign ? 'Assign role' : 'Remove role'}
              </p>
              <h3 className="mt-1 truncate text-base font-semibold text-text-primary">{name}</h3>
              <p className="mt-0.5 truncate text-xs text-text-secondary">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md p-1 text-text-muted hover:bg-card-hover hover:text-text-secondary"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="modal-role" className="text-sm text-text-secondary">
                {isAssign ? 'Role to assign' : 'Role to remove'}
              </label>
              <select
                id="modal-role"
                value={roleSlug}
                onChange={(e) => onRoleSlugChange(e.target.value)}
                className="h-10 rounded-xl border border-border bg-page px-3 text-sm text-text-primary outline-none focus:border-accent/50"
              >
                <option value="">Select a role…</option>
                {rolesList.map((r) => (
                  <option key={`${mode}-${r.slug}`} value={r.slug}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {user.roles?.length ? (
              <div>
                <p className="mb-2 text-xs text-text-muted">Current roles</p>
                <div className="flex flex-wrap gap-1.5">
                  {user.roles.map((r) => (
                    <span
                      key={r.slug}
                      className="rounded-full bg-card-hover px-2.5 py-0.5 text-[11px] text-text-secondary"
                    >
                      {r.label || r.slug}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-border py-2.5 text-sm text-text-secondary hover:bg-card-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!roleSlug || pending === mode}
                className={cn(
                  'flex-1 rounded-full py-2.5 text-sm font-semibold disabled:opacity-50',
                  isAssign
                    ? 'bg-accent text-page hover:brightness-105'
                    : 'border border-error/40 bg-error-bg text-error hover:bg-error/10'
                )}
              >
                {pending === mode ? 'Saving…' : isAssign ? 'Assign role' : 'Remove role'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </OverlayPortal>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const perms = user?.permissions
  const roles = user?.roles
  const manage = canManageRbac(perms)

  const [catalog, setCatalog] = useState([])
  const [rolesList, setRolesList] = useState([])
  const [loading, setLoading] = useState(true)
  const [rbacError, setRbacError] = useState(null)

  const [teamUsers, setTeamUsers] = useState([])
  const [teamPagination, setTeamPagination] = useState(null)
  const [teamUsersLoading, setTeamUsersLoading] = useState(false)
  const [teamUsersError, setTeamUsersError] = useState(null)
  const [teamPage, setTeamPage] = useState(1)
  const [teamLimit, setTeamLimit] = useState(20)
  const [teamSearch, setTeamSearch] = useState('')
  const [debouncedTeamSearch, setDebouncedTeamSearch] = useState('')
  const [teamRoleFilter, setTeamRoleFilter] = useState('')

  const [createSlug, setCreateSlug] = useState('')
  const [createLabel, setCreateLabel] = useState('')
  const [createKeys, setCreateKeys] = useState(() => new Set())

  const [editPathId, setEditPathId] = useState(null)
  const [draftKeys, setDraftKeys] = useState([])

  const [banner, setBanner] = useState(null)
  const [pending, setPending] = useState(null)
  const [activeTab, setActiveTab] = useState('team')
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [roleModal, setRoleModal] = useState(null)
  const [modalRoleSlug, setModalRoleSlug] = useState('')

  const catalogByKey = useMemo(() => {
    const m = new Map()
    catalog.forEach((p) => m.set(p.key, p))
    return m
  }, [catalog])

  const loadRbac = useCallback(async () => {
    setLoading(true)
    setRbacError(null)
    try {
      const [permRaw, rolesRaw] = await Promise.all([listRbacPermissions(), listRbacRoles()])
      setCatalog(permRaw.map(normalizePermission).filter((p) => p.key))
      setRolesList(rolesRaw.map(normalizeRole).filter((r) => r.pathId && r.slug))
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to load RBAC data. You may need rbac.manage permission.'
      setRbacError(msg)
      setCatalog([])
      setRolesList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRbac()
  }, [loadRbac])

  useEffect(() => {
    if (!banner) return
    const t = window.setTimeout(() => setBanner(null), BANNER_AUTO_DISMISS_MS)
    return () => window.clearTimeout(t)
  }, [banner])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedTeamSearch(teamSearch.trim()), 400)
    return () => window.clearTimeout(t)
  }, [teamSearch])

  useEffect(() => {
    setTeamPage(1)
  }, [debouncedTeamSearch, teamRoleFilter, teamLimit])

  const loadTeamUsers = useCallback(async () => {
    if (!manage) {
      setTeamUsers([])
      setTeamPagination(null)
      setTeamUsersError(null)
      setTeamUsersLoading(false)
      return
    }
    setTeamUsersLoading(true)
    setTeamUsersError(null)
    try {
      const lim = Math.min(100, Math.max(1, teamLimit))
      const { records, pagination } = await listRbacUsers({
        page: teamPage,
        limit: lim,
        ...(debouncedTeamSearch ? { search: debouncedTeamSearch } : {}),
        ...(teamRoleFilter ? { role_slug: teamRoleFilter } : {}),
      })
      setTeamUsers(records.map(normalizeTeamUser))
      const limFromApi =
        Number.isFinite(Number(pagination.limit)) && Number(pagination.limit) > 0
          ? Number(pagination.limit)
          : lim
      const total = Number.isFinite(Number(pagination.total))
        ? Number(pagination.total)
        : records.length
      let totalPages = Number(pagination.total_pages)
      if (!Number.isFinite(totalPages) || totalPages < 1) {
        totalPages = total === 0 ? 0 : Math.max(1, Math.ceil(total / limFromApi))
      }
      setTeamPagination({
        total,
        page: Number.isFinite(Number(pagination.page)) ? Number(pagination.page) : teamPage,
        limit: limFromApi,
        total_pages: totalPages,
        has_next: pagination.has_next,
        has_prev: pagination.has_prev,
      })
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Failed to load team members.'
      setTeamUsersError(msg)
      setTeamUsers([])
      setTeamPagination(null)
    } finally {
      setTeamUsersLoading(false)
    }
  }, [manage, teamPage, teamLimit, debouncedTeamSearch, teamRoleFilter])

  useEffect(() => {
    loadTeamUsers()
  }, [loadTeamUsers])

  useEffect(() => {
    const current = rolesList.find((r) => r.pathId === editPathId)
    if (current && isManagementRoleSlug(current.slug)) {
      setEditPathId(null)
      setDraftKeys([])
    }
  }, [rolesList, editPathId])

  const roleSummary = useMemo(() => {
    if (!Array.isArray(roles) || !roles.length) return 'No roles on profile'
    return roles.join(', ')
  }, [roles])

  const statCards = useMemo(
    () => [
      {
        label: 'Console users',
        value: !manage
          ? '—'
          : teamUsersLoading
            ? '…'
            : String(teamPagination?.total ?? 0),
        hint: !manage ? 'Admin access required to view the team.' : 'People with console access.',
        icon: Users,
        iconWrapCls: 'flex h-6 w-6 items-center justify-center rounded-full bg-accent-bg text-accent',
      },
      {
        label: 'Roles',
        value: loading ? '…' : String(rolesList.length),
        hint: 'Job roles you can assign to users.',
        icon: KeyRound,
        iconWrapCls: 'flex h-6 w-6 items-center justify-center rounded-full bg-info-bg text-info',
      },
      {
        label: 'Permissions',
        value: loading ? '…' : String(catalog.length),
        hint: 'Access rules attached to each role.',
        icon: Shield,
        iconWrapCls: 'flex h-6 w-6 items-center justify-center rounded-full bg-success-bg text-success',
      },
    ],
    [loading, rolesList.length, catalog.length, manage, teamUsersLoading, teamPagination?.total]
  )

  const inputCls =
    'rounded-xl border border-border bg-card px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none transition-all duration-200 focus:border-accent/50 focus:ring-1 focus:ring-accent/20'

  function toggleDraftKey(key, checked) {
    if (checked && key === PERMISSION_ALL && editPathId) {
      return
    }
    setDraftKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return [...next]
    })
  }

  function toggleCreateKey(key, checked) {
    if (checked && key === PERMISSION_ALL) {
      return
    }
    setCreateKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  async function handleModalRoleSubmit(e) {
    e.preventDefault()
    if (!manage || !roleModal?.user?.userKey || !modalRoleSlug) return
    setBanner(null)
    setPending(roleModal.mode)
    try {
      if (roleModal.mode === 'assign') {
        await assignUserRole(roleModal.user.userKey, { role_slug: modalRoleSlug })
        setBanner({ type: 'success', text: `Assigned ${modalRoleSlug} to ${roleModal.user.email || 'user'}.` })
      } else {
        await revokeUserRole(roleModal.user.userKey, modalRoleSlug)
        setBanner({ type: 'success', text: `Removed ${modalRoleSlug} from ${roleModal.user.email || 'user'}.` })
      }
      setRoleModal(null)
      setModalRoleSlug('')
      await Promise.all([loadRbac(), loadTeamUsers()])
    } catch (err) {
      setBanner({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Could not update user roles.',
      })
    } finally {
      setPending(null)
    }
  }

  function openRoleModal(user, mode) {
    setRoleModal({ user, mode })
    setModalRoleSlug('')
    setBanner(null)
  }

  async function handleSaveRolePermissions(role) {
    if (!manage || !editPathId) return
    if (isManagementRoleSlug(role.slug)) {
      setBanner({
        type: 'error',
        text: 'The management role cannot be edited via PATCH; the API blocks permission changes for that role only.',
      })
      return
    }
    const patchValidation = validateRolePermissionKeysForSave(role.slug, draftKeys)
    if (!patchValidation.ok) {
      setBanner({ type: 'error', text: patchValidation.message })
      return
    }
    setPending('patch')
    setBanner(null)
    try {
      await patchRolePermissions(role.pathId, { permission_keys: draftKeys })
      setBanner({ type: 'success', text: `Updated permissions for ${role.label}.` })
      setEditPathId(null)
      setDraftKeys([])
      await loadRbac()
    } catch (err) {
      setBanner({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to update role permissions.',
      })
    } finally {
      setPending(null)
    }
  }

  async function handleCreateRole(e) {
    e.preventDefault()
    if (!manage) return
    setBanner(null)
    const slug = createSlug.trim()
    const label = createLabel.trim()
    if (!slug || !label) {
      setBanner({ type: 'error', text: 'Enter both slug and label for the new role.' })
      return
    }
    if (isManagementRoleSlug(slug)) {
      setBanner({
        type: 'error',
        text: 'The management role is seeded by the system; choose a different slug.',
      })
      return
    }
    const permission_keys = [...createKeys].filter((k) => k !== PERMISSION_ALL)
    const createValidation = validateRolePermissionKeysForSave(slug, permission_keys)
    if (!createValidation.ok) {
      setBanner({ type: 'error', text: createValidation.message })
      return
    }
    setPending('create')
    try {
      await createRbacRole({ slug, label, permission_keys })
      setBanner({ type: 'success', text: `Created role “${label}”.` })
      setCreateSlug('')
      setCreateLabel('')
      setCreateKeys(new Set())
      await loadRbac()
    } catch (err) {
      setBanner({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to create role.',
      })
    } finally {
      setPending(null)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Admin tools</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-secondary">
          Manage your console team, roles, and access permissions in one place.
        </p>
        <p className="mt-2 text-xs text-text-muted">
          Signed in as <span className="text-text-secondary">{user?.email || user?.username || '—'}</span>
          {roleSummary !== 'No roles on profile' ? (
            <> · <span className="text-text-secondary">{roleSummary}</span></>
          ) : null}
        </p>
      </div>

      {banner && (
        <div
          className="fixed inset-x-0 top-[76px] z-50 flex justify-center px-3 pt-3 sm:px-6 lg:pl-[248px]"
          role="alert"
        >
          <div
            className={cn(
              'animate-fade-in-up flex w-full max-w-2xl items-start gap-3 rounded-card border px-4 py-3 text-sm shadow-lg shadow-black/10',
              banner.type === 'error'
                ? 'border-error/40 bg-error-bg text-error'
                : banner.type === 'success'
                  ? 'border-success/40 bg-success-bg text-success'
                  : banner.type === 'info'
                    ? 'border-accent/30 bg-accent-bg/40 text-text-secondary'
                    : 'border-border bg-card text-text-secondary'
            )}
          >
            <p className="min-w-0 flex-1 leading-snug">{banner.text}</p>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="shrink-0 rounded-md p-1 text-current opacity-70 transition-opacity hover:bg-black/10 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {rbacError && (
        <div className="mb-4 rounded-card border border-error/40 bg-error-bg px-4 py-3 text-sm text-error">
          {rbacError}
          <button
            type="button"
            onClick={loadRbac}
            className="ml-3 inline rounded-md border border-border bg-card px-2 py-0.5 text-xs text-text-primary hover:bg-card-hover"
          >
            Retry
          </button>
        </div>
      )}

      {!manage && (
        <div className="mb-6 flex gap-3 rounded-card border border-warning/30 bg-warning-bg/30 p-4">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="text-sm font-medium text-text-primary">View only</p>
            <p className="mt-1 text-sm text-text-secondary">
              You can browse roles and permissions. Creating users, assigning roles, and editing access
              requires admin permissions.
            </p>
          </div>
        </div>
      )}

      <div className="stat-grid mb-6 xl:grid-cols-3">
        {statCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      <div className="card-shell">
        <div className="tab-scroll bg-page lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm transition-colors lg:h-[62px] lg:min-w-0 lg:rounded-none lg:border-r lg:border-border lg:px-4 lg:last:border-r-0',
                  active
                    ? 'bg-accent text-page lg:bg-card-hover lg:text-text-primary'
                    : 'bg-card-hover text-text-secondary hover:text-text-primary lg:bg-transparent lg:hover:bg-card-hover/60'
                )}
              >
                <span>{tab.label}</span>
                <Icon size={16} />
              </button>
            )
          })}
        </div>

        {activeTab === 'team' ? (
          <>
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-medium text-text-primary">Console team</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  View everyone with console access and manage their roles.
                </p>
              </div>
              {manage && (
                <button
                  type="button"
                  onClick={() => setShowCreatePanel((v) => !v)}
                  className={cn(
                    'inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
                    showCreatePanel
                      ? 'border border-border bg-card-hover text-text-primary'
                      : 'bg-accent text-page hover:brightness-105'
                  )}
                >
                  <UserPlus size={16} />
                  {showCreatePanel ? 'Hide form' : 'Create account'}
                </button>
              )}
            </div>

            {manage && showCreatePanel && (
              <div className="border-b border-border px-4 py-4">
                <AdminCreateUserForm
                  disabled={!manage}
                  inputCls={inputCls}
                  pending={pending}
                  setPending={setPending}
                  onSuccess={(text) => {
                    setBanner({ type: 'success', text })
                    setShowCreatePanel(false)
                    void loadTeamUsers()
                  }}
                  onError={(text) => setBanner({ type: 'error', text })}
                />
              </div>
            )}

            {manage && (
              <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="relative min-w-0 flex-1 sm:max-w-[280px]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="search"
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    placeholder="Search by email or name…"
                    className="h-10 w-full rounded-xl border border-border bg-page pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
                    aria-label="Search team"
                  />
                </div>
                <select
                  value={teamRoleFilter}
                  onChange={(e) => setTeamRoleFilter(e.target.value)}
                  className={cn(inputCls, 'h-10 min-w-[160px] py-0 sm:w-[200px]')}
                  aria-label="Filter by role"
                >
                  <option value="">All roles</option>
                  {rolesList.map((r) => (
                    <option key={`filter-${r.slug}`} value={r.slug}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <select
                  value={String(teamLimit)}
                  onChange={(e) => setTeamLimit(Number(e.target.value))}
                  className={cn(inputCls, 'h-10 w-full min-w-[100px] py-0 sm:w-[120px]')}
                  aria-label="Rows per page"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>
              </div>
            )}

            {teamUsersError && (
              <div className="border-b border-border px-4 py-3 text-sm text-error">
                {teamUsersError}
                <button
                  type="button"
                  onClick={() => loadTeamUsers()}
                  className="ml-2 inline rounded-md border border-border bg-card px-2 py-0.5 text-xs text-text-primary hover:bg-card-hover"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="table-scroll">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-text-muted">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Roles</th>
                    <th className="px-4 py-3 font-medium">Last login</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!manage ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-sm text-text-muted">
                        Admin access is required to view and manage the team.
                      </td>
                    </tr>
                  ) : teamUsersLoading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td colSpan={4} className="px-4 py-3">
                          <div className="skeleton h-9 w-full rounded-lg" />
                        </td>
                      </tr>
                    ))
                  ) : !teamUsers.length ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-16 text-center text-sm text-text-muted">
                        No users match your search.
                      </td>
                    </tr>
                  ) : (
                    teamUsers.map((row) => (
                      <tr key={String(row.id ?? row.userKey)} className="border-b border-border/50">
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-text-primary">{row.email || '—'}</p>
                          <p className="text-xs text-text-muted">
                            {[row.firstName, row.lastName].filter(Boolean).join(' ') || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex max-w-[260px] flex-wrap gap-1">
                            {row.roles.length ? (
                              row.roles.map((r) => (
                                <span
                                  key={`${row.userKey}-${r.slug}`}
                                  className="rounded-full bg-card-hover px-2 py-0.5 text-[11px] text-text-secondary"
                                >
                                  {r.label || r.slug}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-text-muted">No roles assigned</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-text-secondary">
                          {row.lastLogin ? formatDate(row.lastLogin) : '—'}
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openRoleModal(row, 'assign')}
                              disabled={!row.userKey}
                              className="rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-text-secondary hover:border-accent/40 hover:text-text-primary disabled:opacity-40"
                            >
                              Assign role
                            </button>
                            <button
                              type="button"
                              onClick={() => openRoleModal(row, 'revoke')}
                              disabled={!row.userKey || !row.roles.length}
                              className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-[11px] text-text-muted hover:border-error/30 hover:text-error disabled:opacity-40"
                            >
                              Remove role
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {manage && teamPagination && teamPagination.total_pages > 0 && (
              <Pagination
                page={teamPagination.page}
                totalPages={teamPagination.total_pages}
                total={teamPagination.total}
                label="users"
                limit={teamPagination.limit}
                onPageChange={setTeamPage}
              />
            )}
          </>
        ) : (
          <>
            <div className="border-b border-border px-4 py-4 lg:px-6">
              <h2 className="text-base font-medium text-text-primary">Roles & access</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Define what each role can do. Assign roles to users from the Team tab.
              </p>
            </div>

            {loading ? (
              <div className="space-y-3 p-4 lg:p-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 rounded-xl skeleton" />
                ))}
              </div>
            ) : !rolesList.length ? (
              <p className="p-6 text-sm text-text-muted">No roles available yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2 lg:gap-5 lg:p-6">
                {rolesList.map((role) => {
                  const editing = editPathId === role.pathId
                  const patchLocked = isManagementRoleSlug(role.slug)
                  return (
                    <div
                      key={role.pathId}
                      className="rounded-xl border border-border/80 bg-page/50 p-4 transition-colors hover:border-border"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{role.label}</p>
                          <p className="text-[11px] text-text-muted">{role.slug}</p>
                          {patchLocked && (
                            <p className="mt-1 max-w-[240px] text-[11px] leading-snug text-text-muted">
                              This system role cannot be edited here.
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!manage || patchLocked}
                          title={patchLocked ? 'This role is managed by the system.' : undefined}
                          onClick={() => {
                            if (patchLocked) return
                            if (editing) {
                              setEditPathId(null)
                              setDraftKeys([])
                            } else {
                              setEditPathId(role.pathId)
                              const sanitized = sanitizePermissionKeysForRole(role.slug, role.permission_keys)
                              setDraftKeys(sanitized)
                              if (sanitized.length < role.permission_keys.length) {
                                setBanner({
                                  type: 'info',
                                  text: 'Full admin access was removed from this draft — only the management role may include it.',
                                })
                              }
                            }
                          }}
                          className={cn(
                            'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                            manage && !patchLocked
                              ? 'border-border text-text-secondary hover:border-accent/40 hover:text-text-primary'
                              : 'cursor-not-allowed border-border/50 text-text-muted'
                          )}
                        >
                          {editing ? 'Cancel' : 'Edit access'}
                        </button>
                      </div>
                      {!editing && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {role.permission_keys.length ? (
                            role.permission_keys.map((k) => (
                              <PermChip
                                key={k}
                                highlight={
                                  k === PERMISSION_FINANCIAL_READ ||
                                  k === 'rbac.manage' ||
                                  k === PERMISSION_ALL
                                }
                                title={catalogByKey.get(k)?.description || undefined}
                              >
                                {permissionChipLabel(k, catalogByKey)}
                              </PermChip>
                            ))
                          ) : (
                            <span className="text-xs text-text-muted">No permissions set</span>
                          )}
                        </div>
                      )}
                      {editing && (
                        <div className="mt-3 space-y-3">
                          <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border/80 p-3">
                            {catalog.length ? (
                              catalog.map((p) => {
                                const starLocked = p.key === PERMISSION_ALL && editPathId
                                return (
                                  <label
                                    key={p.key}
                                    className={cn(
                                      'flex gap-2 text-sm',
                                      starLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      className="mt-1 accent-accent"
                                      disabled={starLocked}
                                      title={
                                        starLocked
                                          ? 'Only the management role may include full admin access.'
                                          : undefined
                                      }
                                      checked={draftKeys.includes(p.key)}
                                      onChange={(e) => toggleDraftKey(p.key, e.target.checked)}
                                    />
                                    <span className="text-text-secondary">
                                      {permissionChipLabel(p.key, catalogByKey)}
                                    </span>
                                  </label>
                                )
                              })
                            ) : (
                              <p className="text-xs text-text-muted">
                                Permission list could not be loaded. Try refreshing the page.
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={pending === 'patch'}
                              onClick={() => handleSaveRolePermissions(role)}
                              className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-page hover:brightness-105 disabled:opacity-50"
                            >
                              {pending === 'patch' ? 'Saving…' : 'Save changes'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditPathId(null)
                                setDraftKeys([])
                              }}
                              className="rounded-full border border-border px-4 py-2 text-xs text-text-secondary hover:bg-card-hover"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {manage && (
              <div className="border-t border-border px-4 py-4 lg:px-6">
                <h3 className="text-sm font-medium text-text-primary">Create a new role</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Add a custom role, then assign it to users from the Team tab.
                </p>
                <form onSubmit={handleCreateRole} className="mt-4 flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="rbac-create-slug" className="text-sm text-text-secondary">
                        Role ID
                      </label>
                      <input
                        id="rbac-create-slug"
                        value={createSlug}
                        onChange={(e) => setCreateSlug(e.target.value)}
                        placeholder="e.g. finance_analyst"
                        className={inputCls}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="rbac-create-label" className="text-sm text-text-secondary">
                        Display name
                      </label>
                      <input
                        id="rbac-create-label"
                        value={createLabel}
                        onChange={(e) => setCreateLabel(e.target.value)}
                        placeholder="e.g. Finance analyst"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm text-text-secondary">Permissions</p>
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border/80 p-3">
                      {catalog.length === 0 ? (
                        <p className="text-xs text-text-muted">
                          Permissions are not loaded yet. Save the role and add permissions after refresh.
                        </p>
                      ) : (
                        catalog.map((p) => {
                          const starLocked = p.key === PERMISSION_ALL
                          return (
                            <label
                              key={`create-${p.key}`}
                              className={cn(
                                'flex gap-2 text-sm',
                                starLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 accent-accent"
                                disabled={starLocked}
                                title={starLocked ? 'Only the management role may include full admin access.' : undefined}
                                checked={createKeys.has(p.key)}
                                onChange={(e) => toggleCreateKey(p.key, e.target.checked)}
                              />
                              <span className="text-text-secondary">
                                {permissionChipLabel(p.key, catalogByKey)}
                              </span>
                            </label>
                          )
                        })
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={pending === 'create'}
                    className="w-fit rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-card-hover disabled:opacity-50"
                  >
                    {pending === 'create' ? 'Creating…' : 'Create role'}
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>

      {roleModal && (
        <UserRoleModal
          user={roleModal.user}
          mode={roleModal.mode}
          rolesList={rolesList}
          roleSlug={modalRoleSlug}
          onRoleSlugChange={setModalRoleSlug}
          pending={pending}
          onClose={() => {
            setRoleModal(null)
            setModalRoleSlug('')
          }}
          onSubmit={handleModalRoleSubmit}
        />
      )}
    </div>
  )
}
