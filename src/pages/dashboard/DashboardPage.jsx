import { useState, useEffect } from 'react'
import { getSummary } from '../../services/dashboard'
import { DashboardSkeleton } from '../../components/ui/Skeleton'
import MetricsRow from './MetricsRow'
import SettlementStatus from './SettlementStatus'
import CurrencyUsageChart from './CurrencyUsageChart'
import CurrencyWalletDistribution from './CurrencyWalletDistribution'
import OperationalMonitoring from './OperationalMonitoring'
import RecentActivityFeed from './RecentActivityFeed'
import DepartmentMetrics from './DepartmentMetrics'
import GenerateReportPanel from '../../components/ui/GenerateReportPanel'

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
  const [showReportPanel, setShowReportPanel] = useState(false)

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
          className="rounded-button border border-border bg-card px-4 py-2 text-sm text-text-primary transition-colors hover:bg-card-hover active:scale-[0.97]"
        >
          Retry
        </button>
      </div>
    )
  }

  const dept = summary?.department
  const departmentGroups = dept?.departments || {}
  const financeDept = departmentGroups.finance
  const complianceDept = departmentGroups.compliance

  return (
    <div className="pb-4">
      {/* Page Header */}
      <Stagger delay={0}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Welcome back. Here's a real-time overview of Sterllo wallet infrastructure operations.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <button
              onClick={() => setShowReportPanel(true)}
              className="rounded-[2em] bg-accent px-5 py-2.5 text-sm font-medium text-page transition-all hover:opacity-90 hover:cursor-pointer active:scale-[0.97]"
            >
              Generate Report
            </button>
            <button className="rounded-[2em] border border-border bg-card px-5 py-2.5 text-sm font-medium text-text-primary transition-all hover:bg-card-hover hover:cursor-pointer active:scale-[0.97]">
              Export Snapshot
            </button>
          </div>
        </div>
      </Stagger>

      {/* Metrics Row */}
      <Stagger delay={60}>
        <MetricsRow overview={summary?.overview} />
      </Stagger>

      {/* At-a-Glance Responsive Grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-12">
        {financeDept?.settlement_status && (
          <div className="h-full 2xl:col-span-4">
            <Stagger delay={120}>
              <SettlementStatus data={financeDept.settlement_status} />
            </Stagger>
          </div>
        )}
        {(complianceDept?.kyc_pending_approval != null ||
          complianceDept?.id_verification_pending_approval != null) && (
          <div className="h-full 2xl:col-span-4">
            <Stagger delay={140}>
              <OperationalMonitoring data={complianceDept} />
            </Stagger>
          </div>
        )}
        {financeDept?.currency_volume && (
          <div className="h-full 2xl:col-span-4">
            <Stagger delay={180}>
              <CurrencyUsageChart data={financeDept.currency_volume} />
            </Stagger>
          </div>
        )}
        {financeDept?.currency_usage?.length > 0 && (
          <div className="h-full 2xl:col-span-4">
            <Stagger delay={200}>
              <CurrencyWalletDistribution data={financeDept.currency_usage} />
            </Stagger>
          </div>
        )}
        <div className="h-full 2xl:col-span-8">
          <Stagger delay={220}>
            <RecentActivityFeed />
          </Stagger>
        </div>
      </div>

      <div className="mt-4">
        <Stagger delay={240}>
          <DepartmentMetrics department={dept} />
        </Stagger>
      </div>

      <GenerateReportPanel
        isOpen={showReportPanel}
        onClose={() => setShowReportPanel(false)}
      />
    </div>
  )
}
