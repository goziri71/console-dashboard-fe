import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { cn } from '../../lib/utils'

export default function KycApproveConfirmDialog({
  open,
  title = 'Approve KYC',
  message,
  confirmLabel = 'Approve',
  confirmClassName = 'bg-[#C5DC4B] text-black hover:brightness-105',
  loading = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-lg p-1 text-text-muted hover:bg-card-hover hover:text-text-primary disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-card-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60',
              confirmClassName
            )}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
