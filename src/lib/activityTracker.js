import { postCommandCenterActivity, postCommandCenterActivityKeepalive } from '../services/ops'

const MAX_BATCH = 40
const FLUSH_MS = 3000

const ALLOWED_TYPES = new Set([
  'ui.page_view',
  'ui.navigation',
  'ui.click',
  'ui.filter',
  'ui.search',
  'ui.tab_change',
  'ui.modal_open',
  'ui.modal_close',
  'ui.form_submit',
  'ui.copy',
  'ui.export',
  'ui.selection',
])

let enabled = false
let queue = []
let flushTimer = null
let flushing = false
let lastPath = ''

function currentPath() {
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname || '/'}${window.location.search || ''}`
}

function normalizeEvent(partial) {
  const event_type = String(partial?.event_type || '').trim()
  if (!ALLOWED_TYPES.has(event_type)) return null

  const path = String(partial.path || currentPath()).slice(0, 500)
  const event = {
    event_type,
    path,
    client_ts: partial.client_ts || new Date().toISOString(),
  }

  if (partial.label) event.label = String(partial.label).slice(0, 200)
  if (partial.element) event.element = String(partial.element).slice(0, 120)
  if (partial.account_key) event.account_key = String(partial.account_key).slice(0, 120)
  if (partial.reference) event.reference = String(partial.reference).slice(0, 200)
  if (partial.metadata && typeof partial.metadata === 'object') {
    event.metadata = partial.metadata
  }
  return event
}

async function flushQueue({ keepalive = false } = {}) {
  if (!queue.length || flushing) return
  const batch = queue.splice(0, MAX_BATCH)
  if (!batch.length) return

  if (keepalive) {
    postCommandCenterActivityKeepalive(batch)
    if (queue.length) postCommandCenterActivityKeepalive(queue.splice(0, MAX_BATCH))
    return
  }

  flushing = true
  try {
    await postCommandCenterActivity({ events: batch })
    if (queue.length >= MAX_BATCH) {
      flushing = false
      await flushQueue()
      return
    }
  } catch {
    // drop failed batch — avoid infinite retry loops on 403/5xx
  } finally {
    flushing = false
  }
}

function scheduleFlush() {
  if (flushTimer != null) return
  flushTimer = window.setTimeout(() => {
    flushTimer = null
    flushQueue()
  }, FLUSH_MS)
}

export function setActivityTrackingEnabled(next) {
  enabled = Boolean(next)
  if (!enabled) {
    queue = []
    if (flushTimer != null) {
      window.clearTimeout(flushTimer)
      flushTimer = null
    }
  }
}

export function trackActivity(partial) {
  if (!enabled) return
  const event = normalizeEvent(partial)
  if (!event) return
  queue.push(event)
  if (queue.length >= MAX_BATCH) {
    if (flushTimer != null) {
      window.clearTimeout(flushTimer)
      flushTimer = null
    }
    flushQueue()
    return
  }
  scheduleFlush()
}

export function trackPageView(path = currentPath()) {
  const next = String(path || '/')
  if (next === lastPath) return
  lastPath = next
  trackActivity({
    event_type: 'ui.page_view',
    path: next,
  })
}

export function trackNavigation({ path = currentPath(), label, element } = {}) {
  trackActivity({
    event_type: 'ui.navigation',
    path,
    label,
    element: element || 'nav',
  })
}

export function trackClick({ label, element, path, account_key, reference, metadata } = {}) {
  trackActivity({
    event_type: 'ui.click',
    path,
    label,
    element,
    account_key,
    reference,
    metadata,
  })
}

export function trackFilter({ label, path, metadata } = {}) {
  trackActivity({
    event_type: 'ui.filter',
    path,
    label,
    element: 'filter',
    metadata,
  })
}

export function trackSearch({ label, path, metadata } = {}) {
  trackActivity({
    event_type: 'ui.search',
    path,
    label,
    element: 'search',
    metadata,
  })
}

export function trackTabChange({ label, path, metadata } = {}) {
  trackActivity({
    event_type: 'ui.tab_change',
    path,
    label,
    element: 'tab',
    metadata,
  })
}

export function trackModal({ open, label, path, element } = {}) {
  trackActivity({
    event_type: open ? 'ui.modal_open' : 'ui.modal_close',
    path,
    label,
    element: element || 'modal',
  })
}

export function trackCopy({ label, reference, path } = {}) {
  trackActivity({
    event_type: 'ui.copy',
    path,
    label: label || 'Copy',
    element: 'copy',
    reference,
  })
}

export function trackExport({ label, path } = {}) {
  trackActivity({
    event_type: 'ui.export',
    path,
    label: label || 'Export',
    element: 'export',
  })
}

export function flushActivityNow(opts) {
  return flushQueue(opts)
}

export function installActivityLifecycleFlush() {
  const onHide = () => {
    if (document.visibilityState === 'hidden') flushQueue({ keepalive: true })
  }
  const onUnload = () => flushQueue({ keepalive: true })
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onUnload)
  return () => {
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', onUnload)
  }
}

function cleanLabel(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function closestAuditTarget(node) {
  if (!node || typeof node.closest !== 'function') return null
  return (
    node.closest('[data-audit]') ||
    node.closest('button, a[href], [role="button"], summary') ||
    null
  )
}

export function resolveClickAudit(target) {
  const el = closestAuditTarget(target)
  if (!el) return null
  if (el.disabled || el.getAttribute?.('aria-disabled') === 'true') return null

  const dataset = el.dataset || {}
  const label =
    cleanLabel(dataset.auditLabel || dataset.audit || el.getAttribute('aria-label') || el.textContent) ||
    cleanLabel(el.getAttribute('title')) ||
    el.tagName.toLowerCase()

  const element =
    cleanLabel(dataset.auditElement || el.id || el.getAttribute('name')) ||
    el.tagName.toLowerCase()

  const account_key = dataset.auditAccountKey || dataset.accountKey || undefined
  const reference = dataset.auditReference || dataset.reference || undefined

  const type = dataset.auditType
  if (type && ALLOWED_TYPES.has(type)) {
    return {
      event_type: type,
      label,
      element,
      account_key,
      reference,
    }
  }

  if (dataset.auditNav != null || el.closest?.('nav')) {
    return {
      event_type: 'ui.navigation',
      label,
      element: element || 'nav-item',
      account_key,
      reference,
    }
  }

  return {
    event_type: 'ui.click',
    label,
    element,
    account_key,
    reference,
  }
}
