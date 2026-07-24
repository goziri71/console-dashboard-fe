import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { canManagePricing, canReadPricing } from '../../lib/permissions'
import PricingManager from './PricingManager'

export default function MerchantPricingPage() {
  const { accountKey } = useParams()
  const { user } = useAuth()
  const permissions = user?.permissions

  return (
    <div className="space-y-5">
      <div>
        <Link
          to={`/merchants/${encodeURIComponent(accountKey)}?tab=fees`}
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent"
        >
          <ArrowLeft size={15} />
          Merchant profile
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-text-primary">Merchant pricing</h1>
        <p className="mt-1 text-sm text-text-secondary">
          View the effective charges applied to this merchant and manage custom overrides.
        </p>
      </div>
      <PricingManager
        accountKey={accountKey}
        canView={canReadPricing(permissions)}
        canManage={canManagePricing(permissions)}
      />
    </div>
  )
}
