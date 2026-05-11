import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MoreVertical } from 'lucide-react'
import { formatDate, cn } from '../../lib/utils'
import {
  countryToFlagEmoji,
  customerDisplayName,
  customerTypeLabel,
  customerTierLabel,
  customerKycKey,
  customerAccountStatusKey,
  getCustomerIdentifier,
} from './merchantCustomerUi'

const kycBadge = {
  verified: { label: 'Verified', cls: 'bg-success-bg text-success' },
  pending: { label: 'Pending', cls: 'bg-warning-bg text-warning' },
  rejected: { label: 'Rejected', cls: 'bg-error-bg text-error' },
  none: { label: 'None', cls: 'bg-card-hover text-text-muted' },
}

const statusBadge = {
  active: { label: 'Active', cls: 'bg-success-bg text-success' },
  inactive: { label: 'Inactive', cls: 'bg-card-hover text-text-muted' },
  suspended: { label: 'Suspended', cls: 'bg-error-bg text-error' },
}

function Badge({ config, value }) {
  const badge = config[value] || { label: value, cls: 'bg-card-hover text-text-muted' }
  return (
    <span className={cn('inline-flex items-center justify-center rounded-full px-3 py-0.5 text-[11px] font-medium', badge.cls)}>
      {badge.label}
    </span>
  )
}

const COLUMNS = [
  { key: 'flag', label: '', width: 'w-[52px]' },
  { key: 'name', label: 'Name', width: 'min-w-[200px]' },
  { key: 'type', label: 'Type', width: 'w-[100px]' },
  { key: 'tier', label: 'Tier Level', width: 'w-[92px]' },
  { key: 'kyc', label: 'KYC Status', width: 'w-[120px]' },
  { key: 'status', label: 'Account Status', width: 'w-[140px]' },
  { key: 'last', label: 'Last Activity', width: 'min-w-[170px]' },
  { key: 'actions', label: 'Action', width: 'w-[96px]' },
]

export default function MerchantCustomersTable({
  customers,
  onViewKyc,
  onFreezeAccount,
  onUpgradeAccount,
}) {
  const navigate = useNavigate()
  const { accountKey } = useParams()
  const [openMenuKey, setOpenMenuKey] = useState(null)

  useEffect(() => {
    if (!openMenuKey) return
    const onDocMouseDown = (e) => {
      const wrap = e.target.closest?.('[data-customer-action-wrap]')
      const key = wrap?.getAttribute?.('data-menu-key')
      if (key === openMenuKey) return
      setOpenMenuKey(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [openMenuKey])

  if (!customers || customers.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-text-muted">
        No customers found
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="overflow-x-auto rounded-2xl border border-border/70">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-card-hover/40">
              {COLUMNS.map((col) => (
                <th key={col.key} className={cn('px-4 py-3 text-xs font-medium text-text-muted', col.width)}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c, idx) => {
              const kyc = customerKycKey(c)
              const acct = customerAccountStatusKey(c)
              const flag = countryToFlagEmoji(c.country_code ?? c.country)
              const id = getCustomerIdentifier(c)
              const rowKey = String(c.id ?? id ?? idx)
              const menuOpen = openMenuKey === rowKey
              return (
                <tr
                  key={rowKey}
                  className={cn(
                    'border-b border-border/40 transition-colors',
                    id && 'cursor-pointer hover:bg-card-hover/30'
                  )}
                  onClick={() => {
                    if (!id) return
                    navigate(`/merchants/${accountKey}/customers/${encodeURIComponent(String(id))}`)
                  }}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-card-hover text-base leading-none">
                      {flag ? (
                        <span title={c.country_code || ''} aria-hidden>
                          {flag}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-text-muted">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-text-primary">{customerDisplayName(c)}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{customerTypeLabel(c)}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{customerTierLabel(c)}</td>
                  <td className="px-4 py-2.5">
                    <Badge config={kycBadge} value={kyc} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge config={statusBadge} value={acct} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">
                    {formatDate(c.date_modified || c.date_created)}
                  </td>
                  <td className="relative z-10 px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div
                      className="relative inline-flex"
                      data-customer-action-wrap
                      data-menu-key={rowKey}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuKey((k) => (k === rowKey ? null : rowKey))
                        }}
                        className="rounded-md p-1 text-text-muted transition-colors hover:bg-card-hover hover:text-text-secondary active:scale-90"
                        aria-expanded={menuOpen}
                        aria-haspopup="menu"
                        aria-label="Row actions"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuOpen ? (
                        <div
                          className="absolute right-0 top-full z-50 mt-1 min-w-[210px] overflow-hidden rounded-lg border border-border bg-card py-1 text-left shadow-lg"
                          role="menu"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-card-hover"
                            onClick={() => {
                              setOpenMenuKey(null)
                              if (typeof onViewKyc === 'function') onViewKyc(c)
                            }}
                          >
                            View KYC
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-card-hover"
                            onClick={() => {
                              setOpenMenuKey(null)
                              if (typeof onFreezeAccount === 'function') onFreezeAccount(c)
                            }}
                          >
                            Freeze Account
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-card-hover"
                            onClick={() => {
                              setOpenMenuKey(null)
                              if (typeof onUpgradeAccount === 'function') onUpgradeAccount(c)
                            }}
                          >
                            Upgrade Account
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
