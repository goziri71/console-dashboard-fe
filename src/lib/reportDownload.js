import api from '../services/api'
import { cleanReportParams } from './reportsCatalog'

function filenameFromContentDisposition(header, fallback) {
  if (!header || typeof header !== 'string') return fallback
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim())
    } catch {
      return utf8[1].trim()
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1]?.trim() || fallback
}

async function blobResponseToError(blob) {
  try {
    const text = await blob.text()
    const parsed = JSON.parse(text)
    const message =
      parsed?.message ||
      parsed?.data?.message ||
      (typeof parsed?.data === 'string' ? parsed.data : null)
    return new Error(message || 'Export failed.')
  } catch {
    return new Error('Export failed.')
  }
}

/**
 * GET report with `format=csv` and trigger browser download.
 * @param {string} path
 * @param {Record<string, unknown>} params
 * @param {string} fallbackFilename
 */
export async function downloadReportCsv(path, params, fallbackFilename) {
  const response = await api.get(path, {
    params: cleanReportParams({ ...params, format: 'csv' }),
    responseType: 'blob',
  })

  const contentType = String(response.headers['content-type'] || '').toLowerCase()
  if (contentType.includes('json') || response.data?.type === 'application/json') {
    throw await blobResponseToError(response.data)
  }

  const filename = filenameFromContentDisposition(
    response.headers['content-disposition'],
    fallbackFilename
  )
  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
