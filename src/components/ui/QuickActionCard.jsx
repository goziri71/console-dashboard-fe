import { cn } from '../../lib/utils'

const iconBgMap = {
  success: 'bg-success-bg',
  error: 'bg-error-bg',
  warning: 'bg-warning-bg',
  info: 'bg-info-bg',
  accent: 'bg-accent-bg',
}

const stripColorMap = {
  success: 'bg-success',
  error: 'bg-error',
  warning: 'bg-warning',
  info: 'bg-info',
  accent: 'bg-accent',
}

export default function QuickActionCard({ title, description, iconColor = 'info' }) {
  return (
    <button className="flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4 text-left transition-all duration-200 hover:bg-card-hover hover:border-border/80 hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0">
      <div className={cn('flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-xl', iconBgMap[iconColor])}>
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1">
            <div className="h-[14px] w-[56px] rounded-sm bg-text-muted/20" />
            <div className="h-5 w-5 rounded bg-text-muted/15" />
          </div>
          <div className="flex flex-col gap-1">
            <div className={cn('h-[6px] w-[88px] rounded-full', stripColorMap[iconColor], 'opacity-40')} />
            <div className={cn('h-[6px] w-[88px] rounded-full', stripColorMap[iconColor], 'opacity-25')} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-primary">{title}</span>
        <span className="text-xs leading-relaxed text-text-muted">{description}</span>
      </div>
    </button>
  )
}
