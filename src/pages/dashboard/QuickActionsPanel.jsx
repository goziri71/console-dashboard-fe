import QuickActionCard from '../../components/ui/QuickActionCard'
import { quickActions } from '../../data/mockData'

export default function QuickActionsPanel() {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <h3 className="text-base font-medium text-text-primary">Quick Actions</h3>
      </div>
      <div className="grid grid-cols-2 gap-4 p-4">
        {quickActions.map((action) => (
          <QuickActionCard
            key={action.id}
            title={action.title}
            description={action.description}
            iconColor={action.iconColor}
          />
        ))}
      </div>
    </div>
  )
}
