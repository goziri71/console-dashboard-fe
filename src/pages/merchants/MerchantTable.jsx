import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Link2, ExternalLink, TrendingUp } from 'lucide-react'
import { formatDate, cn } from '../../lib/utils'
import {
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
  { key: 'name', label: 'Name', width: 'min-w-[140px] sm:min-w-[200px]' },
  { key: 'tier', label: 'Tier Level', width: 'w-[92px]', hide: 'hidden lg:table-cell' },
  { key: 'kyc', label: 'KYC Status', width: 'w-[120px]' },
  { key: 'status', label: 'Account Status', width: 'w-[140px]', hide: 'hidden lg:table-cell' },
  { key: 'udara', label: 'Udara', width: 'w-[108px]', hide: 'hidden lg:table-cell' },
  { key: 'last', label: 'Last Activity', width: 'min-w-[170px]', hide: 'hidden lg:table-cell' },
  { key: 'actions', label: '', width: 'w-[56px]' },
]

export default function MerchantTable({ merchants, page = 1, limit = 20, onLinkUdara, onUpgradeMerchant }) {
  const navigate = useNavigate()
  const [openMenuKey, setOpenMenuKey] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!openMenuKey) return
    const onDocMouseDown = (e) => {
      const wrap = e.target.closest?.('[data-merchant-action-wrap]')
      const key = wrap?.getAttribute?.('data-menu-key')
      if (key === openMenuKey) return
      setOpenMenuKey(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    const closeMenu = () => setOpenMenuKey(null)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [openMenuKey])

  const rowOffset = (page - 1) * limit
  if (!merchants || merchants.length === 0) {
    return (
      <div className="flex justify-center items-center py-16 text-sm text-text-muted">
        No merchants found
      </div>
    )
  }

  return (
    <div className="p-2 sm:p-4">
      <div className="table-scroll rounded-2xl border border-border/70">
        <table className="w-full min-w-[580px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-card-hover/40">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cn('whitespace-nowrap px-2 py-3 text-xs font-medium text-text-muted sm:px-4', col.width, col.hide)}
                >
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
              const canUpgradeTier = typeof onUpgradeMerchant === 'function'
              const currentTier = Number(merchant?.default_kyc_tier ?? 1)
              const atMaxTier = Number.isFinite(currentTier) && currentTier >= 3
              const udaraLinkKey = merchant.udara360 != null ? 'linked' : 'unlinked'
              return (
                <tr
                  key={rowKey}
                  className="border-b transition-colors cursor-pointer border-border/40 hover:bg-card-hover/30"
                  onClick={() => navigate(`/merchants/${merchant.account_key}`)}
                >
                  <td className="px-2 py-2.5 sm:px-4">
                    <div className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-card-hover px-1.5 text-[11px] font-medium tabular-nums leading-none text-text-muted">
                      {rowNum}
                    </div>
                  </td>
                  <td className="px-2 py-2.5 sm:px-4">
                    <span className="font-medium text-text-primary">{merchant.name || '--'}</span>
                    {merchant.trade_name && (
                      <span className="mt-0.5 block text-[11px] text-text-muted">{merchant.trade_name}</span>
                    )}
                  </td>
                  <td className="hidden px-2 py-2.5 text-text-secondary lg:table-cell sm:px-4">{tierLabel(merchant)}</td>
                  <td className="px-2 py-2.5 sm:px-4">
                    <Badge config={kycBadge} value={kyc} />
                  </td>
                  <td className="hidden px-2 py-2.5 lg:table-cell sm:px-4">
                    <Badge config={statusBadge} value={acct} />
                  </td>
                  <td className="hidden px-2 py-2.5 lg:table-cell sm:px-4">
                    <Badge config={udaraLinkBadge} value={udaraLinkKey} />
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-2.5 text-xs text-text-secondary lg:table-cell sm:px-4">
                    {formatDate(merchant.date_modified || merchant.date_created)}
                  </td>
                  <td className="px-2 py-2.5 text-right sm:px-4" onClick={(e) => e.stopPropagation()}>
                    <div
                      className="inline-flex relative"
                      data-merchant-action-wrap
                      data-menu-key={rowKey}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          const rect = e.currentTarget.getBoundingClientRect()
                          const menuWidth = 200
                          const menuHeight = 132
                          const roomBelow = window.innerHeight - rect.bottom
                          setMenuPosition({
                            top:
                              roomBelow >= menuHeight
                                ? rect.bottom + 4
                                : Math.max(8, rect.top - menuHeight - 4),
                            left: Math.min(
                              window.innerWidth - menuWidth - 8,
                              Math.max(8, rect.right - menuWidth)
                            ),
                          })
                          setOpenMenuKey((k) => (k === rowKey ? null : rowKey))
                        }}
                        className="p-1 rounded-md transition-colors text-text-muted hover:bg-card-hover hover:text-text-secondary active:scale-90"
                        aria-expanded={menuOpen}
                        aria-haspopup="menu"
                        aria-label="Row actions"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuOpen && typeof document !== 'undefined' ? createPortal(
                        <div
                          className="fixed z-[100] min-w-[200px] overflow-hidden rounded-lg border border-border bg-card py-1 text-left shadow-lg"
                          role="menu"
                          data-merchant-action-wrap
                          data-menu-key={rowKey}
                          style={{ top: menuPosition.top, left: menuPosition.left }}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            className="flex gap-2 items-center px-3 py-2 w-full text-xs text-left transition-colors text-text-primary hover:bg-card-hover"
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
                              className="flex gap-2 items-center px-3 py-2 w-full text-xs text-left rounded-md transition-colors duration-150 cursor-pointer group text-text-primary hover:bg-accent/15 hover:text-accent"
                              onClick={() => {
                                setOpenMenuKey(null)
                                onLinkUdara(merchant)
                              }}
                            >
                              <Link2
                                size={14}
                                className="transition-colors duration-150 shrink-0 text-accent group-hover:text-accent"
                              />
                              Link to Udara
                            </button>
                          ) : null}
                          {canUpgradeTier ? (
                            <button
                              type="button"
                              role="menuitem"
                              disabled={atMaxTier}
                              title={atMaxTier ? 'Merchant is already at Tier 3' : undefined}
                              className="flex gap-2 items-center px-3 py-2 w-full text-xs text-left rounded-md transition-colors duration-150 cursor-pointer group text-text-primary hover:bg-accent/15 hover:text-accent disabled:pointer-events-none disabled:opacity-40"
                              onClick={() => {
                                if (atMaxTier) return
                                setOpenMenuKey(null)
                                onUpgradeMerchant(merchant)
                              }}
                            >
                              <TrendingUp size={14} className="shrink-0 text-accent" />
                              Upgrade account
                            </button>
                          ) : null}
                        </div>,
                        document.body
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
