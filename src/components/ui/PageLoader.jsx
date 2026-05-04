import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Centered spinner + label for async page and section loads.
 * @param {string} [minHeight='min-h-[200px]'] — override with e.g. `min-h-0` for nested/fullscreen shells
 */
export default function PageLoader({
  label = 'Loading…',
  size = 28,
  minHeight = 'min-h-[200px]',
  padding = 'py-12',
  className = '',
  iconClassName = 'text-accent',
  labelClassName = 'text-sm text-text-muted',
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex w-full flex-col items-center justify-center gap-3',
        minHeight,
        padding,
        className
      )}
    >
      <Loader2 size={size} className={cn('animate-spin shrink-0', iconClassName)} aria-hidden />
      {label ? <p className={cn(labelClassName)}>{label}</p> : null}
    </div>
  )
}
