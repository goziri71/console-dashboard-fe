import { useState, useEffect, useRef } from 'react'
import { BookOpen, XCircle, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

const REPORT_TYPES = [
  { value: 'transaction', label: 'Transaction Report', desc: 'Includes transfers, deposits, payouts, exchanges.' },
  { value: 'compliance', label: 'Compliance Report', desc: 'Jurisdiction-specific regulatory reports (NG, GH, SA, KE).' },
  { value: 'ledger', label: 'Ledger Report', desc: 'Detailed wallet ledger entries and balances.' },
  { value: 'settlement', label: 'Settlement Report', desc: 'Settlement statement and reconciliation data.' },
  { value: 'customer_activity', label: 'Customer Activity Report', desc: 'Customer transactions, wallet activity, and KYC status.' },
  { value: 'dispute', label: 'Dispute Report', desc: 'Open, pending, and resolved disputes.' },
]

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
]

const OUTPUT_FORMATS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' },
  { value: 'excel', label: 'Excel' },
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
                  value === opt.value
                    ? 'bg-card-hover'
                    : 'hover:bg-card-hover/60'
                }`}
              >
                <span className="text-sm font-medium text-text-primary">{opt.label}</span>
                {hasDesc && opt.desc && (
                  <span className="text-xs text-text-muted">{opt.desc}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function GenerateReportPanel({ isOpen, onClose }) {
  const [reportName, setReportName] = useState('')
  const [reportType, setReportType] = useState('')
  const [dateRange, setDateRange] = useState('')
  const [outputFormat, setOutputFormat] = useState('')
  const [submitting, setSubmitting] = useState(false)
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
    if (!isOpen) {
      setReportName('')
      setReportType('')
      setDateRange('')
      setOutputFormat('')
      setSubmitting(false)
    }
  }, [isOpen])

  const isValid = reportName.trim() && reportType && dateRange && outputFormat

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isValid || submitting) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 1200))
    setSubmitting(false)
    onClose()
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
              <h2 className="text-base font-semibold text-text-primary">Generate Report</h2>
              <p className="text-xs text-text-muted">
                Analyse platform activity, compliance, or financial operations.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="px-1 text-sm text-text-secondary">
                Report Name <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter name of report"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
              />
            </div>

            <CustomDropdown
              label="Report Type"
              placeholder="Select report type"
              options={REPORT_TYPES}
              value={reportType}
              onChange={setReportType}
              hasDesc
            />

            <CustomDropdown
              label="Date Range"
              placeholder="Select date"
              options={DATE_RANGES}
              value={dateRange}
              onChange={setDateRange}
            />

            <CustomDropdown
              label="Output Format"
              placeholder="Select document type"
              options={OUTPUT_FORMATS}
              value={outputFormat}
              onChange={setOutputFormat}
            />
            </div>
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
              disabled={!isValid || submitting}
              className="flex-1 rounded-full bg-accent py-2.5 text-sm font-medium text-page transition-all hover:opacity-90 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
            >
              {submitting ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
