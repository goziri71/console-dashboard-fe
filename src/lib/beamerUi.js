function unwrapMerchantPayload(payload) {
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

/** Parse Beamer/ISVS response (full body preserved for /integrations/beamer/*). */
export function parseBeamerResponse(res) {
  const body = res != null && typeof res === 'object' ? res : {}
  const data = body.data != null && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {}
  const nestedIsvs = data.isvs ?? body.isvs

  return {
    isvsVerified: data.isvs_verified ?? body.isvs_verified,
    isvsState: nestedIsvs?.state ?? body.state,
    isvsCode: nestedIsvs?.code ?? body.code,
    isvsMessage: nestedIsvs?.message ?? body.message,
    isvs: nestedIsvs ?? (body.state != null ? body : null),
  }
}

export function isIsvsDirectSuccess(parsed) {
  if (!parsed) return false
  return parsed.isvsState === true || Number(parsed.isvsCode) === 2000
}

export function getBeamerErrorMessage(err, fallback = 'Beamer integration request failed.') {
  const body = err?.response?.data ?? err ?? {}
  if (body.state === false && body.message) return String(body.message)
  const nested = body.data?.isvs ?? body.isvs
  if (nested?.message) return String(nested.message)
  if (body.message) return String(body.message)
  if (typeof err?.message === 'string' && err.message) return err.message
  return fallback
}

export function isBeamerNoIntegrationError(message) {
  return /no Udara360 integration/i.test(String(message || ''))
}

function buildBeamerRequestHeaders({ merchant, requestId }) {
  const headers = {}
  if (requestId) headers['Request-Id'] = requestId
  const userKey = merchant?.user_key
  const accountKey = merchant?.account_key
  if (userKey) headers['User-Key'] = String(userKey)
  if (accountKey) headers['Accout-Key'] = String(accountKey)
  return headers
}

/** ISVS link shape — client.key in data only (no Credentials header). */
export function buildBeamerLinkBody({ merchant, accountNumber, clientId, clientKey, requestId }) {
  return {
    headers: buildBeamerRequestHeaders({ merchant, requestId }),
    data: {
      account_number: accountNumber.trim(),
      client: {
        id: clientId.trim(),
        key: clientKey.trim(),
      },
    },
  }
}

/** ISVS update shape — data.id from udara360.identifier. */
export function buildBeamerUpdateBody({ merchant, udara360, accountNumber, clientId, clientKey, requestId }) {
  const u = udara360 && typeof udara360 === 'object' ? udara360 : {}
  return {
    headers: buildBeamerRequestHeaders({ merchant, requestId }),
    data: {
      id: String(u.identifier ?? u.id ?? ''),
      account_number: accountNumber.trim() || u.account_number || '',
      client: {
        id: clientId.trim() || u.client_id || '',
        key: clientKey.trim(),
      },
    },
  }
}

/**
 * After account-link: isvs_verified true → success; false → refetch merchant and check udara360.
 */
export async function resolveBeamerLinkOutcome(res, accountKey, fetchMerchant) {
  const parsed = parseBeamerResponse(res)

  if (parsed.isvsVerified === true) {
    return { ok: true, message: 'Udara account linked successfully.' }
  }

  if (parsed.isvsVerified === false) {
    const fresh = unwrapMerchantPayload(await fetchMerchant(accountKey))
    if (isUdaraLinked(fresh)) {
      return {
        ok: true,
        message: 'Udara account linked successfully (confirmed on merchant profile).',
      }
    }
    if (parsed.isvs) console.warn('[beamer] ISVS response', parsed.isvs)
    return {
      ok: false,
      message:
        parsed.isvsMessage ||
        'Link did not persist. Check account number, client id, and client key, or ISVS may have rejected the request.',
    }
  }

  if (!isIsvsDirectSuccess(parsed)) {
    if (parsed.isvs) console.warn('[beamer] ISVS response', parsed.isvs)
    const fresh = unwrapMerchantPayload(await fetchMerchant(accountKey))
    if (isUdaraLinked(fresh)) {
      return { ok: true, message: 'Udara account linked successfully (confirmed on merchant profile).' }
    }
    return {
      ok: false,
      message: parsed.isvsMessage || 'Integration request did not succeed.',
    }
  }

  const fresh = unwrapMerchantPayload(await fetchMerchant(accountKey))
  if (isUdaraLinked(fresh)) {
    return { ok: true, message: 'Udara account linked successfully.' }
  }

  return {
    ok: false,
    message:
      parsed.isvsMessage ||
      'ISVS accepted the request but Udara credentials were not saved. Verify account number, client id, and client key.',
  }
}

/**
 * After account-update: same isvs_verified rules; refetch confirms credentials still present.
 */
export async function resolveBeamerUpdateOutcome(res, accountKey, fetchMerchant) {
  const parsed = parseBeamerResponse(res)

  if (parsed.isvsVerified === true) {
    return { ok: true, message: 'Udara credentials updated successfully.' }
  }

  if (parsed.isvsVerified === false) {
    const fresh = unwrapMerchantPayload(await fetchMerchant(accountKey))
    if (isUdaraLinked(fresh)) {
      return {
        ok: true,
        message: 'Udara credentials updated successfully (confirmed on merchant profile).',
      }
    }
    if (parsed.isvs) console.warn('[beamer] ISVS response', parsed.isvs)
    return {
      ok: false,
      message: parsed.isvsMessage || 'Update did not persist. Check account number, client id, and client key.',
    }
  }

  if (!isIsvsDirectSuccess(parsed)) {
    if (parsed.isvs) console.warn('[beamer] ISVS response', parsed.isvs)
    return {
      ok: false,
      message: parsed.isvsMessage || 'Update did not succeed.',
    }
  }

  const fresh = unwrapMerchantPayload(await fetchMerchant(accountKey))
  if (!isUdaraLinked(fresh)) {
    return {
      ok: false,
      message: parsed.isvsMessage || 'Update did not persist on the merchant record.',
    }
  }

  return { ok: true, message: 'Udara credentials updated successfully.' }
}
