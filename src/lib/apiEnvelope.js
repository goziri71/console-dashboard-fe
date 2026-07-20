/** Console API JSON envelope (see backend contract). */
export const API_SUCCESS_CODE = 2000

/**
 * @param {unknown} payload
 * @returns {payload is { state: boolean, data: unknown, code?: number, message?: string }}
 */
export function isConsoleEnvelope(payload) {
  return (
    payload != null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    typeof payload.state === 'boolean' &&
    'data' in payload
  )
}

/**
 * Crosslink / console responses may use `{ success, data }` or `{ status, data }`.
 * @param {unknown} payload
 */
export function isSuccessEnvelope(payload) {
  return (
    payload != null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    'data' in payload &&
    (typeof payload.success === 'boolean' || typeof payload.status === 'boolean')
  )
}

export function isEnvelopeSuccessful(payload) {
  if (!payload || typeof payload !== 'object') return false
  if (payload.success === true) return true
  if (payload.status === true) return true
  if (payload.state === true) return true
  return false
}

/** Accept both legacy `2000` and HTTP-style `200` success codes. */
export function isSuccessfulApiCode(code) {
  if (code === undefined || code === null || code === '') return true
  const codeNum = Number(code)
  if (!Number.isFinite(codeNum)) return true
  if (codeNum === API_SUCCESS_CODE) return true
  return codeNum >= 200 && codeNum < 300
}

/** Map body `code` (e.g. 4040) to HTTP-like status (e.g. 404) for Axios error shape. */
export function deriveHttpStatusFromApiCode(code) {
  if (typeof code !== 'number' || code < 1000) {
    if (typeof code === 'number' && code >= 200 && code < 600) return code
    return 400
  }
  return Math.min(599, Math.max(200, Math.floor(code / 10)))
}
