import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Link2, ExternalLink } from 'lucide-react'
import { formatDate, cn } from '../../lib/utils'
import {
  typeLabel,
  normalizeKycKey,
  normalizeAccountStatusKey,
  tierLabel,
} from './merchantUi'

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

const udaraLinkBadge = {
  linked: { label: 'Linked', cls: 'bg-success-bg text-success' },
  unlinked: { label: 'Not linked', cls: 'bg-warning-bg text-warning' },
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
  { key: 'index', label: '#', width: 'w-[52px]' },
  { key: 'name', label: 'Name', width: 'min-w-[200px]' },
  { key: 'type', label: 'Type', width: 'w-[100px]' },
  { key: 'tier', label: 'Tier Level', width: 'w-[92px]' },
  { key: 'kyc', label: 'KYC Status', width: 'w-[120px]' },
  { key: 'status', label: 'Account Status', width: 'w-[140px]' },
  { key: 'udara', label: 'Udara', width: 'w-[108px]' },
  { key: 'last', label: 'Last Activity', width: 'min-w-[170px]' },
  { key: 'actions', label: '', width: 'w-[56px]' },
]

export default function MerchantTable({ merchants, page = 1, limit = 20, onLinkUdara }) {
  const navigate = useNavigate()
  const [openMenuKey, setOpenMenuKey] = useState(null)

  useEffect(() => {
    if (!openMenuKey) return
    const onDocMouseDown = (e) => {
      const wrap = e.target.closest?.('[data-merchant-action-wrap]')
      const key = wrap?.getAttribute?.('data-menu-key')
      if (key === openMenuKey) return
      setOpenMenuKey(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [openMenuKey])

  const rowOffset = (page - 1) * limit
  if (!merchants || merchants.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-text-muted">
        No merchants found
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
            {merchants.map((merchant, idx) => {
              const kyc = normalizeKycKey(merchant)
              const acct = normalizeAccountStatusKey(merchant)
              const rowNum = rowOffset + idx + 1
              const rowKey = merchant.account_key || String(merchant.id ?? idx)
              const menuOpen = openMenuKey === rowKey
              const canLinkUdara = typeof onLinkUdara === 'function' && merchant.udara360 == null
              const udaraLinkKey = merchant.udara360 != null ? 'linked' : 'unlinked'
              return (
                <tr
                  key={rowKey}
                  className="cursor-pointer border-b border-border/40 transition-colors hover:bg-card-hover/30"
                  onClick={() => navigate(`/merchants/${merchant.account_key}`)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-card-hover px-1.5 text-[11px] font-medium tabular-nums leading-none text-text-muted">
                      {rowNum}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-text-primary">{merchant.name || '--'}</span>
                    {merchant.trade_name && (
                      <span className="mt-0.5 block text-[11px] text-text-muted">{merchant.trade_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{typeLabel(merchant)}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{tierLabel(merchant)}</td>
                  <td className="px-4 py-2.5">
                    <Badge config={kycBadge} value={kyc} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge config={statusBadge} value={acct} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge config={udaraLinkBadge} value={udaraLinkKey} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">
                    {formatDate(merchant.date_modified || merchant.date_created)}
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div
                      className="relative inline-flex"
                      data-merchant-action-wrap
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
                          className="absolute right-0 top-full z-[100] mt-1 min-w-[200px] overflow-hidden rounded-lg border border-border bg-card py-1 text-left shadow-lg"
                          role="menu"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-card-hover"
                            onClick={() => {
                              setOpenMenuKey(null)
                              navigate(`/merchants/${merchant.account_key}`)
                            }}
                          >
                            <ExternalLink size={14} className="shrink-0 text-text-muted" />
                            Open merchant
                          </button>
                          {canLinkUdara ? (
                            <button
                              type="button"
                              role="menuitem"
                              className="group flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-text-primary transition-colors duration-150 hover:bg-accent/15 hover:text-accent"
                              onClick={() => {
                                setOpenMenuKey(null)
                                onLinkUdara(merchant)
                              }}
                            >
                              <Link2
                                size={14}
                                className="shrink-0 text-accent transition-colors duration-150 group-hover:text-accent"
                              />
                              Link to Udara
                            </button>
                          ) : null}
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
