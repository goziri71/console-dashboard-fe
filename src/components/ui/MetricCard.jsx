import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '../../lib/utils'

const iconColorMap = {
  success: 'bg-success-bg text-success',
  error: 'bg-error-bg text-error',
  warning: 'bg-warning-bg text-warning',
  info: 'bg-info-bg text-info',
  accent: 'bg-accent-bg text-accent',
}

export default function MetricCard({ label, value, comparison, iconColor = 'accent', icon: Icon }) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 transition-all duration-200 hover:border-border/80 hover:bg-card-hover hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5">
      <div className="flex items-center gap-2">
        {Icon && (
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', iconColorMap[iconColor])}>
            <Icon size={16} />
          </div>
        )}
        <span className="text-sm text-text-secondary">{label}</span>
      </div>

      <span className="text-2xl font-semibold text-text-primary">{value}</span>

      {comparison && (
        <div className="flex items-center gap-1.5">
          {comparison.direction === 'up' ? (
            <TrendingUp size={14} className="text-success" />
          ) : (
            <TrendingDown size={14} className="text-error" />
          )}
          <span className={cn('text-xs font-medium', comparison.direction === 'up' ? 'text-success' : 'text-error')}>
            {comparison.value}%
          </span>
          <span className="text-xs text-text-muted">{comparison.label}</span>
        </div>
      )}
    </div>
  )
}
