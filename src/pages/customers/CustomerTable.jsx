import { Building2, MoreVertical } from 'lucide-react'
import { formatDate, cn } from '../../lib/utils'

// KYC status badge derived from customer_count
const kycBadge = {
  verified: { label: 'Verified',  cls: 'bg-success-bg text-success' },
  pending:  { label: 'Pending',   cls: 'bg-warning-bg text-warning' },
  none:     { label: 'None',      cls: 'bg-card-hover text-text-muted' },
}

// Merchants are always Active in this API (no status field)
const statusBadge = {
  active:   { label: 'Active',   cls: 'bg-success-bg text-success' },
}

// Risk derived from settlement_count + customer_count
const riskBadge = {
  low:    { label: 'Low',    cls: 'bg-[#1a3a2a] text-[#4ade80]' },
  medium: { label: 'Medium', cls: 'bg-warning-bg text-warning' },
  high:   { label: 'High',   cls: 'bg-error-bg text-error' },
}

function Badge({ config, value }) {
  const badge = config[value] || { label: value, cls: 'bg-card-hover text-text-muted' }
  return (
    <span className={cn('inline-flex items-center justify-center rounded-full px-3 py-0.5 text-[11px] font-medium', badge.cls)}>
      {badge.label}
    </span>
  )
}

function deriveMerchantKyc(m) {
  if (m.customer_count > 10) return 'verified'
  if (m.customer_count > 0)  return 'pending'
  return 'none'
}

function deriveMerchantRisk(m) {
  if (m.settlement_count === 0 && m.customer_count === 0) return 'high'
  if (m.settlement_count === 0) return 'medium'
  return 'low'
}

const COLUMNS = [
  { key: 'flag',    label: '',               width: 'w-[52px]' },
  { key: 'name',    label: 'Name',           width: 'min-w-[200px]' },
  { key: 'type',    label: 'Type',           width: 'w-[100px]' },
  { key: 'tier',    label: 'Tier Level',     width: 'w-[92px]' },
  { key: 'kyc',     label: 'KYC Status',     width: 'w-[120px]' },
  { key: 'status',  label: 'Account Status', width: 'w-[140px]' },
  { key: 'balance', label: 'Balance',        width: 'min-w-[150px]' },
  { key: 'risk',    label: 'Risk Level',     width: 'w-[100px]' },
  { key: 'last',    label: 'Last Activity',  width: 'min-w-[170px]' },
  { key: 'actions', label: '',               width: 'w-[56px]' },
]

export default function CustomerTable({ customers: merchants }) {
  if (!merchants || merchants.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-text-muted">
        No merchants found
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={cn('px-4 py-3 text-xs font-medium text-text-muted', col.width)}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {merchants.map((m, idx) => {
            const kyc  = deriveMerchantKyc(m)
            const risk = deriveMerchantRisk(m)
            const currencies = (m.currencies || [])
            return (
              <tr
                key={m.account_key || m.id || idx}
                className="border-b border-border/50 transition-colors hover:bg-card-hover/40"
              >
                {/* Icon placeholder – merchants have no country */}
                <td className="px-4 py-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-card-hover text-text-muted">
                    <Building2 size={14} />
                  </div>
                </td>
                {/* Name */}
                <td className="px-4 py-2.5">
                  <span className="font-medium text-text-primary">
                    {m.name || '--'}
                  </span>
                  {m.trade_name && (
                    <span className="mt-0.5 block text-[11px] text-text-muted">
                      {m.trade_name}
                    </span>
                  )}
                </td>
                {/* Type – always Merchant */}
                <td className="px-4 py-2.5 text-text-secondary">
                  Merchant
                </td>
                {/* Tier */}
                <td className="px-4 py-2.5 text-text-secondary">
                  Tier {m.default_kyc_tier ?? 1}
                </td>
                {/* KYC Status – derived from customer_count */}
                <td className="px-4 py-2.5">
                  <Badge config={kycBadge} value={kyc} />
                </td>
                {/* Account Status – Active for all */}
                <td className="px-4 py-2.5">
                  <Badge config={statusBadge} value="active" />
                </td>
                {/* Balance – currencies + ledger count */}
                <td className="px-4 py-2.5 text-text-primary">
                  {currencies.length > 0
                    ? currencies.join(', ')
                    : <span className="text-text-muted">--</span>}
                  {m.ledger_count > 0 && (
                    <span className="ml-1.5 text-[11px] text-text-muted">
                      ({m.ledger_count} ledger{m.ledger_count > 1 ? 's' : ''})
                    </span>
                  )}
                </td>
                {/* Risk Level – derived */}
                <td className="px-4 py-2.5">
                  <Badge config={riskBadge} value={risk} />
                </td>
                {/* Last Activity – date_modified or date_created */}
                <td className="px-4 py-2.5 text-xs text-text-secondary">
                  {formatDate(m.date_modified || m.date_created)}
                </td>
                {/* Actions */}
                <td className="px-4 py-2.5">
                  <button className="rounded-md p-1 text-text-muted transition-colors hover:bg-card-hover hover:text-text-secondary active:scale-90">
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
