/** Mirrors backend RBAC keys; see financial-access guide. */
export const PERMISSION_ALL = '*'
export const PERMISSION_FINANCIAL_READ = 'financial.read'
export const PERMISSION_RBAC_MANAGE = 'rbac.manage'

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
