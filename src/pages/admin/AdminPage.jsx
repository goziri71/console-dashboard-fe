import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Info,
  KeyRound,
  Lock,
  Shield,
  UserPlus,
  Users,
  UserMinus,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Pagination from '../../components/ui/Pagination'
import { cn, formatDate } from '../../lib/utils'
import {
  PERMISSION_ALL,
  PERMISSION_FINANCIAL_READ,
  canManageRbac,
  canReadFinancial,
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
    return meta?.description
      ? `${key} (${meta.description})`
      : `${key} (balances & amounts)`
  }
  if (meta?.description) return `${key} (${meta.description})`
  return key
}

export default function AdminPage() {
  const { user } = useAuth()
  const perms = user?.permissions
  const roles = user?.roles
  const manage = canManageRbac(perms)
  const seesMoney = canReadFinancial(perms)

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

  const [assignUserKey, setAssignUserKey] = useState('')
  const [assignRoleSlug, setAssignRoleSlug] = useState('')
  const [revokeUserKey, setRevokeUserKey] = useState('')
  const [revokeRoleSlug, setRevokeRoleSlug] = useState('')

  const [createSlug, setCreateSlug] = useState('')
  const [createLabel, setCreateLabel] = useState('')
  const [createKeys, setCreateKeys] = useState(() => new Set())

  const [editPathId, setEditPathId] = useState(null)
  const [draftKeys, setDraftKeys] = useState([])

  const [banner, setBanner] = useState(null)
  const [pending, setPending] = useState(null)

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

  const permSummary = useMemo(() => {
    if (!Array.isArray(perms) || !perms.length) return 'No permissions on profile'
    return `${perms.length} permission${perms.length === 1 ? '' : 's'}`
  }, [perms])

  const statCards = useMemo(
    () => [
      {
        label: 'Console users',
        value: !manage
          ? '—'
          : teamUsersLoading
            ? '…'
            : String(teamPagination?.total ?? 0),
        hint: !manage
          ? 'Requires rbac.manage or * to list team via GET /rbac/users.'
          : 'From GET /rbac/users (pagination total).',
        icon: Users,
        iconWrapCls: 'flex h-6 w-6 items-center justify-center rounded-full bg-accent-bg text-accent',
      },
      {
        label: 'Roles',
        value: loading ? '…' : String(rolesList.length),
        hint: 'From GET /rbac/roles',
        icon: KeyRound,
        iconWrapCls: 'flex h-6 w-6 items-center justify-center rounded-full bg-info-bg text-info',
      },
      {
        label: 'Permissions',
        value: loading ? '…' : String(catalog.length),
        hint: 'From GET /rbac/permissions',
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

  async function handleAssign(e) {
    e.preventDefault()
    if (!manage) return
    setBanner(null)
    if (!assignUserKey.trim()) {
      setBanner({ type: 'error', text: 'Enter the user key (identifier your API expects).' })
      return
    }
    if (!assignRoleSlug) {
      setBanner({ type: 'error', text: 'Choose a role to assign.' })
      return
    }
    setPending('assign')
    try {
      await assignUserRole(assignUserKey.trim(), { role_slug: assignRoleSlug })
      setBanner({ type: 'success', text: 'Role assigned. Ask the user to refresh profile or re-login.' })
      setAssignUserKey('')
      setAssignRoleSlug('')
      await Promise.all([loadRbac(), loadTeamUsers()])
    } catch (err) {
      setBanner({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to assign role.',
      })
    } finally {
      setPending(null)
    }
  }

  async function handleRevoke(e) {
    e.preventDefault()
    if (!manage) return
    setBanner(null)
    if (!revokeUserKey.trim()) {
      setBanner({ type: 'error', text: 'Enter the user key (identifier your API expects).' })
      return
    }
    if (!revokeRoleSlug) {
      setBanner({ type: 'error', text: 'Select a role to revoke.' })
      return
    }
    setPending('revoke')
    try {
      await revokeUserRole(revokeUserKey.trim(), revokeRoleSlug)
      setBanner({ type: 'success', text: 'Role revoked.' })
      setRevokeUserKey('')
      setRevokeRoleSlug('')
      await Promise.all([loadRbac(), loadTeamUsers()])
    } catch (err) {
      setBanner({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to revoke role.',
      })
    } finally {
      setPending(null)
    }
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
      <div className="animate-fade-in-up mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Admin tools</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage RBAC roles and permission keys via the console API. Assign roles to users with{' '}
          <code className="text-text-muted">POST /rbac/users/:userKey/roles</code> using each user’s key from
          your identity backend.
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
        <div className="animate-fade-in-up mb-6 flex gap-3 rounded-card border border-warning/30 bg-warning-bg/30 p-4">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="text-sm font-medium text-text-primary">Restricted</p>
            <p className="mt-1 text-sm text-text-secondary">
              You need <PermChip highlight>rbac.manage</PermChip> or full access{' '}
              <PermChip highlight>*</PermChip> to assign roles, create roles, or edit permission keys. You can
              still view catalog data if the API allows it.
            </p>
          </div>
        </div>
      )}

      <div
        className="animate-fade-in-up mb-6 rounded-card border border-border bg-card p-4"
        style={{ animationDelay: '40ms' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Signed in as</p>
            <p className="mt-1 text-sm font-medium text-text-primary">{user?.email || user?.username || '—'}</p>
            <p className="mt-2 text-xs text-text-secondary">
              Role: <span className="text-text-primary">{roleSummary}</span>
            </p>
            {user?.role != null && String(user.role).length > 0 && (
              <p className="mt-1 text-xs text-text-secondary">
                Primary role (display):{' '}
                <span className="font-mono text-text-primary">{user.role}</span>
              </p>
            )}
            <p className="mt-1 text-xs text-text-secondary">
              {permSummary}
              {seesMoney ? (
                <span className="text-text-muted"> · Can view financial fields</span>
              ) : (
                <span className="text-text-muted"> · Financial fields may be redacted</span>
              )}
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-border/80 bg-page/80 px-3 py-2 text-xs text-text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span>
              After admins change your roles, refresh the session (re-login or reload profile) so{' '}
              <code className="text-text-secondary">permissions</code> stays accurate.
            </span>
          </div>
        </div>
      </div>

      <div
        className="animate-fade-in-up grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6"
        style={{ animationDelay: '80ms' }}
      >
        {statCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      <div
        className="animate-fade-in-up mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]"
        style={{ animationDelay: '120ms' }}
      >
        <div className="overflow-hidden rounded-card border border-border bg-card">
          <div className="flex flex-col gap-4 border-b border-border px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-medium text-text-primary">Console team</h2>
              <p className="mt-1 text-sm text-text-secondary">
                From <code className="text-text-muted">GET /rbac/users</code>. Use a row’s{' '}
                <code className="text-text-muted">user_key</code> for assign / revoke on the right.
              </p>
            </div>
            {manage && (
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
                <input
                  type="search"
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Search email or name…"
                  className={cn(inputCls, 'min-w-[200px] flex-1 sm:max-w-[260px]')}
                  aria-label="Search team"
                />
                <select
                  value={teamRoleFilter}
                  onChange={(e) => setTeamRoleFilter(e.target.value)}
                  className={cn(inputCls, 'min-w-[160px] sm:w-[200px]')}
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
                  className={cn(inputCls, 'w-full min-w-[100px] sm:w-[120px]')}
                  aria-label="Rows per page"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

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

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">User key</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium">Last login</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!manage ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-text-muted">
                      Team directory requires <code className="text-text-secondary">rbac.manage</code> or{' '}
                      <code className="text-text-secondary">*</code>.
                    </td>
                  </tr>
                ) : teamUsersLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="skeleton h-9 w-full rounded-lg" />
                      </td>
                    </tr>
                  ))
                ) : !teamUsers.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-sm text-text-muted">
                      No users match this filter.
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
                        <code className="break-all text-[11px] text-text-secondary">{row.userKey || '—'}</code>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex max-w-[220px] flex-wrap gap-1">
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
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-text-secondary">
                        {row.lastLogin ? formatDate(row.lastLogin) : '—'}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setAssignUserKey(row.userKey)
                              setBanner(null)
                            }}
                            disabled={!row.userKey}
                            className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-medium text-text-secondary hover:border-accent/40 hover:text-text-primary disabled:opacity-40"
                          >
                            Use for assign
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRevokeUserKey(row.userKey)
                              setBanner(null)
                            }}
                            disabled={!row.userKey}
                            className="rounded-lg border border-border/60 bg-card px-2 py-1 text-[11px] text-text-muted hover:text-text-secondary disabled:opacity-40"
                          >
                            Use for revoke
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
        </div>

        <div className="flex flex-col gap-6">
          <div className="h-fit overflow-hidden rounded-card border border-border bg-card">
            <div className="border-b border-border px-4 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-bg text-accent">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h2 className="text-base font-medium text-text-primary">Assign role</h2>
                  <p className="text-xs text-text-muted">POST /rbac/users/:userKey/roles</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleAssign} className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="rbac-user-key" className="text-sm text-text-secondary">
                  User key
                </label>
                <input
                  id="rbac-user-key"
                  type="text"
                  value={assignUserKey}
                  onChange={(e) => setAssignUserKey(e.target.value)}
                  placeholder="e.g. user id or email from backend"
                  disabled={!manage}
                  className={cn(inputCls, !manage && 'cursor-not-allowed opacity-60')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="rbac-assign-role" className="text-sm text-text-secondary">
                  Role
                </label>
                <select
                  id="rbac-assign-role"
                  value={assignRoleSlug}
                  onChange={(e) => setAssignRoleSlug(e.target.value)}
                  disabled={!manage || !rolesList.length}
                  className={cn(inputCls, !manage && 'cursor-not-allowed opacity-60')}
                >
                  <option value="">Select a role…</option>
                  {rolesList.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.label} ({r.slug})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={!manage || pending === 'assign'}
                className={cn(
                  'rounded-lg px-4 py-3 text-sm font-medium transition-colors active:scale-[0.98]',
                  manage
                    ? 'bg-accent text-[#1a1c12] hover:brightness-105 disabled:opacity-50'
                    : 'cursor-not-allowed bg-card-hover text-text-muted'
                )}
              >
                {pending === 'assign' ? 'Assigning…' : 'Assign role'}
              </button>
            </form>
          </div>

          <div className="h-fit overflow-hidden rounded-card border border-border bg-card">
            <div className="border-b border-border px-4 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-error-bg text-error">
                  <UserMinus size={16} />
                </div>
                <div>
                  <h2 className="text-base font-medium text-text-primary">Revoke role</h2>
                  <p className="text-xs text-text-muted">DELETE /rbac/users/:userKey/roles/:roleSlug</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleRevoke} className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="rbac-revoke-user" className="text-sm text-text-secondary">
                  User key
                </label>
                <input
                  id="rbac-revoke-user"
                  type="text"
                  value={revokeUserKey}
                  onChange={(e) => setRevokeUserKey(e.target.value)}
                  placeholder="Same identifier as assign"
                  disabled={!manage}
                  className={cn(inputCls, !manage && 'cursor-not-allowed opacity-60')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="rbac-revoke-role" className="text-sm text-text-secondary">
                  Role slug
                </label>
                <select
                  id="rbac-revoke-role"
                  value={revokeRoleSlug}
                  onChange={(e) => setRevokeRoleSlug(e.target.value)}
                  disabled={!manage || !rolesList.length}
                  className={cn(inputCls, !manage && 'cursor-not-allowed opacity-60')}
                >
                  <option value="">Select a role…</option>
                  {rolesList.map((r) => (
                    <option key={`revoke-${r.slug}`} value={r.slug}>
                      {r.slug}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={!manage || pending === 'revoke'}
                className={cn(
                  'rounded-lg border border-error/50 bg-error-bg px-4 py-3 text-sm font-medium text-error transition-colors active:scale-[0.98]',
                  manage ? 'hover:bg-error-bg/80 disabled:opacity-50' : 'cursor-not-allowed opacity-60'
                )}
              >
                {pending === 'revoke' ? 'Revoking…' : 'Revoke role'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div
        className="animate-fade-in-up mt-6 overflow-hidden rounded-card border border-border bg-card"
        style={{ animationDelay: '160ms' }}
      >
        <div className="border-b border-border px-4 py-4 lg:px-6">
          <h2 className="text-base font-medium text-text-primary">Roles & permission keys</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Loaded from <code className="text-text-muted">GET /rbac/roles</code>. Edit uses{' '}
            <code className="text-text-muted">PATCH /rbac/roles/:roleId/permissions</code> with a JSON body{' '}
            <code className="text-text-muted">{`{ "permission_keys": [...] }`}</code> (snake_case — not{' '}
            <code className="text-text-muted">permissionKeys</code>). Only the{' '}
            <code className="text-text-muted">management</code> slug is blocked from PATCH here; other roles
            can be updated. Only <code className="text-text-muted">management</code> may include{' '}
            <code className="text-text-muted">*</code>; all other roles must use concrete keys only.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3 p-4 lg:p-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-xl skeleton" />
            ))}
          </div>
        ) : !rolesList.length ? (
          <p className="p-6 text-sm text-text-muted">No roles returned. Check API access or errors above.</p>
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
                      <p className="font-mono text-[11px] text-text-muted">{role.slug}</p>
                      {patchLocked && (
                        <p className="mt-1 max-w-[240px] text-[11px] leading-snug text-text-muted">
                          Permission keys for this role are fixed on the server (management role).
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!manage || patchLocked}
                      title={
                        patchLocked
                          ? 'API does not allow PATCH permission edits for the management role.'
                          : undefined
                      }
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
                              text: 'The "*" permission was removed from this draft — only the management role may include it.',
                            })
                          }
                        }
                      }}
                      className={cn(
                        'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                        manage && !patchLocked
                          ? 'border-border text-text-secondary hover:border-accent/40 hover:text-text-primary'
                          : 'cursor-not-allowed border-border/50 text-text-muted'
                      )}
                    >
                      {editing ? 'Cancel' : 'Edit permissions'}
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
                        <span className="text-xs text-text-muted">No permission keys</span>
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
                              className={cn('flex gap-2 text-sm', starLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 accent-accent"
                                disabled={starLocked}
                                title={
                                  starLocked
                                    ? 'Only the management role may include "*".'
                                    : undefined
                                }
                                checked={draftKeys.includes(p.key)}
                                onChange={(e) => toggleDraftKey(p.key, e.target.checked)}
                              />
                              <span>
                                <code className="text-text-secondary">{p.key}</code>
                                {p.description ? (
                                  <span className="text-text-muted"> — {p.description}</span>
                                ) : null}
                              </span>
                            </label>
                            )
                          })
                        ) : (
                          <p className="text-xs text-text-muted">
                            No permission catalog loaded. PATCH still accepts keys you type on the server —
                            reload permissions or fix API access.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pending === 'patch'}
                          onClick={() => handleSaveRolePermissions(role)}
                          className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-[#1a1c12] hover:brightness-105 disabled:opacity-50"
                        >
                          {pending === 'patch' ? 'Saving…' : 'Save permissions'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditPathId(null)
                            setDraftKeys([])
                          }}
                          className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary hover:bg-card-hover"
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
      </div>

      {manage && (
        <div
          className="animate-fade-in-up mt-6 overflow-hidden rounded-card border border-border bg-card"
          style={{ animationDelay: '200ms' }}
        >
          <div className="border-b border-border px-4 py-4 lg:px-6">
            <h2 className="text-base font-medium text-text-primary">Create role</h2>
            <p className="mt-1 text-sm text-text-secondary">
              <code className="text-text-muted">POST /rbac/roles</code> with{' '}
              <code className="text-text-muted">slug</code>, <code className="text-text-muted">label</code>, and{' '}
              <code className="text-text-muted">permission_keys</code>. Include{' '}
              <code className="text-text-muted">financial.read</code> for roles that should see balances and
              amounts. Do not include <code className="text-text-muted">*</code> on new roles — only
              management may use it.
            </p>
          </div>
          <form onSubmit={handleCreateRole} className="flex flex-col gap-4 p-4 lg:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="rbac-create-slug" className="text-sm text-text-secondary">
                  Slug
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
                  Label
                </label>
                <input
                  id="rbac-create-label"
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.target.value)}
                  placeholder="Display name"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm text-text-secondary">Permission keys</p>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border/80 p-3">
                {catalog.length === 0 ? (
                  <p className="text-xs text-text-muted">
                    No permission catalog yet — create the role with an empty key set and add keys after{' '}
                    <code className="text-text-secondary">GET /rbac/permissions</code> succeeds.
                  </p>
                ) : (
                  catalog.map((p) => {
                    const starLocked = p.key === PERMISSION_ALL
                    return (
                    <label
                      key={`create-${p.key}`}
                      className={cn('flex gap-2 text-sm', starLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 accent-accent"
                        disabled={starLocked}
                        title={starLocked ? 'Only the management role may include "*".' : undefined}
                        checked={createKeys.has(p.key)}
                        onChange={(e) => toggleCreateKey(p.key, e.target.checked)}
                      />
                      <span>
                        <code className="text-text-secondary">{p.key}</code>
                        {p.description ? (
                          <span className="text-text-muted"> — {p.description}</span>
                        ) : null}
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
              className="w-fit rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-card-hover disabled:opacity-50"
            >
              {pending === 'create' ? 'Creating…' : 'Create role'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
