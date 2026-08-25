import axios from 'axios'
import {
  deriveHttpStatusFromApiCode,
  isConsoleEnvelope,
  isEnvelopeSuccessful,
  isSuccessEnvelope,
  isSuccessfulApiCode,
} from '../lib/apiEnvelope'
import {
  clearStoredAuth,
  getAuthToken,
  setAuthNotice,
} from '../lib/authStorage'
import { requestMfaStepUp } from '../lib/mfaStepUp'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? 'https://api.console.sterllo.com/1.202602.0'
    : 'http://localhost:5000/1.202602.0')

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

function requestHadAuthentication(config) {
  return Boolean(config?.headers?.Authorization)
}

function expireAuthenticatedSession(config) {
  if (!requestHadAuthentication(config)) return
  clearStoredAuth()
  setAuthNotice('Your session expired or was replaced by a login on another device.')
  if (window.location.pathname !== '/login') {
    window.location.replace('/login')
  }
}

function isBeamerIntegrationUrl(config) {
  const url = String(config?.url || '')
  return url.includes('/integrations/beamer/')
}

function isKycEnableStatusPassthroughUrl(config) {
  const url = String(config?.url || '')
  return url.includes('/kyc/sub-account-enable-status')
}

/** Sterllo Verify Deposit proxy — body/status passed through unchanged. */
function isDepositWebhookReplayUrl(config) {
  const url = String(config?.url || '')
  return url.includes('/transactions/deposits/webhook-replay')
}

function requiresRecentMfa(error) {
  const body = error.response?.data
  return (
    error.response?.status === 403 &&
    (body?.data?.code === 'recent_mfa_required' || body?.code === 'recent_mfa_required')
  )
}

function isPricingWrite(config) {
  const method = String(config?.method || 'get').toLowerCase()
  const url = String(config?.url || '')
  return (
    method !== 'get' &&
    (url.includes('/fees/defaults/') ||
      (url.includes('/merchants/') && url.includes('/fees/')))
  )
}

api.interceptors.response.use(
  (response) => {
    const body = response.data

    if (isKycEnableStatusPassthroughUrl(response.config)) {
      response.data = body
      return response
    }

    if (isDepositWebhookReplayUrl(response.config)) {
      response.data = body
      return response
    }

    // Crosslink uses `{ status: true, code: 200, data: { authToken, ... } }`.
    if (isSuccessEnvelope(body)) {
      if (!isEnvelopeSuccessful(body) || !isSuccessfulApiCode(body.code)) {
        const status =
          typeof body.code === 'number' && body.code >= 400 && body.code < 600
            ? body.code
            : deriveHttpStatusFromApiCode(body.code)
        if (status === 401) expireAuthenticatedSession(response.config)
        const axiosResponse = {
          data: body,
          status,
          statusText: body.message || 'Error',
          headers: response.headers,
          config: response.config,
        }
        const err = new axios.AxiosError(
          body.message || 'Request failed',
          axios.AxiosError.ERR_BAD_RESPONSE,
          response.config,
          response.request,
          axiosResponse
        )
        return Promise.reject(err)
      }
      response.data = body.data
      return response
    }

    if (!isConsoleEnvelope(body)) {
      return response
    }

    if (isBeamerIntegrationUrl(response.config)) {
      if (body.state !== true) {
        const status = deriveHttpStatusFromApiCode(body.code)
        const axiosResponse = {
          data: body,
          status,
          statusText: body.message || 'Error',
          headers: response.headers,
          config: response.config,
        }
        const err = new axios.AxiosError(
          body.message || 'Request failed',
          axios.AxiosError.ERR_BAD_RESPONSE,
          response.config,
          response.request,
          axiosResponse
        )
        return Promise.reject(err)
      }
      response.data = body
      return response
    }

    if (body.state !== true) {
      const status = deriveHttpStatusFromApiCode(body.code)
      if (status === 401) expireAuthenticatedSession(response.config)
      const axiosResponse = {
        data: body,
        status,
        statusText: body.message || 'Error',
        headers: response.headers,
        config: response.config,
      }
      const err = new axios.AxiosError(
        body.message || 'Request failed',
        axios.AxiosError.ERR_BAD_RESPONSE,
        response.config,
        response.request,
        axiosResponse
      )
      return Promise.reject(err)
    }

    if (!isSuccessfulApiCode(body.code)) {
      const status = deriveHttpStatusFromApiCode(body.code)
      const axiosResponse = {
        data: body,
        status,
        statusText: body.message || 'Error',
        headers: response.headers,
        config: response.config,
      }
      const err = new axios.AxiosError(
        body.message || 'Request failed',
        axios.AxiosError.ERR_BAD_RESPONSE,
        response.config,
        response.request,
        axiosResponse
      )
      return Promise.reject(err)
    }

    response.data = body.data
    return response
  },
  (error) => {
    const config = error.config

    if (error.response?.status === 401) {
      expireAuthenticatedSession(config)
    }
    const data = error.response?.data
    if (isConsoleEnvelope(data) && data.state !== true && error.response) {
      error.response.status = deriveHttpStatusFromApiCode(data.code)
    }
    return Promise.reject(error)
  }
)

api.interceptors.response.use(undefined, async (error) => {
  const config = error.config
  if (
    requiresRecentMfa(error) &&
    isPricingWrite(config) &&
    !config?._mfaRetry
  ) {
    await requestMfaStepUp()
    config._mfaRetry = true
    return api(config)
  }
  return Promise.reject(error)
})

export default api
