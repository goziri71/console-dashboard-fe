import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, totalPages, total, label = 'items', onPageChange }) {
  if (totalPages <= 0) return null

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3">
      <span className="text-xs text-text-muted">
        Showing {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} of {total} {label}
      </span>
      <div className="flex items-center gap-2">
        <button
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
