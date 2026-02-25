import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  BookOpenText,
  ChevronDown,
  Download,
  Filter,
  MoreVertical,
  Search,
  Shuffle,
} from 'lucide-react'
import Pagination from '../../components/ui/Pagination'
import { cn, exportToCsv, formatBalance, formatDate } from '../../lib/utils'
import {
  getNgnDeposits,
  getNgnPayouts,
  getStatementTransactions,
  getSwapTransactions,
  getTransferTransactions,
} from '../../services/transactions'

const TABLE_LIMIT = 20

const TAB_ITEMS = [
  { key: 'deposits', label: 'Deposits', icon: ArrowDownCircle, fetcher: getNgnDeposits },
  { key: 'withdrawals', label: 'Withdrawals', icon: ArrowUpCircle, fetcher: getNgnPayouts },
  { key: 'transfers', label: 'Transfers', icon: ArrowLeftRight, fetcher: getTransferTransactions },
  { key: 'swaps', label: 'Swaps', icon: Shuffle, fetcher: getSwapTransactions },
  { key: 'statement', label: 'Statement', icon: BookOpenText, fetcher: getStatementTransactions },
]

const STATUS_OPTIONS = ['', 'SUCCESS', 'SUCCESSFUL', 'PENDING', 'PROCESSING', 'FAILED']
const CURRENCY_OPTIONS = ['', 'NGN', 'USD', 'USDT', 'BTC', 'ETH']

function pickFirst(obj, keys) {
  for (const k of keys) {
    if (obj?.[k] != null && obj[k] !== '') return obj[k]
  }
  return ''
}

function pickFirstPath(obj, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
    if (value != null && value !== '') return value
  }
  return ''
}

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase()
  if (value.includes('success')) return 'completed'
  if (value.includes('fail') || value.includes('error')) return 'failed'
  return 'processing'
}

function statusBadgeCls(status) {
  const normalized = normalizeStatus(status)
  if (normalized === 'completed') return 'bg-success-bg text-success'
  if (normalized === 'failed') return 'bg-error-bg text-error'
  return 'bg-warning-bg text-warning'
}

function FilterPill({ icon: Icon, label, value, options, onChange }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-page">
        <Icon size={14} />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-full border border-accent bg-accent pl-8 pr-8 text-xs font-semibold text-page outline-none"
      >
        {options.map((option) => (
          <option key={option || 'all'} value={option}>
            {option || label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-page">
        <ChevronDown size={14} />
      </div>
    </div>
  )
}

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState('statement')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [currencyCode, setCurrencyCode] = useState('')
  const [query, setQuery] = useState({ search: '', status: '', currency_code: '' })

  const abortRef = useRef(null)
  const inFlightKeyRef = useRef('')

  const selectedTab = useMemo(
    () => TAB_ITEMS.find((item) => item.key === activeTab) || TAB_ITEMS[0],
    [activeTab]
  )

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery({
        search: search.trim(),
        status,
        currency_code: currencyCode,
      })
    }, 350)
    return () => clearTimeout(t)
  }, [search, status, currencyCode])

  const fetchTransactions = useCallback(async () => {
    const params = { page, limit: TABLE_LIMIT }
    if (query.search) params.search = query.search
    if (query.status) params.status = query.status
    if (query.currency_code) params.currency_code = query.currency_code

    const queryKey = JSON.stringify({ activeTab, ...params })
    if (queryKey === inFlightKeyRef.current) return

    inFlightKeyRef.current = queryKey
    abortRef.current?.abort?.()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const res = await selectedTab.fetcher(params, controller.signal)
      const payload = res?.data || res || {}
      const records = payload.records || payload.data?.records || payload.data || []
      const pagination = payload.pagination || payload.meta || payload.data?.pagination || {}
      const nextTotal = Number(pagination.total ?? records.length ?? 0)
      const nextTotalPages = Number(
        pagination.total_pages || Math.max(1, Math.ceil((nextTotal || 0) / TABLE_LIMIT))
      )

      setRows(Array.isArray(records) ? records : [])
      setTotal(nextTotal)
      setTotalPages(nextTotalPages)
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
      setError(err.response?.data?.message || 'Failed to load transactions.')
      setRows([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      inFlightKeyRef.current = ''
      setLoading(false)
    }
  }, [activeTab, page, query, selectedTab])

  useEffect(() => {
    fetchTransactions()
    return () => abortRef.current?.abort?.()
  }, [fetchTransactions])

  useEffect(() => {
    setPage(1)
  }, [activeTab, query.search, query.status, query.currency_code])

  function mapRow(tx, index) {
    const sn = (page - 1) * TABLE_LIMIT + index + 1
    const recipientName = pickFirstPath(tx, [
      'recipient_account_name',
      'recipient_name',
      'beneficiary_name',
      'target_name',
      'target_account_name',
      'to_name',
      'recipient.name',
      'beneficiary.name',
      'target.name',
      'to.name',
      'destination.name',
      'credit_party_name',
      'wallet.name',
      'account_name',
      'target_account_key',
      'recipient_account_key',
      'to_account',
    ]) || '--'

    const recipientMeta = pickFirstPath(tx, [
      'recipient_account_number',
      'target_account_key',
      'recipient_account_key',
      'to_account',
      'recipient.account_key',
      'target.account_key',
      'destination.account_key',
      'account_key',
      'target_reference',
    ]) || '--'

    const senderName = pickFirstPath(tx, [
      'sender_account_name',
      'sender_name',
      'source_name',
      'initiator_name',
      'source_account_name',
      'from_name',
      'sender.name',
      'source.name',
      'from.name',
      'origin.name',
      'debit_party_name',
      'initiator',
      'source_account_key',
      'sender_account_key',
      'from_account',
    ]) || '--'

    const senderMeta = pickFirstPath(tx, [
      'sender_account_number',
      'source_account_key',
      'sender_account_key',
      'from_account',
      'sender.account_key',
      'source.account_key',
      'origin.account_key',
      'account_key',
      'source_reference',
    ]) || '--'
    const currency = pickFirst(tx, ['currency_code', 'currency', 'asset_code']) || 'NGN'
    const amountRaw = pickFirst(tx, ['amount', 'value', 'gross_amount', 'net_amount']) || 0
    const date = pickFirst(tx, ['date_created', 'created_at', 'timestamp', 'date_modified', 'date']) || ''
    const statusValue = pickFirst(tx, ['status', 'transaction_status']) || '--'
    const id = pickFirst(tx, ['reference', 'source_reference', 'target_reference', 'transaction_id']) || `TX-${sn}`

    return {
      sn,
      id,
      recipientName,
      recipientMeta,
      senderName,
      senderMeta,
      amount: formatBalance(amountRaw, currency),
      date,
      status: statusValue,
    }
  }

  const displayRows = useMemo(() => rows.map(mapRow), [rows, page])

  function handleExport() {
    if (!displayRows.length) return
    exportToCsv(
      displayRows.map((row) => ({
        SN: row.sn,
        Transaction_ID: row.id,
        Recipient: row.recipientName,
        Sender: row.senderName,
        Amount: row.amount,
        Date: row.date ? formatDate(row.date) : '--',
        Status: row.status,
      })),
      `transactions-${activeTab}-page-${page}.csv`
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Transactions</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Monitor and review all transactions across deposits, withdrawals, transfers, swaps, and statements.
        </p>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-card">
        <div className="grid grid-cols-5 border-b border-border bg-page">
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex h-[62px] items-center justify-center gap-2 border-r border-border px-4 text-sm transition-colors last:border-r-0',
                  active ? 'bg-card-hover text-text-primary' : 'text-text-secondary hover:bg-card-hover/60 hover:text-text-primary'
                )}
              >
                <span>{tab.label}</span>
                <Icon size={16} />
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-4 border-b border-border px-4 py-4">
          <h3 className="flex-1 text-base text-text-primary">{selectedTab.label} Statement</h3>

          <div className="relative w-[320px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search wallets..."
              className="h-10 w-full rounded-xl border border-border bg-page pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
            />
          </div>

          <FilterPill
            icon={Filter}
            label="All Status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
          />
          <FilterPill
            icon={Filter}
            label="All Currencies"
            value={currencyCode}
            options={CURRENCY_OPTIONS}
            onChange={setCurrencyCode}
          />

          <button
            onClick={handleExport}
            className="flex h-10 items-center gap-1.5 rounded-full border border-accent bg-accent px-4 text-xs font-semibold text-page transition-colors hover:brightness-95"
          >
            <Download size={14} />
            Export
            <ChevronDown size={14} />
          </button>
        </div>

        {loading ? (
          <div className="p-4 flex flex-col gap-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-sm text-error">{error}</div>
        ) : (
          <div className="overflow-x-auto p-2">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-card-hover">
                  <th className="px-4 py-3 text-sm font-medium text-text-muted">S/N</th>
                  <th className="px-4 py-3 text-sm font-medium text-text-muted">Recipient</th>
                  <th className="px-4 py-3 text-sm font-medium text-text-muted">Sender</th>
                  <th className="px-4 py-3 text-sm font-medium text-text-muted">Amount</th>
                  <th className="px-4 py-3 text-sm font-medium text-text-muted">Date</th>
                  <th className="px-4 py-3 text-sm font-medium text-text-muted">Status</th>
                  <th className="px-4 py-3 text-sm font-medium text-text-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length > 0 ? (
                  displayRows.map((row) => (
                    <tr key={row.id} className="h-[59px] border-b border-border/40 hover:bg-card-hover/30">
                      <td className="px-4 py-2 text-text-secondary">{row.sn}</td>
                      <td className="px-4 py-2">
                        <p className="text-text-primary">{row.recipientName}</p>
                        <p className="text-[11px] text-text-muted">{row.recipientMeta}</p>
                      </td>
                      <td className="px-4 py-2">
                        <p className="text-text-primary">{row.senderName}</p>
                        <p className="text-[11px] text-text-muted">{row.senderMeta}</p>
                      </td>
                      <td className="px-4 py-2 text-text-secondary">{row.amount}</td>
                      <td className="px-4 py-2 text-text-secondary">{row.date ? formatDate(row.date) : '--'}</td>
                      <td className="px-4 py-2">
                        <span className={cn('inline-flex rounded-full px-3 py-0.5 text-[11px] font-medium', statusBadgeCls(row.status))}>
                          {normalizeStatus(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button className="rounded-md p-1 text-text-muted transition-colors hover:bg-card-hover hover:text-text-secondary">
                          <MoreVertical size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">
                      No transactions found. Try a broader search or different filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          label="Transactions"
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
