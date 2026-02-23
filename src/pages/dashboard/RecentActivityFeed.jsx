import ActivityItem from '../../components/ui/ActivityItem'
import {
  Wallet,
  AlertTriangle,
  ArrowLeftRight,
  UserPlus,
  CheckCircle,
  ShieldCheck,
  Landmark,
  ArrowDownToLine,
  ArrowUpFromLine,
  Bitcoin,
} from 'lucide-react'
import { timeAgo } from '../../lib/utils'

const iconMap = {
  customer_onboarded: UserPlus,
  wallet_created: Wallet,
  dispute_created: AlertTriangle,
  dispute_resolved: CheckCircle,
  transfer_processed: ArrowLeftRight,
  ngn_deposit_received: ArrowDownToLine,
  ngn_payout_processed: ArrowUpFromLine,
  crypto_deposit_received: Bitcoin,
  crypto_payout_processed: Bitcoin,
  overdraft_requested: Landmark,
  kyc_submitted: ShieldCheck,
  kyc_approved: ShieldCheck,
  customer_flagged: AlertTriangle,
  merchant_activated: CheckCircle,
}

const typeColorMap = {
  customer_onboarded: 'customer',
  wallet_created: 'wallet',
  dispute_created: 'dispute',
  dispute_resolved: 'system',
  transfer_processed: 'transfer',
  ngn_deposit_received: 'transfer',
  ngn_payout_processed: 'transfer',
  crypto_deposit_received: 'wallet',
  crypto_payout_processed: 'wallet',
  overdraft_requested: 'dispute',
  kyc_submitted: 'system',
  kyc_approved: 'system',
  customer_flagged: 'dispute',
  merchant_activated: 'customer',
}

export default function RecentActivityFeed({ activities }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-card">
        <div className="border-b border-border px-4 py-4">
          <h3 className="text-base font-medium text-text-primary">Recent Operational Activities</h3>
        </div>
        <div className="px-4 py-8 text-center text-sm text-text-muted">
          No recent activities
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <h3 className="text-base font-medium text-text-primary">Recent Operational Activities</h3>
      </div>
      <div className="flex flex-col">
        {activities.map((activity, idx) => (
          <ActivityItem
            key={activity.reference || idx}
            icon={iconMap[activity.type] || CheckCircle}
            description={activity.description}
            author={activity.reference || ''}
            timestamp={timeAgo(activity.timestamp)}
            type={typeColorMap[activity.type] || 'system'}
          />
        ))}
      </div>
    </div>
  )
}
