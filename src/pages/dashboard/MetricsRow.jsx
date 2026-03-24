import MetricCard from '../../components/ui/MetricCard'
import { Users, Wallet, ArrowLeftRight, AlertTriangle, Activity } from 'lucide-react'
import { formatNumber, formatUptime } from '../../lib/utils'

export default function MetricsRow({ overview }) {
  if (!overview) return null

  const metrics = [
    {
      id: 'total-customers',
      label: 'Total Customers',
      value: formatNumber(overview.total_customers),
      icon: Users,
      iconColor: 'success',
    },
    {
      id: 'total-wallets',
      label: 'Total Wallets',
      value: formatNumber(overview.total_wallets),
      icon: Wallet,
      iconColor: 'info',
    },
    {
      id: 'transactions-today',
      label: 'Transactions Today',
      value: formatNumber(overview.transactions_today),
      icon: ArrowLeftRight,
      iconColor: 'accent',
    },
    {
      id: 'open-disputes',
      label: 'Open Disputes',
      value: formatNumber(overview.open_disputes),
      icon: AlertTriangle,
      iconColor: 'error',
    },
    {
      id: 'system-uptime',
      label: 'System Uptime',
      value: overview.system_uptime_seconds
        ? formatUptime(overview.system_uptime_seconds)
        : '—',
      icon: Activity,
      iconColor: 'accent',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.id}
          label={metric.label}
          value={metric.value}
          iconColor={metric.iconColor}
          icon={metric.icon}
        />
      ))}
    </div>
  )
}
