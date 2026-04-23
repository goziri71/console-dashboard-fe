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
  { key: 'actions', label: '', width: 'w-[56px]' },
]

export default function MerchantCustomersTable({ customers }) {
  const navigate = useNavigate()
  const { accountKey } = useParams()

  if (!customers || customers.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-text-muted">
        No customers found
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-border/70">
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
              return (
                <tr
                  key={c.id ?? id ?? idx}
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
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="rounded-md p-1 text-text-muted transition-colors hover:bg-card-hover hover:text-text-secondary active:scale-90"
                    >
                      <MoreVertical size={16} />
                    </button>
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
