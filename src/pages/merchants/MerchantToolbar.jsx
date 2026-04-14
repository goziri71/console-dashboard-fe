import { useState, useEffect, useRef } from 'react'
import { Search, SlidersHorizontal, ArrowUpDown, Download, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

const SORT_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'date_created', label: 'Date Created' },
  { value: 'name', label: 'Name' },
  { value: 'trade_name', label: 'Trade Name' },
]

const FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'account_active', label: 'Active' },
  { value: 'account_inactive', label: 'Inactive' },
  { value: 'account_suspended', label: 'Suspended' },
  { value: 'kyc_pending', label: 'KYC Pending' },
]

function Dropdown({ trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex h-9 items-center gap-2 rounded-full border border-border bg-page px-3.5 text-xs font-medium text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary active:scale-[0.97]"
      >
        {trigger}
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={cn(
            'absolute top-full z-20 mt-1.5 min-w-[170px] overflow-hidden rounded-xl border border-border bg-page shadow-xl shadow-black/30',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {children(setOpen)}
        </div>
      )}
    </div>
  )
}

export default function MerchantToolbar({
  search,
  onSearchChange,
  sortBy,
  order,
  onSortChange,
  statusFilter,
  onStatusChange,
  onExport,
}) {
  const [localSearch, setLocalSearch] = useState(search)
  const timerRef = useRef(null)

  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  function handleSearchInput(val) {
    setLocalSearch(val)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSearchChange(val), 400)
  }

  const effectiveSort = sortBy || ''
  const currentSort = SORT_OPTIONS.find((o) => o.value === effectiveSort) || SORT_OPTIONS[0]
  const currentStatus = FILTER_OPTIONS.find((o) => o.value === statusFilter)

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
      <div className="relative min-w-0 flex-1 lg:max-w-none">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          placeholder="Search merchants..."
          value={localSearch}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="h-10 w-full rounded-xl border border-border bg-page py-2 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Dropdown trigger={<><ArrowUpDown size={14} /> Sort by: {currentSort.label}</>}>
          {(close) =>
            SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => {
                  const nextKey = opt.value
                  const same = (sortBy || '') === (nextKey || '')
                  const newOrder = same ? (order === 'asc' ? 'desc' : 'asc') : 'desc'
                  onSortChange(nextKey, newOrder)
                  close(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-card-hover ${
                  effectiveSort === opt.value ? 'text-accent' : 'text-text-secondary'
                }`}
              >
                {opt.label}
                {effectiveSort === opt.value && (
                  <span className="text-[10px] text-text-muted">{order === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            ))
          }
        </Dropdown>

        <Dropdown trigger={<><SlidersHorizontal size={14} /> Filter{currentStatus?.value ? `: ${currentStatus.label}` : ''}</>}>
          {(close) =>
            FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value || 'all'}
                type="button"
                onClick={() => {
                  onStatusChange(opt.value)
                  close(false)
                }}
                className={`flex w-full px-3 py-2 text-xs transition-colors hover:bg-card-hover ${
                  statusFilter === opt.value ? 'font-medium text-accent' : 'text-text-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))
          }
        </Dropdown>

        <button
          type="button"
          onClick={onExport}
          className="flex h-9 items-center gap-2 rounded-full border border-transparent bg-accent px-3.5 text-xs font-medium text-[#1a1c12] shadow-sm transition-colors hover:brightness-105 active:scale-[0.97]"
        >
          <Download size={14} />
          Export
          <ChevronDown size={13} className="opacity-70" />
        </button>
      </div>
    </div>
  )
}
