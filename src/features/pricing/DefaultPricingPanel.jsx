import { useAuth } from '../../context/AuthContext'
import { canManagePricing, canReadPricing } from '../../lib/permissions'
import PricingManager from './PricingManager'

export default function DefaultPricingPanel() {
  const { user } = useAuth()
  const permissions = user?.permissions

  return (
    <div className="p-4">
      <PricingManager
        defaultMode
        canView={canReadPricing(permissions)}
        canManage={canManagePricing(permissions)}
      />
    </div>
  )
}
