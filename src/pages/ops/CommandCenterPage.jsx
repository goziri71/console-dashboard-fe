import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  CheckCircle2,
  Copy,
  Lock,
  Radio,
  RefreshCw,
  Search,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import OverlayPortal from '../../components/ui/OverlayPortal'
import Pagination from '../../components/ui/Pagination'
import { useAuth } from '../../context/AuthContext'
import { useCommandCenterStream } from '../../hooks/useCommandCenterStream'
import {
  EVENT_PREFIX_CHIPS,
  EVENT_TYPE_CHIPS,
  OUTCOME_CHIPS,
  actorName,
  asText,
  eventKey,
  eventMatchesFilters,
  eventSourceKind,
  eventTypeLabel,
  initials,
  outcomeBadge,
  unwrapCommandCenterEvents,
  unwrapCommandCenterPresence,
  unwrapCommandCenterPulse,
} from '../../lib/commandCenter'
import { canReadConsole, hasFullAccess, isManagementRoleSlug } from '../../lib/permissions'
import { cn, formatDate, formatNumber, timeAgo } from '../../lib/utils'
import {
  getCommandCenterEvents,
  getCommandCenterPresence,
  getCommandCenterPulse,
} from '../../services/ops'

const PAGE_LIMIT = 50
const PRESENCE_POLL_MS = 20000
const PULSE_POLL_MS = 45000

function canViewCommandCenter(user) {
  if (canReadConsole(user?.permissions) || hasFullAccess(user?.permissions)) return true
  const role = user?.role
  if (isManagementRoleSlug(typeof role === 'string' ? role : role?.slug)) return true
  if (Array.isArray(user?.roles)) {
    return user.roles.some((r) => isManagementRoleSlug(typeof r === 'string' ? r : r?.slug))
  }
  return false
}

function connectionCopy(status) {
  if (status === 'live') return { label: 'Live', cls: 'text-accent' }
  if (status === 'connecting') return { label: 'Connecting', cls: 'text-warning' }
  if (status === 'reconnecting') return { label: 'Reconnecting', cls: 'text-warning' }
  if (status === 'offline') return { label: 'Offline', cls: 'text-error' }
  return { label: 'Offline', cls: 'text-text-muted' }
}

function actorHue(seed) {
  const s = String(seed || '')
  let hash = 0
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) % 360
  return hash
}

function Avatar({ name, seed, size = 'md' }) {
  const hue = actorHue(seed || name)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-page',
        size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'
      )}
      style={{ backgroundColor: `hsl(${hue} 42% 48%)` }}
    >
      {initials(name)}
    </span>
  )
}

function PulseCard({ label, value, hint, icon: Icon, iconCls }) {
  return (
    <div className="motion-surface rounded-card border border-border bg-card p-4 hover:-translate-y-0.5 hover:border-border/80">
      <div className="mb-3 flex items-center gap-2">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', iconCls)}>
          {Icon ? <Icon size={15} /> : null}
        </div>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <p className="text-3xl font-semibold tabular-nums text-text-primary">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-text-muted">{hint}</p> : null}
    </div>
  )
}

function EventDrawer({ event, onClose }) {
  if (!event) return null
  const badge = outcomeBadge(event.outcome)
  const actor = actorName(event.actor)
  const rows = [
    ['Summary', asText(event.summary)],
    ['Action', eventTypeLabel(event.event_type)],
    ['Outcome', asText(event.outcome)],
    ['Operator', actor],
    ['Email', asText(event.actor?.email)],
    ['Role', asText(event.actor?.role)],
    ['Path', asText(event.metadata?.path || event.target_key)],
    ['Label', asText(event.metadata?.label)],
    ['Reference', asText(event.reference)],
    ['Account key', asText(event.account_key)],
    ['Target type', asText(event.target_type)],
    ['Session', asText(event.session_id)],
    ['IP', asText(event.ip_address)],
    ['When', event.date_created ? formatDate(event.date_created) : '—'],
  ]

  function copyText(value) {
    if (!value) return
    navigator.clipboard?.writeText(String(value)).catch(() => {})
  }

  return (
    <OverlayPortal open>
      <div className="drawer-overlay" onClick={onClose} role="presentation">
        <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
          <div className="relative shrink-0 border-b border-border px-6 pb-5 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-5 top-5 rounded-md p-1 text-text-muted hover:bg-card-hover hover:text-text-secondary"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <Avatar name={actor} seed={event.actor?.email} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">{actor}</p>
                <p className="text-xs text-text-muted">{event.actor?.role || 'console'}</p>
              </div>
            </div>
            <p className="mt-4 text-lg font-semibold text-text-primary">
              {eventTypeLabel(event.event_type)}
            </p>
            <span className={cn('mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium', badge.cls)}>
              {badge.label}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="overflow-hidden rounded-xl border border-border">
              {rows.map(([label, value], idx) => (
                <div
                  key={label}
                  className={cn(
                    'flex items-start justify-between gap-3 px-4 py-3',
                    idx < rows.length - 1 && 'border-b border-border/60'
                  )}
                >
                  <span className="shrink-0 text-sm text-text-secondary">{label}</span>
                  <span className="flex min-w-0 items-center justify-end gap-2 text-right text-sm text-text-primary">
                    <span className="break-all">{value || '—'}</span>
                    {(label === 'Reference' || label === 'Account key') && value ? (
                      <button
                        type="button"
                        onClick={() => copyText(value)}
                        className="shrink-0 rounded-md p-1 text-text-muted hover:bg-card-hover"
                        title={`Copy ${label.toLowerCase()}`}
                      >
                        <Copy size={14} />
                      </button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
            {event.account_key ? (
              <Link
                to={`/merchants/${encodeURIComponent(event.account_key)}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                Open merchant
              </Link>
            ) : null}
          </div>
        </aside>
      </div>
    </OverlayPortal>
  )
}

export default function CommandCenterPage() {
  const { user, token } = useAuth()
  const canView = canViewCommandCenter(user)

  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [forbidden, setForbidden] = useState(false)

  const [search, setSearch] = useState('')
  const [eventPrefix, setEventPrefix] = useState('')
  const [eventType, setEventType] = useState('')
  const [outcome, setOutcome] = useState('')
  const [actorUserId, setActorUserId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [query, setQuery] = useState({ reference: '' })

  const [pulse, setPulse] = useState({
    total: 0,
    success: 0,
    failure: 0,
    live_subscribers: 0,
    window_minutes: 60,
    by_type: {},
  })
  const [windowMinutes, setWindowMinutes] = useState(60)
  const [presence, setPresence] = useState([])
  const [selected, setSelected] = useState(null)
  const [liveIds, setLiveIds] = useState(() => new Set())
  const [missedLive, setMissedLive] = useState(0)
  const [clock, setClock] = useState(() => new Date())

  const seenIdsRef = useRef(new Set())
  const abortRef = useRef(null)

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setQuery({ reference: search.trim() }), 350)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [eventPrefix, eventType, outcome, actorUserId, query.reference, fromDate, toDate])

  const filters = useMemo(
    () => ({
      event_prefix: eventPrefix,
      event_type: eventType,
      outcome,
      actor_user_id: actorUserId,
      reference: query.reference,
    }),
    [eventPrefix, eventType, outcome, actorUserId, query.reference]
  )

  const fetchEvents = useCallback(async () => {
    abortRef.current?.abort?.()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      const params = { page, limit: PAGE_LIMIT }
      if (filters.event_prefix) params.event_prefix = filters.event_prefix
      if (filters.event_type) params.event_type = filters.event_type
      if (filters.outcome) params.outcome = filters.outcome
      if (filters.actor_user_id) params.actor_user_id = filters.actor_user_id
      if (filters.reference) params.reference = filters.reference
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      const payload = await getCommandCenterEvents(params, controller.signal)
      const { records, pagination } = unwrapCommandCenterEvents(payload)
      setRows(records)
      const nextTotal = Number(pagination.total ?? records.length) || 0
      const nextPages =
        Number(pagination.total_pages) > 0
          ? Number(pagination.total_pages)
          : Math.max(1, Math.ceil(nextTotal / PAGE_LIMIT) || 1)
      setTotal(nextTotal)
      setTotalPages(nextPages)
      seenIdsRef.current = new Set(records.map((row) => eventKey(row)).filter(Boolean))
      setMissedLive(0)
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
      if (err?.response?.status === 403) {
        setForbidden(true)
        setError('console.read is required to view the command center.')
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to load command center events.')
      }
    } finally {
      setLoading(false)
    }
  }, [page, filters, fromDate, toDate])

  const fetchPulse = useCallback(async () => {
    try {
      const payload = await getCommandCenterPulse({ window_minutes: windowMinutes })
      setPulse(unwrapCommandCenterPulse(payload))
    } catch {
      // keep last pulse
    }
  }, [windowMinutes])

  const fetchPresence = useCallback(async () => {
    try {
      const payload = await getCommandCenterPresence()
      setPresence(unwrapCommandCenterPresence(payload))
    } catch {
      // keep last presence
    }
  }, [])

  useEffect(() => {
    if (!canView) {
      setLoading(false)
      return undefined
    }
    setForbidden(false)
    fetchEvents()
    return () => abortRef.current?.abort?.()
  }, [canView, fetchEvents])

  useEffect(() => {
    if (!canView) return undefined
    fetchPulse()
    fetchPresence()
    const pulseTimer = window.setInterval(fetchPulse, PULSE_POLL_MS)
    const presenceTimer = window.setInterval(fetchPresence, PRESENCE_POLL_MS)
    return () => {
      window.clearInterval(pulseTimer)
      window.clearInterval(presenceTimer)
    }
  }, [canView, fetchPulse, fetchPresence])

  const handleAudit = useCallback(
    (event) => {
      if (!event || typeof event !== 'object') return
      const key = eventKey(event)
      if (seenIdsRef.current.has(key)) return
      seenIdsRef.current.add(key)
      if (!eventMatchesFilters(event, filters)) return

      if (page !== 1) {
        setMissedLive((n) => n + 1)
        return
      }

      setRows((prev) => [event, ...prev].slice(0, PAGE_LIMIT))
      setTotal((n) => n + 1)
      setLiveIds((prev) => {
        const next = new Set(prev)
        next.add(key)
        return next
      })
      window.setTimeout(() => {
        setLiveIds((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }, 2200)
    },
    [filters, page]
  )

  const streamStatus = useCommandCenterStream({
    enabled: canView && Boolean(token),
    token,
    onAudit: handleAudit,
  })

  const link = connectionCopy(streamStatus)
  const typeEntries = useMemo(
    () =>
      Object.entries(pulse.by_type || {})
        .map(([type, count]) => [type, Number(count) || 0])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
    [pulse.by_type]
  )
  const typeMax = typeEntries.reduce((max, [, n]) => Math.max(max, n), 1)

  const actorOptions = useMemo(() => {
    const map = new Map()
    for (const row of rows) {
      const id = row?.actor?.user_id
      if (id == null) continue
      if (!map.has(String(id))) map.set(String(id), actorName(row.actor))
    }
    return [...map.entries()]
  }, [rows])

  if (!canView) {
    return (
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-semibold text-text-primary">Command Center</h1>
        <div className="mt-6 flex gap-3 rounded-card border border-warning/30 bg-warning-bg/30 p-4">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-text-primary">Restricted</p>
            <p className="mt-1 text-sm text-text-secondary">
              console.read is required to watch the live ops wall.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-semibold text-text-primary">Command Center</h1>
        <div className="mt-6 flex gap-3 rounded-card border border-warning/30 bg-warning-bg/30 p-4">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-text-primary">Restricted</p>
            <p className="mt-1 text-sm text-text-secondary">
              {error || 'console.read is required to watch the live ops wall.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up pb-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                streamStatus === 'live' ? 'live-dot bg-accent' : 'bg-text-muted'
              )}
            />
            <span className={cn('text-[11px] font-medium uppercase tracking-wide', link.cls)}>{link.label}</span>
            <span className="text-[11px] text-text-muted">SSE</span>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">Command Center</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Live wall of everything the team does — UI clicks and navigation, API traffic, and major ops
            actions like resolve, webhook replay, Udara, and RBAC.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-xs tabular-nums text-text-muted">{formatDate(clock.toISOString())}</p>
          <select
            value={windowMinutes}
            onChange={(e) => setWindowMinutes(Number(e.target.value))}
            className="h-9 rounded-full border border-border bg-card px-3 text-xs text-text-secondary outline-none"
          >
            <option value={15}>Last 15 min</option>
            <option value={60}>Last 60 min</option>
            <option value={360}>Last 6 hours</option>
            <option value={1440}>Last 24 hours</option>
          </select>
          <button
            type="button"
            onClick={() => {
              fetchEvents()
              fetchPulse()
              fetchPresence()
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs text-text-secondary hover:bg-card-hover hover:text-text-primary"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-card border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-accent" />
            <h2 className="text-sm font-medium text-text-primary">On the floor</h2>
            <span className="rounded-full bg-card-hover px-2 py-0.5 text-[11px] text-text-muted">
              {presence.length} online
            </span>
          </div>
          <p className="text-[11px] text-text-muted">Active MFA sessions</p>
        </div>
        {presence.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-muted">No other operators showing as online right now.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {presence.map((session, idx) => {
              if (!session || typeof session !== 'object') return null
              const name = asText(session.name || session.email || session.user_key, 'Operator')
              return (
                <div
                  key={asText(session.user_id || session.session_id || session.email, `presence-${idx}`)}
                  className="flex min-w-[196px] items-center gap-3 rounded-xl border border-border/70 bg-page px-3 py-2.5"
                >
                  <div className="relative">
                    <Avatar name={name} seed={asText(session.email, name)} />
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary">{name}</p>
                    <p className="truncate text-[11px] text-text-muted">
                      {asText(session.role, 'console')} ·{' '}
                      {session.last_seen ? timeAgo(session.last_seen) : 'now'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PulseCard
          label="Actions in window"
          value={formatNumber(pulse.total)}
          hint={`${windowMinutes} minute window`}
          icon={Activity}
          iconCls="bg-accent-bg text-accent"
        />
        <PulseCard
          label="Successful"
          value={formatNumber(pulse.success)}
          hint="Completed without error"
          icon={CheckCircle2}
          iconCls="bg-success-bg text-success"
        />
        <PulseCard
          label="Failed"
          value={formatNumber(pulse.failure)}
          hint="Failure or error outcomes"
          icon={XCircle}
          iconCls="bg-error-bg text-error"
        />
        <PulseCard
          label="Live subscribers"
          value={formatNumber(pulse.live_subscribers)}
          hint="Walls currently connected"
          icon={Radio}
          iconCls="bg-info-bg text-info"
        />
      </div>

      {typeEntries.length > 0 ? (
        <div className="mb-4 rounded-card border border-border bg-card p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">Breakdown by action</p>
          <div className="grid gap-2 md:grid-cols-2">
            {typeEntries.map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-xs text-text-secondary">{eventTypeLabel(type)}</span>
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-card-hover">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(8, (Number(count) / typeMax) * 100)}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs tabular-nums text-text-muted">{count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card-shell">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 max-w-xl">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, merchant, operator…"
              className="h-10 w-full rounded-xl border border-border bg-page pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/40"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={actorUserId}
              onChange={(e) => setActorUserId(e.target.value)}
              className="h-10 rounded-xl border border-border bg-page px-3 text-xs text-text-secondary outline-none"
            >
              <option value="">All operators</option>
              {actorOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-10 rounded-xl border border-border bg-page px-3 text-xs text-text-secondary outline-none"
              aria-label="From date"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-10 rounded-xl border border-border bg-page px-3 text-xs text-text-secondary outline-none"
              aria-label="To date"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2">
          {EVENT_PREFIX_CHIPS.map((chip) => (
            <button
              key={chip.value || 'all-sources'}
              type="button"
              onClick={() => {
                setEventPrefix(chip.value)
                setEventType('')
              }}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-[11px] font-medium',
                eventPrefix === chip.value
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="tab-scroll">
          {EVENT_TYPE_CHIPS.map((chip) => (
            <button
              key={chip.value || 'all'}
              type="button"
              onClick={() => setEventType(chip.value)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                eventType === chip.value
                  ? 'bg-accent text-page'
                  : 'bg-card-hover text-text-secondary hover:text-text-primary'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2">
          {OUTCOME_CHIPS.map((chip) => (
            <button
              key={chip.value || 'any'}
              type="button"
              onClick={() => setOutcome(chip.value)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-[11px] font-medium',
                outcome === chip.value
                  ? 'bg-card-hover text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {missedLive > 0 ? (
          <button
            type="button"
            onClick={() => {
              setPage(1)
              fetchEvents()
            }}
            className="w-full border-b border-accent/20 bg-accent-bg px-4 py-2 text-left text-xs text-accent hover:brightness-110"
          >
            {missedLive} new {missedLive === 1 ? 'action' : 'actions'} while you were on another page — jump to live
          </button>
        ) : null}

        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-error">{error}</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-sm text-text-muted">No activity in this view yet.</p>
            <p className="mt-1 text-xs text-text-muted">
              Navigate, click, search, or run ops actions — UI and API events will land here live.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {rows.map((event, idx) => {
              if (!event || typeof event !== 'object') return null
              const key = eventKey(event) || `row-${idx}`
              const badge = outcomeBadge(event.outcome)
              const actor = actorName(event.actor)
              const live = liveIds.has(key)
              const source = eventSourceKind(event.event_type)
              const headline = asText(event.summary, eventTypeLabel(event.event_type))
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setSelected(event)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-card-hover/30',
                      live && 'feed-row-live'
                    )}
                  >
                    <div className="relative mt-0.5">
                      <Avatar name={actor} seed={asText(event.actor?.email, actor)} size="sm" />
                      {live ? (
                        <span className="absolute -left-1 top-2 h-8 w-0.5 rounded-full bg-accent" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            source === 'ui' && 'bg-info-bg text-info',
                            source === 'api' && 'bg-warning-bg text-warning',
                            source === 'ops' && 'bg-accent-bg text-accent'
                          )}
                        >
                          {source}
                        </span>
                        <p className="text-sm font-medium text-text-primary">{headline}</p>
                        {live ? (
                          <span className="rounded-full bg-accent-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                            New
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {actor}
                        {event.actor?.role ? ` · ${asText(event.actor.role)}` : ''}
                        {event.reference ? ` · ${asText(event.reference)}` : ''}
                        {event.account_key ? ` · ${asText(event.account_key)}` : ''}
                        {event.target_key && !event.account_key ? ` · ${asText(event.target_key)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', badge.cls)}>
                        {asText(badge.label)}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        {event.date_created ? timeAgo(event.date_created) : '—'}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={PAGE_LIMIT}
          label="actions"
          onPageChange={setPage}
        />
      </div>

      <EventDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
