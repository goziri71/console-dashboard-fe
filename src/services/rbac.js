import api from './api'

function unwrapList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.records)) return data.records
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.roles)) return data.roles
  if (Array.isArray(data?.permissions)) return data.permissions
  if (Array.isArray(data?.data)) return data.data
  return []
}

/** @returns {Promise<Record<string, unknown>[]>} */
export async function listRbacPermissions() {
  const { data } = await api.get('/rbac/permissions')
  return unwrapList(data)
}

/** @returns {Promise<Record<string, unknown>[]>} */
export async function listRbacRoles() {
  const { data } = await api.get('/rbac/roles')
  return unwrapList(data)
}

/**
 * List console / team users (requires rbac.manage or *).
 *
 * @param {{ page?: number, limit?: number, search?: string, role_slug?: string }} [params]
 * @returns {Promise<{ records: Record<string, unknown>[], pagination: Record<string, unknown> }>}
 */
export async function listRbacUsers(params = {}) {
  const { page = 1, limit = 20, search, role_slug } = params
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))
  const safePage = Math.max(1, Number(page) || 1)
  const query = { page: safePage, limit: safeLimit }
  if (search && String(search).trim()) query.search = String(search).trim()
  if (role_slug && String(role_slug).trim()) query.role_slug = String(role_slug).trim()

  const { data } = await api.get('/rbac/users', { params: query })
  const records = Array.isArray(data?.records) ? data.records : []
  const pagination =
    data?.pagination != null && typeof data.pagination === 'object' ? data.pagination : {}
  return { records, pagination }
}

/**
 * @param {{ slug: string, label: string, permission_keys: string[] }} body
 */
export async function createRbacRole(body) {
  const { data } = await api.post('/rbac/roles', body)
  return data
}

/**
 * Replace role permission keys. Body must be JSON `{ permission_keys: string[] }` with
 * `Content-Type: application/json`. The management role slug is blocked on the server.
 *
 * @param {string | number} roleId
 * @param {{ permission_keys: string[] }} body
 */
export async function patchRolePermissions(roleId, body) {
  const { data } = await api.patch(
    `/rbac/roles/${encodeURIComponent(String(roleId))}/permissions`,
    body,
    { headers: { 'Content-Type': 'application/json' } }
  )
  return data
}

/**
 * @param {string} userKey
 * @param {{ role_slug: string }} body
 */
export async function assignUserRole(userKey, body) {
  const { data } = await api.post(`/rbac/users/${encodeURIComponent(userKey)}/roles`, body)
  return data
}

/**
 * @param {string} userKey
 * @param {string} roleSlug
 */
export async function revokeUserRole(userKey, roleSlug) {
  await api.delete(
    `/rbac/users/${encodeURIComponent(userKey)}/roles/${encodeURIComponent(roleSlug)}`
  )
}
