import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Mail, Phone, RefreshCw, UserRound, Wallet, WalletCards } from 'lucide-react'
import { getCustomer, getCustomerWallets } from '../../services/customers'
import {
  getDepositTransactions,
  getTransferTransactions,
  getWithdrawalTransactions,
} from '../../services/transactions'
import { cn, formatDate, formatNumber, timeAgo } from '../../lib/utils'

function dotBadge(type, label) {
  const styles = {
    active: 'bg-success-bg text-success border-success/20',
    verified: 'bg-success-bg text-success border-success/20',
    medium: 'bg-warning-bg text-warning border-warning/20',
    processing: 'bg-[#072a66] text-[#2970ff] border-[#1d4ed8]/30',
    completed: 'bg-success-bg text-success border-success/20',
    failed: 'bg-[#5b1f1f] text-[#fca5a5] border-[#ef4444]/30',
    inactive: 'bg-card-hover text-text-muted border-border',
  }
  return (
    <span className={cn('inline-flex rounded-full border px-3 py-0.5 text-[11px] font-medium', styles[type])}>
      {label}
    </span>
  )
}

function Card({ title, action, children }) {
  return (
    <section className="overflow-hidden rounded-card border border-border/70 bg-card/60">
      <div className="flex h-[62px] items-center justify-between border-b border-border/60 px-4">
        <h3 className="text-base text-text-primary">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function mapTransactions(records, kind) {
  return (records || []).map((tx, idx) => ({
    id: tx.source_reference || tx.target_reference || tx.reference || `TR-${String(tx.id || idx + 1).padStart(9, '0')}`,
    amount: Number(tx.amount || 0),
    currency: tx.currency_code || 'NGN',
    type: kind,
    date: tx.date_created || tx.date_modified,
    status: String(tx.status || '').toUpperCase(),
  }))
}

function formatAmount(amount, currency) {
  return `${currency} ${formatNumber(Number(amount || 0).toFixed(2))}`
}

export default function CustomerDetailsPage() {
  const { accountKey, identifier } = useParams()
  const [customer, setCustomer] = useState(null)
  const [wallets, setWallets] = useState([])
  const [txRows, setTxRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cRes, wRes] = await Promise.allSettled([
        getCustomer(identifier),
        getCustomerWallets(identifier, { page: 1, limit: 10 }),
      ])

      let customerPayload = null
      if (cRes.status === 'fulfilled') {
        customerPayload = cRes.value?.data || cRes.value || null
        setCustomer(customerPayload)
      }

      if (wRes.status === 'fulfilled') {
        setWallets(wRes.value?.records || wRes.value?.data || [])
      }

      const accountKeyForTx =
        customerPayload?.account_key ||
        customerPayload?.merchant_account_key ||
        accountKey

      const [dRes, wdRes, tRes] = await Promise.allSettled([
        getDepositTransactions({ page: 1, limit: 10, account_key: accountKeyForTx }),
        getWithdrawalTransactions({ page: 1, limit: 10, account_key: accountKeyForTx }),
        getTransferTransactions({ page: 1, limit: 10, account_key: accountKeyForTx }),
      ])

      const merged = [
        ...mapTransactions(dRes.status === 'fulfilled' ? dRes.value?.records || [] : [], 'DEPOSIT'),
        ...mapTransactions(wdRes.status === 'fulfilled' ? wdRes.value?.records || [] : [], 'WITHDRAWAL'),
        ...mapTransactions(tRes.status === 'fulfilled' ? tRes.value?.records || [] : [], 'TRANSFER'),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)

      setTxRows(merged)
      if (!customerPayload) setError('Customer profile not found.')
    } catch {
      setError('Failed to load customer profile.')
    } finally {
      setLoading(false)
    }
  }, [accountKey, identifier])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const fullName = useMemo(
    () => [customer?.first_name, customer?.surname].filter(Boolean).join(' ') || customer?.name || '--',
    [customer]
  )

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

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-text-muted">
        <Link to="/merchants" className="inline-flex items-center gap-1 hover:text-accent">
          <ArrowLeft size={12} />
          Merchants
        </Link>
        <span>›</span>
        <Link to={`/merchants/${accountKey}`} className="hover:text-accent">
          Merchant Info
        </Link>
        <span>›</span>
        <span className="text-text-primary">Customer Details</span>
      </div>

      <section className="rounded-card border border-border/70 bg-card/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border/80 bg-[#2970ff]/20 text-[#2970ff]">
              <UserRound size={24} />
            </div>
            <div>
              <h1 className="text-[20px] font-semibold text-text-primary">{fullName}</h1>
              <p className="mt-1 text-sm text-text-secondary">ID: {customer?.id || identifier}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {dotBadge(customer?.kyc_status ? 'verified' : 'inactive', customer?.kyc_status ? 'Verified' : 'Pending')}
            {dotBadge('active', 'Active')}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
          <span className="inline-flex items-center gap-1.5"><Phone size={14} /> {customer?.phone_number || '--'}</span>
          <span className="inline-flex items-center gap-1.5"><Mail size={14} /> {customer?.email_address || '--'}</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Customer Wallets" action={<button className="text-sm text-accent hover:underline">View All</button>}>
          <div className="max-h-[360px] overflow-y-auto p-4">
            <div className="overflow-hidden rounded-2xl border border-border/70">
              <table className="w-full text-left">
                <thead className="bg-card-hover">
                  <tr className="text-sm text-text-muted">
                    <th className="px-4 py-3 font-normal">Wallet ID</th>
                    <th className="px-4 py-3 font-normal">Currency</th>
                    <th className="px-4 py-3 font-normal">Created</th>
                    <th className="px-4 py-3 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.length ? wallets.map((w, idx) => (
                    <tr key={w.id || idx} className="border-t border-border/60 text-sm">
                      <td className="px-4 py-2.5 text-text-secondary">{w.wallet_key || w.wallet_id || '--'}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{w.currency_code || '--'}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{formatDate(w.date_created).split(' ')[0]}</td>
                      <td className="px-4 py-2.5">{dotBadge('active', 'Active')}</td>
                    </tr>
                  )) : (
                    <tr className="border-t border-border/60">
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-text-muted">No wallets found for this customer.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card title="Recent Transactions" action={<button className="text-sm text-accent hover:underline">View All</button>}>
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
                  {txRows.length ? txRows.map((tx, idx) => (
                    <tr key={`${tx.id}-${idx}`} className="border-t border-border/60 text-sm">
                      <td className="px-4 py-2.5 text-text-secondary">{tx.id}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{formatAmount(tx.amount, tx.currency)}</td>
                      <td className="px-4 py-2.5 text-text-secondary">{formatDate(tx.date).split(' ')[0]}</td>
                      <td className="px-4 py-2.5">
                        {dotBadge(
                          tx.status.includes('FAIL') ? 'failed' : tx.status.includes('SUCCESS') ? 'completed' : 'processing',
                          tx.status.includes('FAIL') ? 'Failed' : tx.status.includes('SUCCESS') ? 'Completed' : 'Processing'
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr className="border-t border-border/60">
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-text-muted">No recent transactions for this customer.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Activity Feed">
        <div className="max-h-[320px] space-y-2 overflow-y-auto p-4">
          {[...wallets.slice(0, 4)].map((w, idx) => (
            <div key={idx} className="flex items-start gap-3 rounded-xl px-1 py-2">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-[#eff4ff] text-[#2970ff]">
                <WalletCards size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base text-text-secondary">
                  Wallet {w.wallet_id?.slice(0, 8) || w.wallet_key?.slice(0, 8) || '--'} created
                </p>
                <p className="truncate text-sm text-text-muted">for {fullName}</p>
              </div>
              <span className="whitespace-nowrap text-xs text-text-muted">{timeAgo(w.date_created)}</span>
            </div>
          ))}
          {!wallets.length && (
            <div className="px-1 py-6 text-center text-sm text-text-muted">No activity yet for this customer.</div>
          )}
        </div>
      </Card>
    </div>
  )
}
