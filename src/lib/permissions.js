/** Mirrors backend RBAC keys; see financial-access guide. */
export const PERMISSION_ALL = '*'
export const PERMISSION_FINANCIAL_READ = 'financial.read'
export const PERMISSION_RBAC_MANAGE = 'rbac.manage'
/** Tier upgrade — PATCH /customers/:identifier/tier */
export const PERMISSION_CUSTOMER_UPDATE = 'customer.update'
/** Merchant profile / integrations — PATCH /merchants/:account_key, Beamer link & update */
export const PERMISSION_MERCHANT_UPDATE = 'merchant.update'
/** KYC document approval — PATCH /kycs/:reference, POST /customers/:identifier/kyc/approve (BUSINESS), POST /merchants/:account_key/kyc/approve */
export const PERMISSION_KYC_UPDATE = 'kyc.update'
/** Pending transaction review — POST /transactions/review/.../approve|cancel */
export const PERMISSION_DISPUTE_UPDATE = 'dispute.update'
export const PERMISSION_PRICING_READ = 'pricing.read'
export const PERMISSION_PRICING_MANAGE = 'pricing.manage'

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

export function canReadPricing(permissions) {
  if (!permissions?.length) return false
  return hasFullAccess(permissions) || permissions.includes(PERMISSION_PRICING_READ)
}

export function canManagePricing(permissions) {
  if (!permissions?.length) return false
  return hasFullAccess(permissions) || permissions.includes(PERMISSION_PRICING_MANAGE)
}

export function canUpdateCustomerRecord(permissions) {
  if (!permissions?.length) return false
  return hasFullAccess(permissions) || permissions.includes(PERMISSION_CUSTOMER_UPDATE)
}

/** Roles that typically approve KYC in the console (when RBAC key not assigned yet). */
export const KYC_APPROVER_ROLES = ['operations', 'compliance']

export const DISPUTE_REVIEW_ROLES = ['operations', 'compliance']

export const MERCHANT_MUTATION_ROLES = ['operations', 'compliance']

export function canUpdateMerchant(permissions, role) {
  if (hasFullAccess(permissions) || permissions?.includes(PERMISSION_MERCHANT_UPDATE)) return true
  const r = String(role ?? '')
    .toLowerCase()
    .trim()
  return MERCHANT_MUTATION_ROLES.includes(r)
}

export function canKycUpdate(permissions, role) {
  if (hasFullAccess(permissions) || permissions?.includes(PERMISSION_KYC_UPDATE)) return true
  const r = String(role ?? '')
    .toLowerCase()
    .trim()
  return KYC_APPROVER_ROLES.includes(r)
}

export function canDisputeUpdate(permissions, role) {
  if (hasFullAccess(permissions) || permissions?.includes(PERMISSION_DISPUTE_UPDATE)) return true
  const r = String(role ?? '')
    .toLowerCase()
    .trim()
  return DISPUTE_REVIEW_ROLES.includes(r)
}

/**
 * Strip `*` from keys for non-management roles (only management may include * on the server).
 * @param {string} slug
 * @param {string[]} keys
 * @returns {string[]}
 */
export function sanitizePermissionKeysForRole(slug, keys) {
  const list = Array.isArray(keys) ? keys.map(String) : []
  if (isManagementRoleSlug(slug)) return list
  return list.filter((k) => k !== PERMISSION_ALL)
}

/**
 * Server rules for PATCH / POST role permission_keys.
 * Management must include *; every other role must not include *.
 * @param {string} slug
 * @param {string[]} keys
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateRolePermissionKeysForSave(slug, keys) {
  const list = Array.isArray(keys) ? keys.map(String) : []
  const hasStar = list.includes(PERMISSION_ALL)

  if (isManagementRoleSlug(slug)) {
    if (!hasStar) {
      return {
        ok: false,
        message:
          'The management role must include the "*" permission. The API returns 400 if "*" is missing.',
      }
    }
    return { ok: true }
  }

  if (hasStar) {
    return {
      ok: false,
      message:
        'Only the management role may include "*". Use concrete keys (e.g. console.read, financial.read, rbac.manage). Remove "*" from the list.',
    }
  }

  return { ok: true }
}
