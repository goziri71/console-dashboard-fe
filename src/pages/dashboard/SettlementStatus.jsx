import { Wallet } from 'lucide-react'
import { formatNaira } from '../../lib/utils'

function SettlementCard({ icon: Icon, label, amount, className = '' }) {
  return (
    <div className={`flex flex-col gap-2 rounded-card border border-border bg-card p-3 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-bg">
          <Icon size={14} className="text-accent" />
        </div>
        <span className="text-xs text-text-secondary">{label}</span>
      </div>
      <span className="text-lg font-semibold text-text-primary">{formatNaira(amount)}</span>
    </div>
  )
}

export default function SettlementStatus({ data }) {
  if (!data) return null

  const completedCount = data.completed_today_count ?? 0
  const pendingCount = data.pending_count ?? 0

  return (
    <div className="h-full min-h-[295px] rounded-card border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-medium text-text-primary">Settlement Status</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-success-bg px-2.5 py-1 text-success">
              Completed: {completedCount}
            </span>
            <span className="rounded-full bg-warning-bg px-2.5 py-1 text-warning">
              Pending: {pendingCount}
            </span>
          </div>
        </div>
      </div>
      <div className="p-3">
        <div className="flex flex-col gap-3">
          <SettlementCard
            icon={Wallet}
            label="Completed Settlements Today"
            amount={parseFloat(data.completed_today_ngn) || 0}
          />
          <div className="grid grid-cols-2 gap-3">
            <SettlementCard
              icon={Wallet}
              label="Pending Settlements"
              amount={parseFloat(data.pending_ngn) || 0}
            />
            <SettlementCard
              icon={Wallet}
              label="Escrow Wallet Balance (aggregate)"
              amount={parseFloat(data.pending_ngn) || 0}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
