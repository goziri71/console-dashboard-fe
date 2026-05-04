import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock3,
  FileText,
  Flag,
  Info,
  LayoutGrid,
  ListChecks,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  UserMinus,
} from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts'
import {
  getComplianceActivity,
  getComplianceAlerts,
  getComplianceOverview,
  getComplianceReports,
  getComplianceRiskTrends,
  getComplianceVerificationStatus,
} from '../../services/compliance'
import PageLoader from '../../components/ui/PageLoader'
import { cn, formatNumber, timeAgo } from '../../lib/utils'

const SIDEBAR_ITEMS = [
  { label: 'Overview', icon: LayoutGrid },
  { label: 'Alerts', icon: Bell },
  { label: 'KYC Verifications', icon: ShieldCheck },
  { label: 'Suspicious Transactions', icon: Flag },
  { label: 'Reports', icon: FileText },
  { label: 'Rules & Limits', icon: SlidersHorizontal },
  { label: 'Activity Log', icon: Activity },
  { label: 'Insights', icon: Info },
]

function toArray(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.records)) return payload.records
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

function toObject(payload) {
  return payload?.data && typeof payload.data === 'object' ? payload.data : payload || {}
}

function numberAt(obj, paths, fallback = 0) {
  for (const p of paths) {
    const v = obj?.[p]
    if (v !== undefined && v !== null && v !== '') {
      const n = Number(v)
      if (!Number.isNaN(n)) return n
    }
  }
  return fallback
}

function textAt(obj, paths, fallback = '--') {
  for (const p of paths) {
    const v = obj?.[p]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v)
  }
  return fallback
}

function StatCard({ icon: Icon, iconClass, label, value }) {
  return (
    <div className="rounded-card border border-border/70 bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', iconClass)}>
          <Icon size={16} />
        </div>
        <span>{label}</span>
      </div>
      <p className="text-[38px] font-semibold leading-[1.1] tracking-[0.32px] text-text-primary">{value}</p>
    </div>
  )
}

function VerificationTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-xs font-medium text-text-primary">{formatNumber(payload[0].value)}</p>
    </div>
  )
}

function RiskTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs text-text-secondary">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-xs" style={{ color: p.color }}>
          {p.name}: {formatNumber(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function CompliancePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [overview, setOverview] = useState({})
  const [verificationStatus, setVerificationStatus] = useState([])
  const [riskTrends, setRiskTrends] = useState([])
  const [alerts, setAlerts] = useState({})
  const [activity, setActivity] = useState([])
  const [reports, setReports] = useState({})

  useEffect(() => {
    let active = true

    async function run() {
      setLoading(true)
      setError('')
      try {
        const [o, v, r, a, act, rep] = await Promise.all([
          getComplianceOverview(),
          getComplianceVerificationStatus(),
          getComplianceRiskTrends(),
          getComplianceAlerts(),
          getComplianceActivity(),
          getComplianceReports(),
        ])
        if (!active) return
        setOverview(toObject(o))
        setVerificationStatus(toArray(v))
        setRiskTrends(toArray(r))
        setAlerts(toObject(a))
        setActivity(toArray(act))
        setReports(toObject(rep))
      } catch (err) {
        if (!active) return
        setError(err.response?.data?.message || 'Failed to load compliance data.')
      } finally {
        if (active) setLoading(false)
      }
    }

    run()
    return () => {
      active = false
    }
  }, [])

  const metrics = useMemo(() => {
    const cards = overview?.cards || {}
    const verified = numberAt(cards, ['verified_customers', 'verified', 'verified_count'])
    const pending = numberAt(cards, ['pending_kyc_reviews', 'pending_reviews', 'pending'])
    const flagged = numberAt(cards, ['flagged_accounts', 'flagged', 'flagged_count'])
    const restricted = numberAt(cards, ['restricted_accounts', 'restricted', 'restricted_count'])
    return { verified, pending, flagged, restricted }
  }, [overview])

  const verificationChartData = useMemo(() => {
    if (!verificationStatus.length) {
      return [
        { tier: 'Tier 0', value: 1800 },
        { tier: 'Tier 1', value: 3100 },
        { tier: 'Tier 2', value: 2500 },
        { tier: 'Tier 3', value: 3500 },
        { tier: 'Tier 4', value: 2600 },
      ]
    }
    return verificationStatus.map((item, idx) => ({
      tier: textAt(item, ['tier', 'level', 'label'], `Tier ${idx}`),
      value: numberAt(item, ['count', 'total', 'value']),
    }))
  }, [verificationStatus])

  const riskTrendData = useMemo(() => {
    if (!riskTrends.length) {
      return [
        { week: 'Week 1', flagged: 50, open: 88, solved: 30 },
        { week: 'Week 2', flagged: 92, open: 54, solved: 55 },
        { week: 'Week 3', flagged: 41, open: 96, solved: 65 },
        { week: 'Week 4', flagged: 33, open: 75, solved: 101 },
      ]
    }
    return riskTrends.map((item, idx) => ({
      week: textAt(item, ['week', 'label', 'period'], `Week ${idx + 1}`),
      flagged: numberAt(item, ['transactions_flagged', 'flagged', 'transactions']),
      open: numberAt(item, ['investigations_opened', 'open', 'investigations']),
      solved: numberAt(item, ['alerts_solved', 'solved', 'resolved']),
    }))
  }, [riskTrends])

  const monitoringRows = useMemo(() => {
    const monitoring = {
      ...(alerts || {}),
      ...(reports || {}),
      ...(overview?.operational_monitoring || {}),
    }
    return [
      {
        label: 'Investigations in Progress',
        sub: 'Compliance reviews currently active.',
        value: numberAt(monitoring, ['investigations_in_progress', 'investigations', 'in_progress']),
        icon: Clock3,
      },
      {
        label: 'Open Compliance Alerts',
        sub: 'Alerts that still require investigation.',
        value: numberAt(monitoring, ['open_compliance_alerts', 'open_alerts', 'open', 'total_open']),
        icon: AlertCircle,
      },
      {
        label: 'Reports Generated (This Month)',
        sub: 'Compliance or regulatory reports created.',
        value: numberAt(monitoring, ['reports_generated_this_month', 'generated_this_month', 'reports_this_month', 'count']),
        icon: FileText,
      },
    ]
  }, [overview, alerts, reports])

  const alertFeedRows = useMemo(() => {
    const alertItems = toArray(alerts)
    return alertItems.map((item) => ({
      type: textAt(item, ['type', 'severity', 'status'], 'alert').toLowerCase(),
      title: textAt(item, ['title', 'message', 'alert_title'], 'Open compliance alert'),
      actor: textAt(item, ['actor', 'owner', 'assigned_to', 'source'], 'Compliance Team'),
      at: item?.timestamp ? timeAgo(item.timestamp) : textAt(item, ['time_ago', 'when', 'created_at'], '--'),
    }))
  }, [alerts])

  const reportFeedRows = useMemo(() => {
    const reportItems = toArray(reports)
    return reportItems.map((item) => ({
      type: 'report',
      title: textAt(item, ['title', 'name', 'report_name'], 'Compliance report generated'),
      actor: textAt(item, ['generated_by', 'actor', 'created_by'], 'System'),
      at: item?.timestamp ? timeAgo(item.timestamp) : textAt(item, ['time_ago', 'when', 'generated_at'], '--'),
    }))
  }, [reports])

  const feedRows = useMemo(() => {
    const activityRows = activity.map((item) => ({
      type: textAt(item, ['type', 'status'], 'info').toLowerCase(),
      title: textAt(item, ['title', 'action', 'message']),
      actor: textAt(item, ['actor', 'by', 'user_name'], 'System'),
      at: item?.timestamp ? timeAgo(item.timestamp) : textAt(item, ['time_ago', 'when'], '--'),
    }))
    const merged = [...activityRows, ...alertFeedRows, ...reportFeedRows].filter((row) => row.title !== '--')
    if (merged.length) return merged.slice(0, 6)
    return [
      { type: 'success', title: 'Verification approved for Customer #2341', actor: 'AdminUser', at: '2 mins ago' },
      { type: 'success', title: 'Suspicious transaction flagged for Wallet...', actor: 'Support Team', at: '15 mins ago' },
      { type: 'info', title: 'Compliance report generated by Admin', actor: 'AdminUser', at: '23 mins ago' },
      { type: 'info', title: 'Account restriction applied to Customer #...', actor: 'Sales Team', at: '1 hour ago' },
    ]
  }, [activity, alertFeedRows, reportFeedRows])

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-card border border-error/40 bg-error-bg px-4 py-3 text-sm text-error">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[200px_1fr]">
        <aside className="hidden xl:block">
          <div className="overflow-hidden rounded-card border border-border/70 bg-card">
            <div className="border-b border-border/60 px-4 py-4">
              <h3 className="text-2xl font-semibold leading-tight tracking-[0.2px] text-text-primary">Compliance</h3>
              <p className="mt-1 max-w-[160px] text-sm leading-5 text-text-muted">
                Monitor verification, risks, and regulatory compliance.
              </p>
            </div>
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                className={cn(
                  'flex h-12 w-full items-center gap-2.5 border-b border-border/50 px-4 text-left text-sm last:border-b-0',
                  item.label === 'Overview'
                    ? 'bg-[#171a10] text-text-primary'
                    : 'text-text-muted hover:bg-card-hover hover:text-text-secondary'
                )}
              >
                <item.icon size={14} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="pt-1">
          <div className="mb-4 px-1">
            <h2 className="text-[20px] leading-tight text-text-primary">Compliance Overview</h2>
            <p className="mt-1 text-sm text-text-secondary">Monitor verification, risks, and regulatory compliance.</p>
          </div>

          {loading ? (
            <PageLoader label="Loading compliance data…" minHeight="min-h-[320px]" size={30} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                <StatCard icon={CheckCircle2} iconClass="bg-info-bg text-info" label="Verified Customers" value={formatNumber(metrics.verified)} />
                <StatCard icon={Clock3} iconClass="bg-warning-bg text-warning" label="Pending KYC Reviews" value={formatNumber(metrics.pending)} />
                <StatCard icon={ShieldAlert} iconClass="bg-error-bg text-error" label="Flagged Accounts" value={formatNumber(metrics.flagged)} />
                <StatCard icon={UserMinus} iconClass="bg-card-hover text-text-secondary" label="Restricted Accounts" value={formatNumber(metrics.restricted)} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="rounded-card border border-border/70 bg-card p-3 xl:col-span-2">
                  <h3 className="mb-2 text-sm text-text-secondary">Customer Verification Status</h3>
                  <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={verificationChartData}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#1E2530" />
                      <XAxis dataKey="tier" axisLine={false} tickLine={false} tick={{ fill: '#8B8F97', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8B8F97', fontSize: 11 }} />
                      <Tooltip content={<VerificationTooltip />} />
                      <Bar dataKey="value" fill="#bad133" radius={[14, 14, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="mt-1 text-xs text-text-muted">Quick breakdown of verification levels across the platform.</p>
                </div>

                <div className="rounded-card border border-border/70 bg-card p-3">
                  <h3 className="mb-2 text-sm text-text-secondary">Operational Monitoring</h3>
                  <div className="space-y-3">
                    {monitoringRows.map((row) => (
                      <div key={row.label} className="flex items-center gap-3 border-b border-border/50 pb-2 last:border-b-0 last:pb-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-info-bg text-info">
                          <row.icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-text-secondary">{row.label}</p>
                          <p className="truncate text-xs text-text-muted">{row.sub}</p>
                        </div>
                        <span className="rounded-full border border-border/70 bg-page px-2 py-0.5 text-xs text-text-secondary">
                          {String(row.value).padStart(2, '0')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-card border border-border/70 bg-card p-3 xl:col-span-2">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm text-text-secondary">Risk Detection Trend</h3>
                    <span className="rounded-full border border-border/70 bg-page px-3 py-1 text-xs text-text-muted">This Month</span>
                  </div>
                  <ResponsiveContainer width="100%" height={170}>
                    <LineChart data={riskTrendData}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#1E2530" />
                      <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#8B8F97', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8B8F97', fontSize: 11 }} />
                      <Tooltip content={<RiskTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#8B8F97' }} />
                      <Line dataKey="flagged" name="Transactions Flagged" stroke="#7c6cf3" strokeWidth={2} dot={{ r: 2 }} />
                      <Line dataKey="open" name="Investigations Opened" stroke="#f97366" strokeWidth={2} dot={{ r: 2 }} />
                      <Line dataKey="solved" name="Alerts Solved" stroke="#22c7f5" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-card border border-border/70 bg-card p-3">
                  <h3 className="mb-2 text-sm text-text-secondary">Compliance Activity Feed</h3>
                  <div className="space-y-3">
                    {feedRows.map((row, idx) => (
                      <div key={`${row.title}-${idx}`} className="flex items-start gap-2">
                        <div
                          className={cn(
                            'mt-0.5 flex h-7 w-7 items-center justify-center rounded-full',
                            row.type.includes('success') ? 'bg-success-bg text-success' : 'bg-info-bg text-info'
                          )}
                        >
                          {row.type.includes('success') ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-text-secondary">{row.title}</p>
                          <p className="truncate text-xs text-text-muted">by {row.actor}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-text-muted">{row.at}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
