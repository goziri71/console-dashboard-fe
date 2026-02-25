import { useState, useEffect, useRef } from 'react'
import { Search, SlidersHorizontal, ArrowUpDown, Download, ChevronDown } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'date_created', label: 'Date Created' },
  { value: 'name',         label: 'Name' },
  { value: 'trade_name',   label: 'Trade Name' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
]

function Dropdown({ trigger, children }) {
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
        <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[170px] overflow-hidden rounded-xl border border-border bg-page shadow-xl shadow-black/30">
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

  const currentSort   = SORT_OPTIONS.find((o) => o.value === sortBy)
  const currentStatus = STATUS_OPTIONS.find((o) => o.value === statusFilter)

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Search..."
          value={localSearch}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="h-9 w-[300px] rounded-xl border border-border bg-page py-2 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
        />
      </div>

      <Dropdown trigger={<><ArrowUpDown size={14} /> Sort by: {currentSort?.label || 'All'}</>}>
        {(close) =>
          SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                const newOrder = sortBy === opt.value && order === 'asc' ? 'desc' : 'asc'
                onSortChange(opt.value, newOrder)
                close(false)
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-card-hover ${
                sortBy === opt.value ? 'text-accent' : 'text-text-secondary'
              }`}
            >
              {opt.label}
              {sortBy === opt.value && (
                <span className="text-[10px] text-text-muted">{order === 'asc' ? '↑' : '↓'}</span>
              )}
            </button>
          ))
        }
      </Dropdown>

      <Dropdown trigger={<><SlidersHorizontal size={14} /> Filter{currentStatus?.value ? `: ${currentStatus.label}` : ''}</>}>
        {(close) =>
          STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onStatusChange(opt.value); close(false) }}
              className={`flex w-full px-3 py-2 text-xs transition-colors hover:bg-card-hover ${
                statusFilter === opt.value ? 'text-accent font-medium' : 'text-text-secondary'
              }`}
            >
              {opt.label}
            </button>
          ))
        }
      </Dropdown>

      <button
        onClick={onExport}
        className="flex h-9 items-center gap-2 rounded-full border border-border bg-page px-3.5 text-xs font-medium text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary active:scale-[0.97]"
      >
        <Download size={14} />
        Export
        <ChevronDown size={13} />
      </button>
    </div>
  )
}
