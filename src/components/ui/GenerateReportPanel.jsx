import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, XCircle, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

/** Dashboard shortcuts → catalog ids on /reports */
const REPORT_TYPES = [
  {
    value: 'transactions',
    label: 'Unified transactions',
    desc: 'Transfers, deposits, and related activity.',
  },
  {
    value: 'settlements',
    label: 'Settlements',
    desc: 'Settlement batches and summary totals.',
  },
  {
    value: 'customer-balances',
    label: 'Customer wallet balances',
    desc: 'Wallet balance snapshot by customer.',
  },
  {
    value: 'revenue',
    label: 'Revenue by merchant',
    desc: 'Fee revenue grouped by merchant.',
  },
  {
    value: 'growth-customers',
    label: 'Customer growth export',
    desc: 'All or active customers (requires console.read for CSV).',
  },
  {
    value: 'transaction-anomalies',
    label: 'Transaction anomalies',
    desc: 'Ticket-linked duplicates, broad duplicates, high-ticket activity.',
  },
]

function CustomDropdown({ label, placeholder, options, value, onChange, hasDesc }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <label className="px-1 text-sm text-text-secondary">
        {label} <span className="text-accent">*</span>
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className={`flex w-full items-center justify-between rounded-2xl border bg-card px-4 py-3.5 text-sm outline-none transition-colors ${
            open ? 'border-accent/50 ring-1 ring-accent/20' : 'border-border'
          }`}
        >
          <span className={selected ? 'text-text-primary' : 'text-text-muted'}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            size={18}
            className={`text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1.5 max-h-[320px] overflow-y-auto rounded-2xl border border-border bg-page shadow-xl shadow-black/30">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl ${
                  value === opt.value ? 'bg-card-hover' : 'hover:bg-card-hover/60'
                }`}
              >
                <span className="text-sm font-medium text-text-primary">{opt.label}</span>
                {hasDesc && opt.desc ? (
                  <span className="text-xs text-text-muted">{opt.desc}</span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function GenerateReportPanel({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [reportType, setReportType] = useState('')
  const panelRef = useRef(null)

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) setReportType('')
  }, [isOpen])

  function handleSubmit(e) {
    e.preventDefault()
    if (!reportType) return
    onClose()
    navigate(`/reports?report=${encodeURIComponent(reportType)}`)
  }

  return (
    <div
      className={cn(
        'drawer-overlay transition-all duration-300',
        isOpen ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={cn(
          'drawer-panel transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-md p-1 text-text-muted transition-colors hover:bg-card-hover hover:text-text-secondary"
            aria-label="Close"
          >
            <XCircle size={20} />
          </button>
          <div className="flex items-center gap-4 pr-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-page">
              <BookOpen size={20} className="text-info" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-text-primary">Reports</h2>
              <p className="text-xs text-text-muted">
                Open the Reports page to preview JSON or download CSV from the API.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <CustomDropdown
              label="Report"
              placeholder="Select report"
              options={REPORT_TYPES}
              value={reportType}
              onChange={setReportType}
              hasDesc
            />
          </div>

          <div className="flex shrink-0 gap-3 border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-accent py-2.5 text-sm font-medium text-accent transition-all hover:bg-accent/10 active:scale-[0.97]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reportType}
              className="flex-1 rounded-full bg-accent py-2.5 text-sm font-medium text-page transition-all hover:opacity-90 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
            >
              Open Reports
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
