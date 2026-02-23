import { cn } from '../../lib/utils'

const typeColorMap = {
  wallet: 'bg-info-bg text-info',
  dispute: 'bg-warning-bg text-warning',
  transfer: 'bg-accent-bg text-accent',
  customer: 'bg-success-bg text-success',
  system: 'bg-success-bg text-success',
}

export default function ActivityItem({ icon: Icon, description, author, timestamp, type = 'system' }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3 transition-colors duration-150 hover:bg-card-hover/50 rounded-lg mx-1">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', typeColorMap[type] || typeColorMap.system)}>
        {Icon && <Icon size={20} />}
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm text-text-primary">{description}</span>
        <span className="text-xs text-text-muted">by {author}</span>
      </div>
      <span className="shrink-0 text-xs text-text-muted">{timestamp}</span>
    </div>
  )
}
