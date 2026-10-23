const ALPHA_MFA_REQUIRED_DEFAULT =
  'MFA is not enabled on your Alpha account. Enable MFA on Redbiller/Alpha, then sign in to Console again.'

function alphaReason(body) {
  if (body == null || typeof body !== 'object') return null
  const nested = body.data
  if (nested != null && typeof nested === 'object' && nested.reason != null) {
    const r = String(nested.reason).trim()
    return r || null
  }
  if (body.reason != null) {
    const r = String(body.reason).trim()
    return r || null
  }
  return null
}

function joinMessageAndReason(message, reason) {
  const msg = message != null ? String(message).trim() : ''
  const reas = reason != null ? String(reason).trim() : ''
  if (msg && reas && reas !== msg) return `${msg} ${reas}`
  return msg || reas || ''
}

/**
 * User-facing copy for login + Alpha MFA errors (console or Alpha envelope shapes).
 * @param {unknown} error — Axios error from auth calls
 */
export function authLoginErrorMessage(error) {
  const status = error?.response?.status
  const body = error?.response?.data
  const serverMessage = body?.message
  const reason = alphaReason(body)
  const dataCode = body?.data?.code ?? body?.code

  if (status === 400) {
    return joinMessageAndReason(serverMessage, reason) || 'Check your email and password and try again.'
  }
  if (status === 401) {
    return (
      joinMessageAndReason(serverMessage, reason) ||
      'Invalid email, password, or authenticator code.'
    )
  }
  if (status === 403) {
    const mfaGate =
      dataCode === 'alpha_mfa_required' ||
      dataCode === 'account_mfa_disabled' ||
      /account\.mfa|mfa.*not enabled|enable mfa/i.test(String(serverMessage ?? ''))
    if (mfaGate || !serverMessage) {
      return joinMessageAndReason(serverMessage, reason) || ALPHA_MFA_REQUIRED_DEFAULT
    }
    return joinMessageAndReason(serverMessage, reason) || serverMessage
  }
  if (status === 404) {
    return joinMessageAndReason(serverMessage, reason) || 'User not provisioned. Contact admin.'
  }
  if (status === 409) {
    return joinMessageAndReason(serverMessage, reason) || 'This authentication request is no longer valid.'
  }
  if (status === 429) return 'Too many attempts. Wait a moment and try again.'
  if (status === 502) {
    return (
      joinMessageAndReason(serverMessage, reason) ||
      'Alpha Account Auth is unreachable or misconfigured. Try again shortly.'
    )
  }
  if (status === 500) {
    return joinMessageAndReason(serverMessage, reason) || 'The login service is temporarily unavailable. Try again shortly.'
  }
  return (
    joinMessageAndReason(serverMessage, reason) ||
    error?.message ||
    'Authentication failed. Please try again.'
  )
}
