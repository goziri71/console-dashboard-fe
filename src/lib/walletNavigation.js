import { getCustomer } from '../services/customers'

function unwrapApiEntity(payload) {
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

/** Normalize wallets/page API body (handles state + success envelopes). */
export function parseWalletsPageResponse(res) {
  const body = res && typeof res === 'object' ? res : {}
  const inner = unwrapApiEntity(body) ?? body
  return {
    summary: inner.summary ?? body.summary ?? {},
    records: Array.isArray(inner.records) ? inner.records : Array.isArray(body.records) ? body.records : [],
    pagination: inner.pagination ?? body.pagination ?? {},
  }
}

/** @param {Record<string, unknown> | null | undefined} row */
export function pickWalletKey(row) {
  if (!row) return ''
  const key = row.wallet_key ?? row.wallet_id
  return key != null && key !== '' ? String(key) : ''
}

/** @param {Record<string, unknown> | null | undefined} row */
export function pickOwnerType(row) {
  return String(row?.owner_type ?? '').toLowerCase()
}

/** Merchant `account_key` on a wallets/page row (when present). */
export function pickMerchantAccountKeyFromWallet(row, customerId = '') {
  if (!row || typeof row !== 'object') return ''
  const explicit =
    row.merchant_account_key ??
    row.parent_account_key ??
    row.merchant_key ??
    row.merchant_account ??
    row.merchant?.account_key ??
    ''
  if (explicit) return String(explicit)

  const accountKey = row.account_key
  if (accountKey != null && accountKey !== '' && String(accountKey) !== String(customerId)) {
    return String(accountKey)
  }
  return ''
}

/** Customer identifier for wallet rows owned by a customer. */
export function pickCustomerIdentifierFromWallet(row) {
  if (!row || typeof row !== 'object') return ''
  const ownerType = pickOwnerType(row)
  if (ownerType === 'merchant') return ''
  const id = row.owner_key ?? row.customer_identifier ?? row.identifier ?? row.customer_key
  return id != null && id !== '' ? String(id) : ''
}

/** Merchant `account_key` on a customer profile payload. */
export function pickMerchantAccountKeyFromCustomer(customer, customerId = '') {
  if (!customer || typeof customer !== 'object') return ''
  const explicit =
    customer.merchant_account_key ??
    customer.parent_account_key ??
    customer.merchant_key ??
    customer.merchant_account ??
    customer.merchant?.account_key ??
    customer.parent?.account_key ??
    ''
  if (explicit) return String(explicit)

  const accountKey = customer.account_key
  if (accountKey != null && accountKey !== '' && String(accountKey) !== String(customerId)) {
    return String(accountKey)
  }
  return ''
}

export function walletRowIsNavigable(row) {
  if (!row || typeof row !== 'object') return false
  const ownerType = pickOwnerType(row)
  if (ownerType === 'merchant') {
    return Boolean(pickMerchantAccountKeyFromWallet(row) || row.owner_key)
  }
  return Boolean(pickCustomerIdentifierFromWallet(row))
}

export function buildMerchantProfilePath(merchantAccountKey) {
  const merchant = String(merchantAccountKey ?? '').trim()
  if (!merchant) return null
  return `/merchants/${encodeURIComponent(merchant)}`
}

export function buildCustomerProfilePath(merchantAccountKey, customerIdentifier, walletKey) {
  const merchant = String(merchantAccountKey ?? '').trim()
  const customer = String(customerIdentifier ?? '').trim()
  if (!merchant || !customer) return null
  const walletQs = walletKey ? `?wallet=${encodeURIComponent(walletKey)}` : ''
  return `/merchants/${encodeURIComponent(merchant)}/customers/${encodeURIComponent(customer)}${walletQs}`
}

/**
 * Resolve navigation target for a wallets/page row (customer → profile, merchant → merchant page).
 * @returns {Promise<{ path: string, walletKey?: string } | { error: string }>}
 */
export async function resolveWalletRowNavigation(row) {
  if (!row || typeof row !== 'object') {
    return { error: 'Invalid wallet row.' }
  }

  const ownerType = pickOwnerType(row)
  const walletKey = pickWalletKey(row)

  if (ownerType === 'merchant') {
    const merchantKey = pickMerchantAccountKeyFromWallet(row) || (row.owner_key != null ? String(row.owner_key) : '')
    const path = buildMerchantProfilePath(merchantKey)
    if (!path) return { error: 'Could not determine merchant for this wallet.' }
    return { path, walletKey }
  }

  const customerId = pickCustomerIdentifierFromWallet(row)
  if (!customerId) {
    return { error: 'This wallet is not linked to a customer profile.' }
  }

  let merchantKey = pickMerchantAccountKeyFromWallet(row, customerId)

  if (!merchantKey) {
    try {
      const res = await getCustomer(customerId)
      const customer = unwrapApiEntity(res) ?? res
      merchantKey = pickMerchantAccountKeyFromCustomer(customer, customerId)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Could not load customer.'
      return { error: msg }
    }
  }

  const path = buildCustomerProfilePath(merchantKey, customerId, walletKey)
  if (!path) {
    return {
      error:
        'Could not determine which merchant this customer belongs to. Open the customer from Merchants → Customers.',
    }
  }

  return { path, walletKey, customerId, merchantKey }
}
