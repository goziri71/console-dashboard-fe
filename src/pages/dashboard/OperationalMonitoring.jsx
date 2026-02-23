import MonitoringItem from '../../components/ui/MonitoringItem'
import { Landmark, UserCircle } from 'lucide-react'

export default function OperationalMonitoring({ data }) {
  if (!data) return null

  const items = [
    {
      id: 'kyc',
      label: 'KYC Pending Approval',
      count: data.kyc_pending_approval ?? 0,
      iconColor: 'success',
      icon: Landmark,
    },
    {
      id: 'id-verification',
      label: 'ID Verification Pending Approval',
      count: data.id_verification_pending_approval ?? 0,
      iconColor: 'warning',
      icon: UserCircle,
    },
  ]

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <h3 className="text-base font-medium text-text-primary">Operational Monitoring</h3>
      </div>
      <div className="flex flex-col py-2">
        {items.map((item) => (
          <MonitoringItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            count={item.count}
            iconColor={item.iconColor}
          />
        ))}
      </div>
    </div>
  )
}
