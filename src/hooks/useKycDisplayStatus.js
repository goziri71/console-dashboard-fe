import { useEffect, useMemo, useState } from 'react'
import { getKycEnableStatus } from '../services/kyc'
import { normalizeKycAggregateStatus } from '../lib/kycUi'
import { mapKycEnableResponseToKey, pickEntityKycKeys } from '../lib/kycEnableStatus'

/**
 * When local KYC is none, fetches enable-status and uses that for display.
 * Otherwise keeps the profile / list value from the console API.
 */
export function useKycDisplayStatus(entity, localKycRaw) {
  const localKey = useMemo(() => normalizeKycAggregateStatus(localKycRaw), [localKycRaw])
  const { userKey, accountKey, sessionId } = useMemo(() => pickEntityKycKeys(entity), [entity])

  const [remoteKey, setRemoteKey] = useState(null)
  const [loadingRemote, setLoadingRemote] = useState(false)

  useEffect(() => {
    if (localKey !== 'none') {
      setRemoteKey(null)
      setLoadingRemote(false)
      return undefined
    }

    if (!userKey || !accountKey || !sessionId) {
      setRemoteKey(null)
      return undefined
    }

    let cancelled = false
    setLoadingRemote(true)

    getKycEnableStatus({ userKey, accountKey, sessionId })
      .then((res) => {
        if (cancelled) return
        if (res.httpStatus >= 400) return
        const mapped = mapKycEnableResponseToKey(res.body)
        if (mapped) setRemoteKey(mapped)
      })
      .catch(() => {
        if (!cancelled) setRemoteKey(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingRemote(false)
      })

    return () => {
      cancelled = true
    }
  }, [localKey, userKey, accountKey, sessionId])

  const kycKey = localKey !== 'none' ? localKey : remoteKey ?? 'none'

  return { kycKey, loadingRemote, isRemote: localKey === 'none' && remoteKey != null }
}
