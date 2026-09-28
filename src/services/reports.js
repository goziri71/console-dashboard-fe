import api from './api'
import { cleanReportParams } from '../lib/reportsCatalog'

/**
 * @param {string} path — e.g. `/reports/settlements`
 * @param {Record<string, unknown>} params
 */
export async function fetchReportJson(path, params) {
  const { data } = await api.get(path, {
    params: cleanReportParams({ ...params, format: 'json' }),
  })
  return data
}
