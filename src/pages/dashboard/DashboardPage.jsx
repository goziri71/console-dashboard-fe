import { useState, useEffect } from 'react'
import { getSummary } from '../../services/dashboard'
import { DashboardSkeleton } from '../../components/ui/Skeleton'
import MetricsRow from './MetricsRow'
import QuickActionsPanel from './QuickActionsPanel'
import SettlementStatus from './SettlementStatus'
import CurrencyUsageChart from './CurrencyUsageChart'
import OperationalMonitoring from './OperationalMonitoring'
import RecentActivityFeed from './RecentActivityFeed'
import DepartmentMetrics from './DepartmentMetrics'

function Stagger({ children, delay = 0 }) {
  return (
    <div
      className="animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const summaryRes = await getSummary()
        setSummary(summaryRes.data)
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="animate-fade-in flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-error">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-[var(--radius-button)] border border-border bg-card px-4 py-2 text-sm text-text-primary transition-colors hover:bg-card-hover active:scale-[0.97]"
        >
          Retry
        </button>
      </div>
    )
  }

  const dept = summary?.department

  return (
    <div>
      {/* Page Header */}
      <Stagger delay={0}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Welcome back. Here's a real-time overview of Sterllo wallet infrastructure operations.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="rounded-[var(--radius-button)] bg-accent px-5 py-2.5 text-sm font-medium text-page transition-all hover:opacity-90 active:scale-[0.97]">
              Generate Report
            </button>
            <button className="rounded-[var(--radius-button)] border border-border bg-card px-5 py-2.5 text-sm font-medium text-text-primary transition-all hover:bg-card-hover active:scale-[0.97]">
              Export Snapshot
            </button>
          </div>
        </div>
      </Stagger>

      {/* Metrics Row */}
      <Stagger delay={60}>
        <MetricsRow overview={summary?.overview} />
      </Stagger>

      {/* Two-Column Content Grid */}
      <div className="mt-6 grid grid-cols-[1fr_470px] gap-6">
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          <Stagger delay={120}>
            <QuickActionsPanel />
          </Stagger>
          {dept?.settlement_status && (
            <Stagger delay={180}>
              <SettlementStatus data={dept.settlement_status} />
            </Stagger>
          )}
          {dept?.currency_volume && (
            <Stagger delay={240}>
              <CurrencyUsageChart data={dept.currency_volume} />
            </Stagger>
          )}
          <Stagger delay={300}>
            <DepartmentMetrics department={dept} />
          </Stagger>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          {(dept?.kyc_pending_approval != null || dept?.id_verification_pending_approval != null) && (
            <Stagger delay={140}>
              <OperationalMonitoring data={dept} />
            </Stagger>
          )}
          <Stagger delay={200}>
            <RecentActivityFeed />
          </Stagger>
        </div>
      </div>
    </div>
  )
}
