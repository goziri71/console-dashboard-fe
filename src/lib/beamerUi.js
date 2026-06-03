function unwrapPayload(payload) {
  if (payload == null) return null
  if (
    typeof payload === 'object' &&
    payload.data != null &&
    typeof payload.data === 'object' &&
    !Array.isArray(payload.data)
  ) {
    return payload.data
  }
  return payload
}

export function isUdaraLinked(merchant) {
  return merchant?.udara360 != null && typeof merchant.udara360 === 'object'
}

export function pickIsvsBody(res) {
  const inner = unwrapPayload(res) ?? res ?? {}
  return inner.isvs ?? inner.data?.isvs ?? null
}

/** Treat as success when ISVS state is true or code is 2000. */
export function isBeamerSuccess(res) {
  const isvs = pickIsvsBody(res)
  if (isvs?.state === true || Number(isvs?.code) === 2000) return true
  if (res?.success === true && Number(res?.code) === 200) return true
  return false
}

export function getBeamerErrorMessage(err, fallback = 'Beamer integration request failed.') {
  const body = err?.response?.data ?? err ?? {}
  const isvs = body?.data?.isvs ?? body?.isvs
  if (isvs?.message) return String(isvs.message)
  if (body?.message) return String(body.message)
  if (typeof err?.message === 'string' && err.message) return err.message
  return fallback
}

export function isBeamerNoIntegrationError(message) {
  return /no Udara360 integration/i.test(String(message || ''))
}

export function buildBeamerLinkBody({ accountNumber, clientId, clientKey }) {
  return {
    data: {
      account_number: accountNumber.trim(),
      client: {
        id: clientId.trim(),
        key: clientKey.trim(),
      },
    },
  }
}

export function buildBeamerUpdateBody({ udara360, accountNumber, clientId, clientKey }) {
  const u = udara360 && typeof udara360 === 'object' ? udara360 : {}
  return {
    data: {
      id: u.identifier ?? u.id ?? '',
      account_number: accountNumber.trim() || u.account_number || '',
      client: {
        id: clientId.trim() || u.client_id || '',
        key: clientKey.trim(),
      },
    },
  }
}
