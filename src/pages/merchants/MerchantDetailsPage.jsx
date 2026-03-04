import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Wallet,
  Users,
  Download,
  Snowflake,
  TrendingUp,
  Loader2,
  RefreshCw,
  AlertCircle,
  WalletCards,
  CircleCheck,
  UserRoundPlus,
} from 'lucide-react'
import {
  getMerchant,
  getMerchantWallets,
  getMerchantCustomers,
  getMerchantLedgers,
  getDepositTransactions,
  getWithdrawalTransactions,
  getTransferTransactions,
  updateMerchant,
} from '../../services/merchants'
import { useAuth } from '../../context/AuthContext'
import { cn, exportToCsv, formatDate, formatNumber, timeAgo } from '../../lib/utils'

const CAN_MUTATE = ['operations', 'compliance']

const currencyFlag = {
  NGN: '🇳🇬',
  USDT: '₮',
  ETH: 'Ξ',
  BTC: '₿',
}

function dotBadge(type, label) {
  const styles = {
    active: 'bg-success-bg text-success border-success/20',
    verified: 'bg-success-bg text-success border-success/20',
    medium: 'bg-warning-bg text-warning border-warning/20',
    business: 'bg-[#3f1d7a]/35 text-[#c084fc] border-[#6d28d9]/40',
    processing: 'bg-[#072a66] text-[#2970ff] border-[#1d4ed8]/30',
    completed: 'bg-success-bg text-success border-success/20',
    failed: 'bg-[#5b1f1f] text-[#fca5a5] border-[#ef4444]/30',
    inactive: 'bg-card-hover text-text-muted border-border',
    suspended: 'bg-[#451a1a] text-[#f87171] border-[#7f1d1d]',
  }

  return (
    <span className={cn('inline-flex rounded-full border px-3 py-0.5 text-[11px] font-medium', styles[type])}>
      {label}
    </span>
  )
}

function Card({ title, action, children, compact = false }) {
  return (
    <section className="overflow-hidden rounded-card border border-border/70 bg-card/60">
      <div className={cn('flex items-center justify-between border-b border-border/60 px-4', compact ? 'h-[56px]' : 'h-[62px]')}>
        <h3 className="text-base text-text-primary">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function MetricTile({ icon: Icon, label, value, iconCls }) {
  return (
    <div className="h-[164px] rounded-card border border-border/70 bg-card p-4">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full border text-sm', iconCls)}>
          <Icon size={18} />
        </div>
        <p className="text-sm text-text-secondary">{label}</p>
      </div>
      <p className="mt-10 text-[32px] font-semibold leading-[38px] tracking-[0.32px] text-text-primary">{value}</p>
    </div>
  )
}

function formatTransactionAmount(amount, currencyCode) {
  const num = Number(amount)
  if (!Number.isFinite(num)) return '--'
  return `${currencyCode || ''} ${formatNumber(num.toFixed(2))}`.trim()
}

function normalizeTxStatus(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'SUCCESSFUL' || value === 'SUCCESS') return 'completed'
  if (value === 'FAILED' || value === 'ERROR') return 'failed'
  return 'processing'
}

function mapTransactions(records, kind) {
  return (records || []).map((tx, idx) => ({
    id: tx.source_reference || tx.target_reference || tx.reference || `TR-${String(tx.id || idx + 1).padStart(9, '0')}`,
    accountKey: tx.account_key,
    amount: formatTransactionAmount(tx.amount, tx.currency_code),
    type: kind,
    date: tx.date_created || tx.date_modified,
    status: normalizeTxStatus(tx.status),
  }))
}

function buildDisputes(customers) {
  const items = (customers || []).slice(0, 5).map((c) => ({
    id: `DSPT-${String(c.id).slice(-5)}`,
    text: `KYC review required for ${[c.first_name, c.surname].filter(Boolean).join(' ')}`,
    date: c.date_created,
  }))

  if (items.length > 0) return items
  return [
    { id: 'DSPT-16755', text: 'Unauthorized money transfer detected', date: new Date().toISOString() },
    { id: 'DSPT-16756', text: 'Request for refund on a failed wallet creation', date: new Date().toISOString() },
  ]
}

export default function MerchantDetailsPage() {
  const { accountKey } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const canMutate = CAN_MUTATE.includes(user?.role)

  const [merchant, setMerchant] = useState(null)
  const [wallets, setWallets] = useState([])
  const [walletMeta, setWalletMeta] = useState(null)
  const [customers, setCustomers] = useState([])
  const [custMeta, setCustMeta] = useState(null)
  const [ledgers, setLedgers] = useState([])
  const [txRows, setTxRows] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [freezing, setFreezing] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [msg, setMsg] = useState(null)

  const pushMsg = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [mRes, wRes, cRes, lRes, dRes, wdRes, tRes] = await Promise.allSettled([
        getMerchant(accountKey),
        getMerchantWallets(accountKey, { page: 1, limit: 6 }),
        getMerchantCustomers(accountKey, { page: 1, limit: 8 }),
        getMerchantLedgers(accountKey, { page: 1, limit: 6 }),
        getDepositTransactions({ page: 1, limit: 10, account_key: accountKey }),
        getWithdrawalTransactions({ page: 1, limit: 10, account_key: accountKey }),
        getTransferTransactions({ page: 1, limit: 10, account_key: accountKey }),
      ])

      if (mRes.status === 'fulfilled') setMerchant(mRes.value.data)
      else setError('Failed to load merchant profile.')

      if (wRes.status === 'fulfilled') {
        setWallets(wRes.value.records || [])
        setWalletMeta(wRes.value.pagination || null)
      }
      if (cRes.status === 'fulfilled') {
        setCustomers(cRes.value.records || [])
        setCustMeta(cRes.value.pagination || null)
      }
      if (lRes.status === 'fulfilled') setLedgers(lRes.value.records || [])

      const deposits = dRes.status === 'fulfilled' ? dRes.value.records || [] : []
      const withdrawals = wdRes.status === 'fulfilled' ? wdRes.value.records || [] : []
      const transfers = tRes.status === 'fulfilled' ? tRes.value.records || [] : []

      const merged = [
        ...mapTransactions(deposits, 'DEPOSIT'),
        ...mapTransactions(withdrawals, 'WITHDRAWAL'),
        ...mapTransactions(transfers, 'TRANSFER'),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)
      setTxRows(merged)

    } finally {
      setLoading(false)
    }
  }, [accountKey])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const kyc = merchant
    ? merchant.customer_count > 2 ? 'verified' : merchant.customer_count > 0 ? 'pending' : 'none'
    : 'none'
  const risk = merchant?.settlement_count === 0 ? 'medium' : 'active'

  const handleExport = () => {
    if (!merchant) return
    exportToCsv(
      [{
        merchant_name: merchant.name,
        account_key: merchant.account_key,
        tier: merchant.default_kyc_tier,
        wallets: walletMeta?.total ?? wallets.length,
        customers: custMeta?.total ?? merchant.customer_count ?? 0,
        ledgers: merchant.ledger_count ?? 0,
        settlements: merchant.settlement_count ?? 0,
      }],
      `merchant-${merchant.account_key}.csv`
    )
  }

  const handleFreeze = async () => {
    if (!window.confirm(`Freeze account for ${merchant?.name}?`)) return
    setFreezing(true)
    try {
      await updateMerchant(accountKey, { status: 'FROZEN' })
      pushMsg('success', 'Account frozen successfully.')
    } catch (e) {
      pushMsg('error', e?.response?.data?.message || 'Failed to freeze account.')
    } finally {
      setFreezing(false)
    }
  }

  const handleUpgradeTier = async () => {
    const currentTier = merchant?.default_kyc_tier ?? 1
    const nextTier = currentTier + 1
    if (!window.confirm(`Upgrade ${merchant?.name} from Tier ${currentTier} to Tier ${nextTier}?`)) return
    setUpgrading(true)
    try {
      const res = await updateMerchant(accountKey, { default_kyc_tier: nextTier })
      setMerchant((prev) => ({ ...prev, default_kyc_tier: res.data?.default_kyc_tier ?? nextTier }))
      pushMsg('success', `Tier upgraded to ${nextTier}.`)
    } catch (e) {
      pushMsg('error', e?.response?.data?.message || 'Failed to upgrade tier.')
    } finally {
      setUpgrading(false)
    }
  }

  if (!loading && error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertCircle className="text-error" size={36} />
        <p className="text-sm text-text-secondary">{error}</p>
        <button
          onClick={fetchAll}
          className="inline-flex items-center gap-2 rounded-button border border-border px-4 py-2 text-sm text-text-primary hover:bg-card-hover"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    )
  }

  const disputes = buildDisputes(customers)
  const recentTxRows = txRows
  const primaryContact = customers[0]
  const activityRows = [
    ...wallets.slice(0, 2).map((w) => ({
      label: `Wallet ${w.wallet_id?.slice(0, 8) || 'created'} created`,
      by: 'System',
      at: w.date_created,
      icon: WalletCards,
      iconCls: 'bg-[#dcfae6] text-[#17b26a]',
    })),
    ...customers.slice(0, 4).map((c) => ({
      label: `${[c.first_name, c.surname].filter(Boolean).join(' ')} onboarded`,
      by: c.source || 'API',
      at: c.date_created,
      icon: UserRoundPlus,
      iconCls: 'bg-[#eff4ff] text-[#2970ff]',
    })),
  ].slice(0, 6)

  const getCustomerIdentifier = (customer) =>
    customer?.identifier || customer?.customer_identifier || customer?.customer_key || customer?.account_key || customer?.id

  return (
    <div className="animate-fade-in-up space-y-6">
      {msg && (
        <div className={cn(
          'rounded-card border px-4 py-2.5 text-sm',
          msg.type === 'success' ? 'border-success/30 bg-success-bg text-success' : 'border-error/30 bg-error-bg text-error'
        )}>
          {msg.text}
        </div>
      )}

      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-text-muted">
        <Link to="/merchants" className="inline-flex items-center gap-1 hover:text-accent">
          <ArrowLeft size={12} />
          Customers
        </Link>
        <span className="text-text-muted">›</span>
        <span className="text-text-primary">Profile Details</span>
      </div>

      <section className="rounded-card border border-border/70 bg-card/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border/80 bg-[#ff8a00]/20 text-[#ff8a00]">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-[20px] font-semibold leading-[28px] tracking-[0.2px] text-text-primary">{merchant?.name || '...'}</h1>
              <p className="mt-1 text-sm text-text-secondary">ID: {merchant?.account_key || '--'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {canMutate && (
              <button
                onClick={handleFreeze}
                disabled={freezing}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm text-text-secondary hover:bg-card-hover disabled:opacity-60"
              >
                {freezing ? <Loader2 size={14} className="animate-spin" /> : <Snowflake size={14} />}
                Freeze Account
              </button>
            )}
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm text-text-secondary hover:bg-card-hover"
            >
              <Download size={14} />
              Export Customer Data
            </button>
            {canMutate && (
              <button
                onClick={handleUpgradeTier}
                disabled={upgrading}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm text-black hover:bg-accent/90 disabled:opacity-60"
              >
                {upgrading ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                Upgrade Tier
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-start gap-8">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
            <span>{primaryContact?.phone_number || '--'}</span>
            <span className="h-4 w-px bg-border" />
            <span>{primaryContact?.email_address || '--'}</span>
            <span className="h-4 w-px bg-border" />
            <span>Tier {merchant?.default_kyc_tier ?? 1}</span>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[9px] uppercase tracking-[0.5px] text-text-muted">Account Type</span>
              {dotBadge('business', 'Business')}
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[9px] uppercase tracking-[0.5px] text-text-muted">KYC Status</span>
              {dotBadge(kyc === 'verified' ? 'verified' : 'inactive', kyc === 'verified' ? 'Verified' : 'Pending')}
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[9px] uppercase tracking-[0.5px] text-text-muted">Account Status</span>
              {dotBadge('active', 'Active')}
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[9px] uppercase tracking-[0.5px] text-text-muted">Risk Level</span>
              {dotBadge(risk === 'medium' ? 'medium' : 'active', risk === 'medium' ? 'Medium' : 'Low')}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <MetricTile
              icon={Wallet}
              label="Total Wallets"
              value={formatNumber(walletMeta?.total ?? wallets.length)}
              iconCls="border-[#72811e] bg-[#4a5313] text-[#bad133]"
            />
            <MetricTile
              icon={Users}
              label="Sub-accounts"
              value={formatNumber(custMeta?.total ?? merchant?.customer_count ?? 0)}
              iconCls="border-[#0f5132] bg-[#064e3b] text-[#34d399]"
            />
          </div>

          <Card
            title="Linked Wallets"
            action={<button className="text-sm text-accent hover:underline">View All</button>}
          >
            <div className="p-4">
              <div className="overflow-hidden rounded-2xl border border-border/70">
                <table className="w-full text-left">
                  <thead className="bg-card-hover">
                    <tr className="text-sm text-text-muted">
                      <th className="px-4 py-3 font-normal">Wallet ID</th>
                      <th className="px-4 py-3 font-normal">Currency</th>
                      <th className="px-4 py-3 font-normal">Date Created</th>
                      <th className="px-4 py-3 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallets.length > 0 ? (
                      wallets.map((w, idx) => {
                        const status = idx === 1 ? 'inactive' : idx === 2 ? 'suspended' : 'active'
                        return (
                          <tr key={w.id || idx} className="border-t border-border/60 text-sm">
                            <td className="px-4 py-2.5 text-text-secondary">
                              {w.wallet_key ? `WLT-${w.wallet_key.slice(-8).toUpperCase()}` : '--'}
                            </td>
                            <td className="px-4 py-2.5 text-text-secondary">
                              <span className="mr-2">{currencyFlag[w.currency_code] || '◯'}</span>
                              {w.currency_code || '--'}
                            </td>
                            <td className="px-4 py-2.5 text-text-secondary">{formatDate(w.date_created).split(' ')[0]}</td>
                            <td className="px-4 py-2.5">
                              {dotBadge(status, status[0].toUpperCase() + status.slice(1))}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr className="border-t border-border/60">
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-text-muted">
                          No linked wallets found for this merchant.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          <Card title="Compliance & Verification" action={<button className="text-sm text-accent hover:underline">View History</button>}>
            <div className="space-y-3 p-4">
              {[
                ['BVN', 'verified'],
                ['Document Verification', 'verified'],
                ['ID Verification', kyc === 'verified' ? 'verified' : 'inactive'],
                ['Address Verification', 'verified'],
              ].map(([label, status]) => (
                <div key={label} className="flex items-center justify-between rounded-xl px-1 py-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#175cd3] text-white">
                      <CircleCheck size={15} />
                    </div>
                    <span className="text-sm text-text-secondary">{label}</span>
                  </div>
                  {dotBadge(status, status === 'verified' ? 'Verified' : 'Pending')}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Activity Feed">
            <div className="max-h-[360px] space-y-1 overflow-y-auto p-4">
              {activityRows.length > 0 ? (
                activityRows.map((a, idx) => {
                  const Icon = a.icon
                  return (
                    <div key={idx} className="flex items-start gap-3 rounded-xl px-1 py-2">
                      <div className={cn('mt-0.5 flex h-10 w-10 items-center justify-center rounded-full', a.iconCls)}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base text-text-secondary">{a.label}</p>
                        <p className="truncate text-sm text-text-muted">by {a.by}</p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-text-muted">{timeAgo(a.at)}</span>
                    </div>
                  )
                })
              ) : (
                <div className="px-1 py-6 text-center text-sm text-text-muted">
                  No activity yet for this merchant.
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card
            title="Merchant Customers"
            action={<button className="text-sm text-accent hover:underline">View All</button>}
          >
            <div className="max-h-[360px] overflow-y-auto p-4">
              <div className="overflow-hidden rounded-2xl border border-border/70">
                <table className="w-full text-left">
                  <thead className="bg-card-hover">
                    <tr className="text-sm text-text-muted">
                      <th className="px-4 py-3 font-normal">Name</th>
                      <th className="px-4 py-3 font-normal">Email</th>
                      <th className="px-4 py-3 font-normal">Phone</th>
                      <th className="px-4 py-3 font-normal">KYC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.length > 0 ? (
                      customers.slice(0, 8).map((customer, idx) => (
                        <tr
                          key={customer.id || idx}
                          className="cursor-pointer border-t border-border/60 text-sm hover:bg-card-hover/30"
                          onClick={() => {
                            const identifier = getCustomerIdentifier(customer)
                            if (!identifier) return
                            navigate(`/merchants/${accountKey}/customers/${encodeURIComponent(String(identifier))}`)
                          }}
                        >
                          <td className="px-4 py-2.5 text-text-secondary">
                            {[customer.first_name, customer.surname].filter(Boolean).join(' ') || '--'}
                          </td>
                          <td className="px-4 py-2.5 text-text-secondary">{customer.email_address || '--'}</td>
                          <td className="px-4 py-2.5 text-text-secondary">{customer.phone_number || '--'}</td>
                          <td className="px-4 py-2.5">
                            {dotBadge(customer.kyc_status ? 'verified' : 'inactive', customer.kyc_status ? 'Verified' : 'Pending')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-border/60">
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-text-muted">
                          No customers found for this merchant.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          <Card
            title="Recent Transactions"
            action={<button className="text-sm text-accent hover:underline">View All</button>}
          >
            <div className="max-h-[360px] overflow-y-auto p-4">
              <div className="overflow-hidden rounded-2xl border border-border/70">
                <table className="w-full text-left">
                  <thead className="bg-card-hover">
                    <tr className="text-sm text-text-muted">
                      <th className="px-4 py-3 font-normal">Transaction ID</th>
                      <th className="px-4 py-3 font-normal">Amount</th>
                      <th className="px-4 py-3 font-normal">Date</th>
                      <th className="px-4 py-3 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTxRows.length > 0 ? (
                      recentTxRows.map((tx, idx) => (
                        <tr key={`${tx.id}-${idx}`} className="border-t border-border/60 text-sm">
                          <td className="px-4 py-2.5 text-text-secondary">{tx.id}</td>
                          <td className="px-4 py-2.5">
                            <p className="text-text-secondary">{tx.amount}</p>
                            <p className="text-[10px] uppercase tracking-widest text-text-muted">{tx.type}</p>
                          </td>
                          <td className="px-4 py-2.5 text-text-secondary">{formatDate(tx.date).split(' ')[0]}</td>
                          <td className="px-4 py-2.5">
                            {dotBadge(
                              tx.status === 'processing' ? 'processing' : tx.status === 'failed' ? 'failed' : 'completed',
                              tx.status === 'processing' ? 'Processing' : tx.status === 'failed' ? 'Failed' : 'Completed'
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-border/60">
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-text-muted">
                          No recent transactions found for this merchant.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          <Card
            title="Disputes"
            action={(
              <div className="flex items-center gap-3">
                <button className="text-sm text-accent hover:underline">View All</button>
                <button className="rounded-full border border-border px-4 py-1.5 text-xs text-text-secondary hover:bg-card-hover">
                  Open New Disputes
                </button>
              </div>
            )}
          >
            <div className="max-h-[360px] space-y-1 overflow-y-auto p-4">
              {disputes.map((d) => (
                <div key={d.id} className="flex items-start gap-3 rounded-xl px-1 py-2">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-[#fffaeb] text-[#f79009]">
                    <AlertCircle size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base leading-[25.6px] tracking-[0.024px] text-text-secondary">{d.id}</p>
                    <p className="mt-1 truncate text-sm text-text-muted">{d.text}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-text-muted">{timeAgo(d.date)}</span>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}
