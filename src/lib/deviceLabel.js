function browserName(userAgent) {
  if (/Edg\//.test(userAgent)) return 'Edge'
  if (/Chrome\//.test(userAgent)) return 'Chrome'
  if (/Firefox\//.test(userAgent)) return 'Firefox'
  if (/Safari\//.test(userAgent)) return 'Safari'
  return 'Browser'
}

export function getDeviceLabel() {
  const userAgent = navigator.userAgent || ''
  const platform =
    navigator.userAgentData?.platform ||
    navigator.platform ||
    (/iPhone|iPad/.test(userAgent) ? 'iOS' : 'Unknown device')
  return `${browserName(userAgent)} on ${platform}`
}
