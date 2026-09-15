/**
 * List pagination helpers for the console envelope.
 * New contract: top-level `pagination: { page, limit, has_next, has_prev }` (no total / total_pages).
 * Legacy total/total_pages still accepted when present.
 */

/**
 * Preserve sibling `pagination` when Axios unwraps `{ state, data, pagination }`.
 * @param {{ data?: unknown, pagination?: unknown }} body
 */
export function attachEnvelopePagination(body) {
  const payload = body?.data
  const pagination = body?.pagination
  if (pagination == null || typeof pagination !== 'object' || Array.isArray(pagination)) {
    return payload
  }
  if (Array.isArray(payload)) {
    return { records: payload, data: payload, pagination }
  }
  if (payload != null && typeof payload === 'object') {
    return {
      ...payload,
      pagination: payload.pagination ?? pagination,
    }
  }
  return { data: payload, pagination }
}

/**
 * @param {unknown} raw
 * @param {{ page?: number, limit?: number, recordCount?: number }} [opts]
 */
export function normalizeListPagination(raw, opts = {}) {
  const p = raw != null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const page = Math.max(1, Number(p.page ?? opts.page) || 1)
  const limit = Math.max(1, Number(p.limit ?? opts.limit) || 20)
  const recordCount = Math.max(0, Number(opts.recordCount) || 0)

  const totalRaw = Number(p.total)
  const totalPagesRaw = Number(p.total_pages ?? p.totalPages ?? p.last_page ?? p.lastPage)
  const hasTotal = Number.isFinite(totalRaw) && totalRaw >= 0
  const hasTotalPages = Number.isFinite(totalPagesRaw) && totalPagesRaw > 0

  let hasNext = p.has_next
  if (typeof hasNext !== 'boolean') {
    if (typeof p.hasNext === 'boolean') hasNext = p.hasNext
    else if (hasTotalPages) hasNext = page < totalPagesRaw
    else if (hasTotal) hasNext = page * limit < totalRaw
    else hasNext = recordCount >= limit
  }

  let hasPrev = p.has_prev
  if (typeof hasPrev !== 'boolean') {
    if (typeof p.hasPrev === 'boolean') hasPrev = p.hasPrev
    else hasPrev = page > 1
  }

  return {
    page,
    limit,
    hasNext: Boolean(hasNext),
    hasPrev: Boolean(hasPrev),
    total: hasTotal ? totalRaw : undefined,
    totalPages: hasTotalPages ? totalPagesRaw : undefined,
  }
}

/**
 * @param {unknown} payload - Unwrapped axios data (or full body)
 * @param {{ page?: number, limit?: number }} [opts]
 */
export function unwrapListPayload(payload, opts = {}) {
  const root = payload ?? {}

  let records = []
  if (Array.isArray(root)) {
    records = root
  } else if (Array.isArray(root.records)) {
    records = root.records
  } else if (Array.isArray(root.items)) {
    records = root.items
  } else if (Array.isArray(root.data)) {
    records = root.data
  } else if (root.data != null && typeof root.data === 'object' && Array.isArray(root.data.records)) {
    records = root.data.records
  }

  const paginationRaw =
    (!Array.isArray(root) && root.pagination) ||
    (!Array.isArray(root) && root.meta) ||
    (root.data != null && typeof root.data === 'object' && !Array.isArray(root.data)
      ? root.data.pagination
      : null) ||
    {}

  const pagination = normalizeListPagination(paginationRaw, {
    page: opts.page,
    limit: opts.limit,
    recordCount: records.length,
  })

  return { records, pagination }
}
