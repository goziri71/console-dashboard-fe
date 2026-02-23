import { Wallet } from 'lucide-react'
import { formatNaira } from '../../lib/utils'

function SettlementCard({ icon: Icon, label, amount, className = '' }) {
  return (
    <div className={`flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-bg">
          <Icon size={16} className="text-accent" />
        </div>
        <span className="text-sm text-text-secondary">{label}</span>
      </div>
      <span className="text-xl font-semibold text-text-primary">{formatNaira(amount)}</span>
    </div>
  )
}

export default function SettlementStatus({ data }) {
  if (!data) return null

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <h3 className="text-base font-medium text-text-primary">Settlement Status</h3>
      </div>
      <div className="p-4">
        <div className="flex flex-col gap-4">
          <SettlementCard
            icon={Wallet}
            label="Completed Settlements Today"
            amount={parseFloat(data.completed_today_ngn) || 0}
          />
          <div className="grid grid-cols-2 gap-4">
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
