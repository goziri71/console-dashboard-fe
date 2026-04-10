/**
 * Normalize auth API payloads so roles/permissions are read from the correct path.
 * See backend guide §0.1: login/register use data.user; profile uses data (user fields on inner data).
 *
 * Handles:
 * - Console envelope already unwrapped by api.js: { user, token } or profile fields at top level
 * - Success envelope not unwrapped: { success, code, data: { user, token } } or profile as
 *   { success, code, data: { …user fields, roles, permissions, role } }
 */

function isLikelyUserRecord(o) {
  if (o == null || typeof o !== 'object') return false
  return (
    'email' in o ||
    'username' in o ||
    Array.isArray(o.roles) ||
    Array.isArray(o.permissions) ||
    'role' in o ||
    'id' in o ||
    'user_key' in o
  )
}

/**
 * @param {unknown} payload - Body from login/register, or axios `data` after interceptors
 * @returns {Record<string, unknown> | null}
 */
export function extractUserFromLoginPayload(payload) {
  if (payload == null || typeof payload !== 'object') return null
  if (isLikelyUserRecord(payload)) return /** @type {Record<string, unknown>} */ (payload)
  if ('data' in payload && payload.data != null && typeof payload.data === 'object') {
    const d = payload.data
    if ('user' in d && d.user != null && typeof d.user === 'object') {
      return /** @type {Record<string, unknown>} */ (d.user)
    }
    if (isLikelyUserRecord(d)) return /** @type {Record<string, unknown>} */ (d)
  }
  if ('user' in payload && payload.user != null && typeof payload.user === 'object') {
    return /** @type {Record<string, unknown>} */ (payload.user)
  }
  return null
}

/**
 * @param {unknown} payload - GET /auth/profile response (may be wrapped or unwrapped)
 * @returns {Record<string, unknown> | null}
 */
export function extractUserFromProfilePayload(payload) {
  if (payload == null || typeof payload !== 'object') return null
  if (isLikelyUserRecord(payload)) return /** @type {Record<string, unknown>} */ (payload)
  if ('data' in payload && payload.data != null && typeof payload.data === 'object') {
    const d = payload.data
    if ('user' in d && d.user != null && typeof d.user === 'object') {
      return /** @type {Record<string, unknown>} */ (d.user)
    }
    if (isLikelyUserRecord(d)) return /** @type {Record<string, unknown>} */ (d)
  }
  return null
}

/**
 * @param {unknown} payload - Login/register response body
 * @returns {string | null}
 */
export function extractTokenFromAuthPayload(payload) {
  if (payload == null || typeof payload !== 'object') return null
  if (typeof payload.token === 'string') return payload.token
  if (payload.data != null && typeof payload.data === 'object') {
    const t = payload.data.token ?? payload.data.access_token
    if (typeof t === 'string') return t
  }
  return null
}
