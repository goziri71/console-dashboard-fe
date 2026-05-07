import { formatNumber } from '../../lib/utils'

export default function CurrencyWalletDistribution({ data = [] }) {
  if (!data.length) return null

  const sortedCurrencies = [...data].sort((a, b) => (b.wallet_count || 0) - (a.wallet_count || 0))
  const topCurrencies = sortedCurrencies.slice(0, 8)
  const totalWallets = sortedCurrencies.reduce((acc, item) => acc + (item.wallet_count || 0), 0)

  return (
    <div className="h-full rounded-card border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-base font-medium text-text-primary">Wallet Distribution by Currency</h3>
      </div>
      <div className="space-y-1 p-4">
        {topCurrencies.map((item) => {
          const walletCount = item.wallet_count || 0
          const percentage = totalWallets ? Math.round((walletCount / totalWallets) * 100) : 0

          return (
            <div key={item.currency_code} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-text-primary">{item.currency_code}</span>
                <span className="text-text-secondary">
                  {formatNumber(walletCount)} wallets ({percentage}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-card-hover">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
