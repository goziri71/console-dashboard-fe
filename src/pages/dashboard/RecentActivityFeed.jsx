import { useState, useEffect } from 'react'
import { getActivities } from '../../services/dashboard'
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
  Loader2,
} from 'lucide-react'
import { timeAgo } from '../../lib/utils'

const LIMIT = 9

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

export default function RecentActivityFeed() {
  const [activities, setActivities] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  async function fetchPage(pageNum) {
    setLoading(true)
    try {
      const res = await getActivities(pageNum, LIMIT)
      const records = res.records || res.data || []
      const pagination = res.pagination || {}
      setActivities(records)
      setPage(pageNum)
      setTotalPages(pagination.total_pages || Math.ceil((pagination.total || records.length) / LIMIT))
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPage(1)
  }, [])

  if (loading) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-card">
        <div className="border-b border-border px-4 py-4">
          <h3 className="text-base font-medium text-text-primary">Recent Operational Activities</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-text-muted" />
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
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
    <div className="rounded-[var(--radius-card)] border border-border bg-card mt-[-22px]">
      <div className="border-b border-border px-4 py-4">
        <h3 className="text-base font-medium text-text-primary">Recent Operational Activities</h3>
      </div>
      <div className="flex flex-col">
        {activities.map((activity, idx) => (
          <div key={activity.reference || idx} className="animate-fade-in" style={{ animationDelay: `${Math.min(idx, LIMIT - 1) * 40}ms` }}>
            <ActivityItem
              icon={iconMap[activity.type] || CheckCircle}
              description={activity.description}
              author={activity.reference || ''}
              timestamp={timeAgo(activity.timestamp)}
              type={typeColorMap[activity.type] || 'system'}
            />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <button
            onClick={() => fetchPage(page - 1)}
            disabled={page <= 1 || loading}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-secondary transition-all duration-200 hover:bg-card-hover hover:text-text-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => fetchPage(page + 1)}
            disabled={page >= totalPages || loading}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-secondary transition-all duration-200 hover:bg-card-hover hover:text-text-primary active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
