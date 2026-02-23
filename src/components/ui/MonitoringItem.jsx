import { cn } from '../../lib/utils'

const iconBgMap = {
  success: 'bg-success-bg text-success',
  error: 'bg-error-bg text-error',
  warning: 'bg-warning-bg text-warning',
  info: 'bg-info-bg text-info',
  accent: 'bg-accent-bg text-accent',
}

export default function MonitoringItem({ icon: Icon, label, count, iconColor = 'info' }) {
  return (
    <div className="flex items-center gap-4 rounded-lg px-4 py-3 transition-colors duration-150 hover:bg-card-hover/50 mx-1">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', iconBgMap[iconColor])}>
        {Icon && <Icon size={20} />}
      </div>
      <span className="flex-1 text-sm text-text-secondary">{label}</span>
      <div className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-card px-2">
        <span className="text-sm font-medium text-text-primary">
          {String(count).padStart(2, '0')}
        </span>
      </div>
    </div>
  )
}
