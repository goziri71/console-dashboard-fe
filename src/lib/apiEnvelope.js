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

/** Map body `code` (e.g. 4040) to HTTP-like status (e.g. 404) for Axios error shape. */
export function deriveHttpStatusFromApiCode(code) {
  if (typeof code !== 'number' || code < 1000) return 400
  return Math.min(599, Math.max(200, Math.floor(code / 10)))
}
