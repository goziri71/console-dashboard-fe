const KEYS = {
  token: 'sterllo_token',
  user: 'sterllo_user',
  sessionId: 'sterllo_session_id',
  userKey: 'sterllo_user_key',
  deviceSession: 'sterllo_device_session',
  notice: 'sterllo_auth_notice',
}

function parseJson(value) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function getStoredAuth() {
  return {
    token: sessionStorage.getItem(KEYS.token),
    user: parseJson(sessionStorage.getItem(KEYS.user)),
    sessionID: sessionStorage.getItem(KEYS.sessionId),
    userKey: sessionStorage.getItem(KEYS.userKey),
    session: parseJson(sessionStorage.getItem(KEYS.deviceSession)),
  }
}

export function storeAuthenticatedSession(auth) {
  sessionStorage.setItem(KEYS.token, auth.token)
  sessionStorage.setItem(KEYS.user, JSON.stringify(auth.user))
  if (auth.sessionID) sessionStorage.setItem(KEYS.sessionId, auth.sessionID)
  else sessionStorage.removeItem(KEYS.sessionId)
  if (auth.userKey) sessionStorage.setItem(KEYS.userKey, auth.userKey)
  else sessionStorage.removeItem(KEYS.userKey)
  if (auth.session) sessionStorage.setItem(KEYS.deviceSession, JSON.stringify(auth.session))
  else sessionStorage.removeItem(KEYS.deviceSession)
}

export function updateStoredUser(user) {
  if (user) sessionStorage.setItem(KEYS.user, JSON.stringify(user))
  else sessionStorage.removeItem(KEYS.user)
}

export function clearStoredAuth() {
  Object.entries(KEYS).forEach(([name, key]) => {
    if (name !== 'notice') sessionStorage.removeItem(key)
  })
  // Remove credentials written by older builds.
  localStorage.removeItem(KEYS.token)
  localStorage.removeItem(KEYS.user)
  localStorage.removeItem(KEYS.sessionId)
  localStorage.removeItem(KEYS.userKey)
  localStorage.removeItem(KEYS.deviceSession)
}

export function setAuthNotice(message) {
  sessionStorage.setItem(KEYS.notice, message)
}

export function consumeAuthNotice() {
  const message = sessionStorage.getItem(KEYS.notice)
  sessionStorage.removeItem(KEYS.notice)
  return message
}

export function getAuthToken() {
  return sessionStorage.getItem(KEYS.token)
}
