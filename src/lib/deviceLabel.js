const DEVICE_ID_STORAGE_KEY = 'sterllo_device_id'

function browserName(userAgent) {
  if (/Edg\//.test(userAgent)) return 'Edge'
  if (/Chrome\//.test(userAgent)) return 'Chrome'
  if (/Firefox\//.test(userAgent)) return 'Firefox'
  if (/Safari\//.test(userAgent)) return 'Safari'
  return 'Browser'
}

function createDeviceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16)
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

/** Stable browser device id for Alpha `client.device.id` (persisted in localStorage). */
export function getDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
    if (existing && existing.trim()) return existing.trim()
    const next = createDeviceId()
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, next)
    return next
  } catch {
    return createDeviceId()
  }
}

export function getDeviceLabel() {
  const userAgent = navigator.userAgent || ''
  const platform =
    navigator.userAgentData?.platform ||
    navigator.platform ||
    (/iPhone|iPad/.test(userAgent) ? 'iOS' : 'Unknown device')
  return `${browserName(userAgent)} on ${platform}`
}
