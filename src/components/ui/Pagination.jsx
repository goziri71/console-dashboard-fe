import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * @param {'default' | 'figma'} variant - Figma disputes table footer (Sterllo Wallet design)
 */
export default function Pagination({
  page,
  totalPages,
  total,
  label = 'items',
  onPageChange,
  limit = 20,
  variant = 'default',
}) {
  if (totalPages <= 0) return null

  if (variant === 'figma') {
    return (
      <div className="flex w-full flex-wrap items-center gap-6 px-4 py-2">
        <div className="min-w-0 flex-1 px-1 py-2">
          <p className="text-[12px] font-medium leading-[19.2px] tracking-[0.48px] text-[#494949]">
            Showing {limit} of {total} {label}
          </p>
        </div>
        <div className="flex w-full shrink-0 items-center justify-end gap-4 sm:w-[277px]">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-full border border-[#494949] px-4 py-2 text-[12px] leading-[14.4px] tracking-[0.12px] text-[#494949] disabled:pointer-events-none disabled:opacity-30"
          >
            Previous
          </button>
          <div className="flex items-center gap-2 text-[12px] font-medium leading-[19.2px] tracking-[0.48px] whitespace-nowrap">
            <span className="text-[#f7f7f7]">{String(page).padStart(2, '0')}</span>
            <span className="text-[#494949]">of</span>
            <span className="text-[#494949]">{totalPages}</span>
          </div>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-full border border-[#494949] px-4 py-2 text-[12px] leading-[14.4px] tracking-[0.12px] text-[#494949] disabled:pointer-events-none disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
      <span className="text-xs text-text-muted">
        Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total} {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-secondary transition-all duration-200 hover:bg-card-hover hover:text-text-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft size={14} />
          Previous
        </button>
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <span className="rounded-md border border-border bg-card-hover px-2 py-1 font-medium text-text-primary">
            {String(page).padStart(2, '0')}
          </span>
          <span>of</span>
          <span>{totalPages}</span>
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-secondary transition-all duration-200 hover:bg-card-hover hover:text-text-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
