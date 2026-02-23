import MetricCard from '../../components/ui/MetricCard'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Landmark,
  ArrowLeftRight,
  Bitcoin,
  UserPlus,
  Users,
  Wallet,
  ShieldCheck,
  Flag,
  Store,
} from 'lucide-react'
import { formatNumber } from '../../lib/utils'

function Section({ title, children }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <h3 className="text-base font-medium text-text-primary">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-4 p-4">{children}</div>
    </div>
  )
}

function FinanceMetrics({ dept }) {
  return (
    <Section title="Finance Overview">
      <MetricCard label="NGN Deposits Today" value={formatNumber(dept.total_ngn_deposits_today)} icon={ArrowDownToLine} iconColor="success" />
      <MetricCard label="NGN Payouts Today" value={formatNumber(dept.total_ngn_payouts_today)} icon={ArrowUpFromLine} iconColor="warning" />
    </Section>
  )
}

function OperationsMetrics({ dept }) {
  return (
    <Section title="Operations Overview">
      <MetricCard label="Open Disputes" value={formatNumber(dept.open_disputes)} icon={AlertTriangle} iconColor="error" />
      <MetricCard label="Pending Overdrafts" value={formatNumber(dept.pending_overdraft_requests)} icon={Landmark} iconColor="warning" />
      <MetricCard label="Transfers Today" value={formatNumber(dept.transfers_today)} icon={ArrowLeftRight} iconColor="accent" />
      <MetricCard label="NGN Payouts Today" value={formatNumber(dept.ngn_payouts_today)} icon={ArrowUpFromLine} iconColor="info" />
      <MetricCard label="NGN Payouts Pending" value={formatNumber(dept.ngn_payouts_pending)} icon={ArrowUpFromLine} iconColor="warning" />
      <MetricCard label="Crypto Payouts Today" value={formatNumber(dept.crypto_payouts_today)} icon={Bitcoin} iconColor="accent" />
    </Section>
  )
}

function OpsSupportMetrics({ dept }) {
  return (
    <Section title="Customer Support Overview">
      <MetricCard label="Onboarded Today" value={formatNumber(dept.customers_onboarded_today)} icon={UserPlus} iconColor="success" />
      <MetricCard label="Onboarded This Week" value={formatNumber(dept.customers_onboarded_this_week)} icon={Users} iconColor="info" />
      <MetricCard label="Disputes Filed Today" value={formatNumber(dept.disputes_filed_today)} icon={AlertTriangle} iconColor="error" />
      <MetricCard label="Disputes Resolved Today" value={formatNumber(dept.disputes_resolved_today)} icon={AlertTriangle} iconColor="success" />
    </Section>
  )
}

function ComplianceMetrics({ dept }) {
  return (
    <Section title="Compliance Overview">
      <MetricCard label="KYC Pending" value={formatNumber(dept.kyc_pending_approval)} icon={ShieldCheck} iconColor="warning" />
      <MetricCard label="ID Verification Pending" value={formatNumber(dept.id_verification_pending_approval)} icon={ShieldCheck} iconColor="info" />
      <MetricCard label="Flagged PND" value={formatNumber(dept.customers_flagged_pnd)} icon={Flag} iconColor="error" />
      <MetricCard label="Flagged PNC" value={formatNumber(dept.customers_flagged_pnc)} icon={Flag} iconColor="error" />
      <MetricCard label="Non-Compliant Personal" value={formatNumber(dept.non_compliant_personal)} icon={Users} iconColor="warning" />
      <MetricCard label="Non-Compliant Business" value={formatNumber(dept.non_compliant_business)} icon={Store} iconColor="warning" />
    </Section>
  )
}

function GrowthMetrics({ dept }) {
  return (
    <Section title="Growth Overview">
      <MetricCard label="Onboarded Today" value={formatNumber(dept.customers_onboarded_today)} icon={UserPlus} iconColor="success" />
      <MetricCard label="Onboarded This Week" value={formatNumber(dept.customers_onboarded_this_week)} icon={Users} iconColor="info" />
      <MetricCard label="Wallets Created Today" value={formatNumber(dept.wallets_created_today)} icon={Wallet} iconColor="accent" />
      <MetricCard label="Wallets Created This Week" value={formatNumber(dept.wallets_created_this_week)} icon={Wallet} iconColor="info" />
      <MetricCard label="Active Merchants" value={formatNumber(dept.active_merchants)} icon={Store} iconColor="success" />
    </Section>
  )
}

const roleComponentMap = {
  finance: FinanceMetrics,
  operations: OperationsMetrics,
  ops_support: OpsSupportMetrics,
  compliance: ComplianceMetrics,
  growth: GrowthMetrics,
}

export default function DepartmentMetrics({ department }) {
  if (!department?.role) return null

  const Component = roleComponentMap[department.role]
  if (!Component) return null

  return <Component dept={department} />
}
