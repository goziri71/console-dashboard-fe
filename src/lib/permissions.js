/** Mirrors backend RBAC keys; see financial-access guide. */
export const PERMISSION_ALL = '*'
export const PERMISSION_FINANCIAL_READ = 'financial.read'
export const PERMISSION_RBAC_MANAGE = 'rbac.manage'

/** Seeded management role: server rejects PATCH …/roles/:id/permissions for this slug only. */
export const ROLE_SLUG_MANAGEMENT = 'management'

export function isManagementRoleSlug(slug) {
  if (slug == null || typeof slug !== 'string') return false
  return slug.trim().toLowerCase() === ROLE_SLUG_MANAGEMENT
}

export function hasFullAccess(permissions) {
  return Array.isArray(permissions) && permissions.includes(PERMISSION_ALL)
}

export function canReadFinancial(permissions) {
  if (!permissions?.length) return false
  return hasFullAccess(permissions) || permissions.includes(PERMISSION_FINANCIAL_READ)
}

export function canManageRbac(permissions) {
  if (!permissions?.length) return false
  return hasFullAccess(permissions) || permissions.includes(PERMISSION_RBAC_MANAGE)
}
