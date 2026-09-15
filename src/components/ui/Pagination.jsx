import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * List footer.
 * Prefer cursor mode via `hasNext` / `hasPrev` (new API — no total/total_pages).
 * Legacy `total` + `totalPages` still supported when provided.
 *
 * @param {'default' | 'figma'} variant
 */
export default function Pagination({
  page = 1,
  totalPages,
  total,
  hasNext,
  hasPrev,
  pageCount,
  label = 'items',
  onPageChange,
  limit = 20,
  variant = 'default',
}) {
  const cursorMode = typeof hasNext === 'boolean' || typeof hasPrev === 'boolean'
  const currentPage = Math.max(1, Number(page) || 1)
  const canPrev = cursorMode
    ? typeof hasPrev === 'boolean'
      ? hasPrev
      : currentPage > 1
    : currentPage > 1
  const canNext = cursorMode
    ? typeof hasNext === 'boolean'
      ? hasNext
      : false
    : Number(totalPages) > 0 && currentPage < Number(totalPages)

  if (cursorMode) {
    if (!canPrev && !canNext && currentPage <= 1) return null

    const countLabel =
      pageCount != null
        ? `Showing ${pageCount} ${label}`
        : `Page ${String(currentPage).padStart(2, '0')}`

    if (variant === 'figma') {
      return (
        <div className="flex w-full flex-wrap items-center gap-6 px-4 py-2">
          <div className="min-w-0 flex-1 px-1 py-2">
            <p className="text-[12px] font-medium leading-[19.2px] tracking-[0.48px] text-[#494949]">
              {countLabel}
            </p>
          </div>
          <div className="flex w-full shrink-0 items-center justify-end gap-4 sm:w-[277px]">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!canPrev}
              className="motion-surface rounded-full border border-[#494949] px-4 py-2 text-[12px] leading-[14.4px] tracking-[0.12px] text-[#494949] hover:border-[#717171] hover:bg-[#202020] disabled:pointer-events-none disabled:opacity-30"
            >
              Previous
            </button>
            <div className="flex items-center gap-2 text-[12px] font-medium leading-[19.2px] tracking-[0.48px] whitespace-nowrap">
              <span className="text-[#f7f7f7]">{String(currentPage).padStart(2, '0')}</span>
            </div>
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!canNext}
              className="motion-surface rounded-full border border-[#494949] px-4 py-2 text-[12px] leading-[14.4px] tracking-[0.12px] text-[#494949] hover:border-[#717171] hover:bg-[#202020] disabled:pointer-events-none disabled:opacity-30"
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
          {countLabel}
          <span className="text-text-muted/80"> · Page {String(currentPage).padStart(2, '0')}</span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canPrev}
            className="motion-surface flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-card-hover hover:text-text-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canNext}
            className="motion-surface flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-card-hover hover:text-text-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    )
  }

  if (!totalPages || totalPages <= 0) return null

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
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!canPrev}
            className="motion-surface rounded-full border border-[#494949] px-4 py-2 text-[12px] leading-[14.4px] tracking-[0.12px] text-[#494949] hover:border-[#717171] hover:bg-[#202020] disabled:pointer-events-none disabled:opacity-30"
          >
            Previous
          </button>
          <div className="flex items-center gap-2 text-[12px] font-medium leading-[19.2px] tracking-[0.48px] whitespace-nowrap">
            <span className="text-[#f7f7f7]">{String(currentPage).padStart(2, '0')}</span>
            <span className="text-[#494949]">of</span>
            <span className="text-[#494949]">{totalPages}</span>
          </div>
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!canNext}
            className="motion-surface rounded-full border border-[#494949] px-4 py-2 text-[12px] leading-[14.4px] tracking-[0.12px] text-[#494949] hover:border-[#717171] hover:bg-[#202020] disabled:pointer-events-none disabled:opacity-30"
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
        Showing {Math.min((currentPage - 1) * limit + 1, total)}–{Math.min(currentPage * limit, total)} of{' '}
        {total} {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canPrev}
          className="motion-surface flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-card-hover hover:text-text-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft size={14} />
          Previous
        </button>
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <span className="rounded-md border border-border bg-card-hover px-2 py-1 font-medium text-text-primary">
            {String(currentPage).padStart(2, '0')}
          </span>
          <span>of</span>
          <span>{totalPages}</span>
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canNext}
          className="motion-surface flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-card-hover hover:text-text-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
