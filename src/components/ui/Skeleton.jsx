export function SkeletonBox({ className = '' }) {
  return <div className={`skeleton ${className}`} />
}

export function SkeletonMetricCard() {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <SkeletonBox className="h-8 w-8 !rounded-full" />
        <SkeletonBox className="h-4 w-24" />
      </div>
      <SkeletonBox className="h-7 w-20" />
      <SkeletonBox className="h-3 w-36" />
    </div>
  )
}

export function SkeletonMetricsRow() {
  return (
    <div className="grid grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonMetricCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonQuickActions() {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <SkeletonBox className="h-5 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-4 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4">
            <SkeletonBox className="h-[78px] w-[78px] !rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <SkeletonBox className="h-4 w-28" />
              <SkeletonBox className="h-3 w-full" />
              <SkeletonBox className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonSettlementStatus() {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <SkeletonBox className="h-5 w-36" />
      </div>
      <div className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <SkeletonBox className="h-8 w-8 !rounded-full" />
              <SkeletonBox className="h-4 w-44" />
            </div>
            <SkeletonBox className="h-6 w-48" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <SkeletonBox className="h-8 w-8 !rounded-full" />
                  <SkeletonBox className="h-4 w-32" />
                </div>
                <SkeletonBox className="h-6 w-36" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <SkeletonBox className="h-5 w-44" />
      </div>
      <div className="flex items-end gap-6 p-6 pt-8" style={{ height: 360 }}>
        {[65, 30, 80, 55, 45].map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <SkeletonBox className="w-full !rounded-t-md" style={{ height: `${h}%` }} />
            <SkeletonBox className="h-3 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonMonitoring() {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <SkeletonBox className="h-5 w-44" />
      </div>
      <div className="flex flex-col py-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <SkeletonBox className="h-10 w-10 !rounded-full" />
            <SkeletonBox className="h-4 flex-1" />
            <SkeletonBox className="h-9 w-9 !rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonActivityFeed() {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <SkeletonBox className="h-5 w-48" />
      </div>
      <div className="flex flex-col">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 px-4 py-3">
            <SkeletonBox className="h-10 w-10 shrink-0 !rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <SkeletonBox className="h-4 w-3/4" />
              <SkeletonBox className="h-3 w-20" />
            </div>
            <SkeletonBox className="h-3 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <SkeletonBox className="h-7 w-32" />
          <SkeletonBox className="h-4 w-80" />
        </div>
        <div className="flex gap-3">
          <SkeletonBox className="h-10 w-36 !rounded-[var(--radius-button)]" />
          <SkeletonBox className="h-10 w-36 !rounded-[var(--radius-button)]" />
        </div>
      </div>

      <SkeletonMetricsRow />

      <div className="mt-6 grid grid-cols-[1fr_470px] gap-6">
        <div className="flex flex-col gap-6">
          <SkeletonQuickActions />
          <SkeletonSettlementStatus />
          <SkeletonChart />
        </div>
        <div className="flex flex-col gap-6">
          <SkeletonMonitoring />
          <SkeletonActivityFeed />
        </div>
      </div>
    </div>
  )
}
