export const EVENT_PREFIX_CHIPS = [
  { value: '', label: 'All sources' },
  { value: 'ui.', label: 'UI activity' },
  { value: 'api.', label: 'API requests' },
]

export const EVENT_TYPE_CHIPS = [
  { value: '', label: 'All actions' },
  { value: 'ui.click', label: 'UI click' },
  { value: 'ui.page_view', label: 'Page view' },
  { value: 'ui.navigation', label: 'Navigation' },
  { value: 'ui.filter', label: 'Filter' },
  { value: 'ui.search', label: 'Search' },
  { value: 'ui.tab_change', label: 'Tab change' },
  { value: 'api.request', label: 'API request' },
  { value: 'beamer.ngn_tsq', label: 'NGN resolve' },
  { value: 'deposit.webhook_replay', label: 'Webhook replay' },
  { value: 'beamer.account_link', label: 'Udara link' },
  { value: 'beamer.account_update', label: 'Udara update' },
  { value: 'rbac.role_permissions_updated', label: 'Role permissions' },
  { value: 'rbac.user_role_assigned', label: 'Role assigned' },
  { value: 'rbac.user_role_revoked', label: 'Role revoked' },
  { value: 'rbac.user_created', label: 'User created' },
  { value: 'transaction.approve', label: 'Tx approve' },
  { value: 'transaction.cancel', label: 'Tx cancel' },
]

export const OUTCOME_CHIPS = [
  { value: '', label: 'Any outcome' },
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
  { value: 'error', label: 'Error' },
]

const TYPE_LABELS = {
  'ui.page_view': 'Page view',
  'ui.navigation': 'Navigation',
  'ui.click': 'UI click',
  'ui.filter': 'Filter applied',
  'ui.search': 'Search',
  'ui.tab_change': 'Tab change',
  'ui.modal_open': 'Modal opened',
  'ui.modal_close': 'Modal closed',
  'ui.form_submit': 'Form submitted',
  'ui.copy': 'Copied',
  'ui.export': 'Export',
  'ui.selection': 'Selection',
  'api.request': 'API request',
  'transaction.approve': 'Transaction approved',
  'transaction.cancel': 'Transaction cancelled',
  'deposit.webhook_replay': 'Deposit webhook replay',
  'beamer.account_link': 'Udara account link',
  'beamer.account_update': 'Udara account update',
  'beamer.ngn_tsq': 'Beamer NGN TSQ',
  'rbac.role_permissions_updated': 'Role permissions updated',
  'rbac.user_role_assigned': 'User role assigned',
  'rbac.user_role_revoked': 'User role revoked',
  'rbac.user_created': 'Console user created',
}

export function eventTypeLabel(type) {
  const raw = String(type ?? '').trim()
  if (!raw) return 'Action'
  return TYPE_LABELS[raw] ?? raw.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function eventSourceKind(type) {
  const raw = String(type ?? '')
  if (raw.startsWith('ui.')) return 'ui'
  if (raw.startsWith('api.')) return 'api'
  return 'ops'
}

export function outcomeKind(outcome) {
  const s = String(outcome ?? '').toLowerCase()
  if (s === 'success' || s === 'ok' || s === 'successful') return 'success'
  if (s === 'failure' || s === 'failed' || s === 'fail') return 'failure'
  if (s === 'error') return 'error'
  return 'neutral'
}

export function outcomeBadge(outcome) {
  const kind = outcomeKind(outcome)
  if (kind === 'success') return { label: 'Success', cls: 'bg-success-bg text-success' }
  if (kind === 'failure') return { label: 'Failure', cls: 'bg-error-bg text-error' }
  if (kind === 'error') return { label: 'Error', cls: 'bg-error-bg text-error' }
  return { label: outcome || '—', cls: 'bg-card-hover text-text-muted' }
}

function unwrapRoot(payload) {
  if (payload?.data != null && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    if (payload.data.records || payload.data.pagination || payload.data.by_type || payload.data.sessions) {
      return payload.data
    }
  }
  return payload ?? {}
}

export function unwrapCommandCenterEvents(payload) {
  const root = unwrapRoot(payload)
  const records = root.records ?? root.events ?? (Array.isArray(root) ? root : [])
  const pagination = root.pagination ?? root.meta ?? {}
  return {
    records: Array.isArray(records) ? records : [],
    pagination,
  }
}

export function unwrapCommandCenterPulse(payload) {
  const root = unwrapRoot(payload)
  const byType = root.by_type && typeof root.by_type === 'object' ? root.by_type : {}
  const typeTotal = Object.values(byType).reduce((sum, n) => sum + Number(n || 0), 0)
  return {
    total: Number(root.total ?? root.total_events ?? typeTotal ?? 0),
    success: Number(root.success ?? root.successful ?? root.by_outcome?.success ?? 0),
    failure: Number(root.failure ?? root.failed ?? root.by_outcome?.failure ?? 0),
    live_subscribers: Number(root.live_subscribers ?? root.subscribers ?? 0),
    window_minutes: Number(root.window_minutes ?? 60),
    by_type: byType,
  }
}

export function unwrapCommandCenterPresence(payload) {
  const root = unwrapRoot(payload)
  const sessions = root.sessions ?? root.records ?? root.presence ?? []
  return Array.isArray(sessions) ? sessions : []
}

export function actorName(actor) {
  if (!actor || typeof actor !== 'object') return 'Unknown operator'
  return actor.name || actor.email || actor.user_key || `User ${actor.user_id ?? '—'}`
}

export function initials(nameOrEmail) {
  const raw = String(nameOrEmail || '').trim()
  if (!raw) return '?'
  if (raw.includes('@')) return raw.slice(0, 2).toUpperCase()
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function eventMatchesFilters(event, filters) {
  if (!event) return false
  if (filters.event_prefix && !String(event.event_type || '').startsWith(filters.event_prefix)) {
    return false
  }
  if (filters.event_type && event.event_type !== filters.event_type) return false
  if (filters.outcome && outcomeKind(event.outcome) !== outcomeKind(filters.outcome)) return false
  if (filters.actor_user_id && String(event.actor?.user_id ?? '') !== String(filters.actor_user_id)) {
    return false
  }
  if (filters.reference) {
    const q = String(filters.reference).trim().toLowerCase()
    const hay = [
      event.reference,
      event.account_key,
      event.target_key,
      event.summary,
      event.actor?.email,
      event.actor?.name,
      event.metadata?.path,
      event.metadata?.label,
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

export function eventKey(event) {
  if (event?.id != null) return String(event.id)
  return [event?.event_type, event?.reference, event?.date_created, event?.session_id, event?.summary].join(
    ':'
  )
}
