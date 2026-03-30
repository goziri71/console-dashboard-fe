import axios from 'axios'
import {
  API_SUCCESS_CODE,
  deriveHttpStatusFromApiCode,
  isConsoleEnvelope,
} from '../lib/apiEnvelope'

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
  const token = localStorage.getItem('sterllo_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    const body = response.data

    if (!isConsoleEnvelope(body)) {
      return response
    }

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

    const codeNum = Number(body.code)
    const hasExplicitCode =
      body.code !== undefined && body.code !== null && body.code !== '' && Number.isFinite(codeNum)
    if (hasExplicitCode && codeNum !== API_SUCCESS_CODE) {
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
    if (error.response?.status === 401) {
      localStorage.removeItem('sterllo_token')
      localStorage.removeItem('sterllo_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    const data = error.response?.data
    if (isConsoleEnvelope(data) && data.state !== true && error.response) {
      error.response.status = deriveHttpStatusFromApiCode(data.code)
    }
    return Promise.reject(error)
  }
)

export default api
