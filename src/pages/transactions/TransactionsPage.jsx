import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  BookOpenText,
  CheckCircle2,
  Clock3,
  ChevronRight,
  ChevronDown,
  Copy,
  Download,
  Filter,
  Search,
  Shuffle,
  XCircle,
  X,
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

const TABLE_LIMIT = 10

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
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#979797]">
        <Icon size={14} />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-full bg-[#494949] pl-8 pr-8 text-xs font-medium text-[#979797] outline-none"
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
  const [activeTab, setActiveTab] = useState('deposits')
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
  const [selectedTx, setSelectedTx] = useState(null)

  const abortRef = useRef(null)

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
    const statusValue =
      (activeTab === 'deposits'
        ? pickFirst(tx, ['credit_status', 'status', 'transaction_status'])
        : activeTab === 'withdrawals'
          ? pickFirst(tx, ['payout_status', 'status', 'transaction_status'])
          : pickFirst(tx, ['status', 'transaction_status'])) || '--'
    const id = pickFirst(tx, ['reference', 'source_reference', 'target_reference', 'transaction_id']) || `TX-${sn}`
    const feeRaw = pickFirst(tx, ['fee', 'transaction_fee', 'charges', 'charge']) || 0
    const openingBalanceRaw = pickFirst(tx, ['opening_balance', 'balance_before']) || 0
    const closingBalanceRaw = pickFirst(tx, ['closing_balance', 'balance_after']) || 0

    return {
      sn,
      id,
      recipientName,
      recipientMeta,
      senderName,
      senderMeta,
      amount: formatBalance(amountRaw, currency),
      amountRaw,
      currency,
      feeRaw,
      openingBalanceRaw,
      closingBalanceRaw,
      date,
      status: statusValue,
      raw: tx,
    }
  }

  const displayRows = useMemo(() => rows.map(mapRow), [rows, page, activeTab])

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

  function formatDateParts(value) {
    if (!value) return { date: '--', time: '--' }
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return { date: '--', time: '--' }
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    return { date, time }
  }

  function copyText(value) {
    if (!value) return
    navigator.clipboard?.writeText(String(value)).catch(() => {})
  }

  const modalState = selectedTx ? normalizeStatus(selectedTx.status) : 'processing'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Transactions</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Monitor and review all transactions across deposits, withdrawals, transfers, swaps, and statements.
        </p>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-card">
        <div className="flex overflow-x-auto border-b border-border bg-page [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-5 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex h-[62px] min-w-[42%] shrink-0 items-center justify-center gap-2 border-r border-border px-4 text-sm transition-colors last:border-r-0 sm:min-w-[33%] md:min-w-[28%]',
                  'lg:min-w-0',
                  active ? 'bg-card-hover text-text-primary' : 'text-text-secondary hover:bg-card-hover/60 hover:text-text-primary'
                )}
              >
                <span>{tab.label}</span>
                <Icon size={16} />
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 xl:flex-row xl:items-center xl:gap-4">
          <h3 className="min-w-0 text-base text-text-primary xl:flex-1">{selectedTab.label} Statement</h3>

          <div className="relative w-full min-w-0 xl:w-[320px] xl:shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search wallets..."
              className="h-10 w-full rounded-xl border border-border bg-page pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
            />
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
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
            className="flex h-10 items-center gap-1.5 rounded-full bg-[#F8FAEA] px-4 text-xs font-semi text-page transition-colors hover:brightness-95"
          >
            <Download size={14} />
            Export
            <ChevronDown size={14} />
          </button>
          </div>
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
                        <button
                          onClick={() => setSelectedTx(row)}
                          className="rounded-md p-1 text-text-muted transition-colors hover:bg-card-hover hover:text-text-secondary"
                        >
                          <ChevronRight size={16} />
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

      {selectedTx && (
        <div
          className={cn(
            'fixed inset-0 z-40 flex justify-end bg-black/45 p-3 backdrop-blur-sm sm:p-6',
            modalState === 'failed' ? 'items-start' : 'items-center'
          )}
        >
          <div className="h-[934px] max-h-[calc(100dvh-24px)] w-full max-w-[532px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[calc(100vh-48px)]">
            <div className="relative border-b border-border px-6 pb-6 pt-6">
              <button
                onClick={() => setSelectedTx(null)}
                className="absolute right-5 top-5 rounded-md p-1 text-text-muted transition-colors hover:bg-card-hover hover:text-text-secondary"
              >
                <X size={18} />
              </button>
              <div
                className={cn(
                  'mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-full',
                  modalState === 'completed' && 'bg-success-bg/20',
                  modalState === 'failed' && 'bg-error-bg/20',
                  modalState === 'processing' && 'bg-card-hover'
                )}
              >
                {modalState === 'completed' && <CheckCircle2 size={44} className="text-success" />}
                {modalState === 'failed' && <XCircle size={44} className="text-error" />}
                {modalState === 'processing' && <Clock3 size={44} className="text-warning" />}
              </div>
              <p className="text-center text-xl font-semibold text-text-primary">
                {modalState === 'completed'
                  ? 'Transaction Successful'
                  : modalState === 'failed'
                    ? 'Transaction Failed'
                    : 'Transaction Pending'}
              </p>
            </div>

            <div className="h-[calc(100%-196px)] overflow-y-auto px-6 py-5">
              <div className="mb-6 text-center">
                <p className="text-sm text-text-muted">Amount</p>
                <p className="mt-1 text-3xl font-semibold text-text-primary">{selectedTx.amount}</p>
                <p className="mt-1 text-sm text-text-secondary">{formatDate(selectedTx.date)}</p>
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="border-b border-border bg-card-hover px-4 py-3 text-sm font-medium text-text-primary">
                  Payment Details
                </div>

                {[
                  ['Recipient', selectedTx.recipientName],
                  ['Sender', selectedTx.senderName],
                  ['Reference ID', selectedTx.id],
                  ['Date', formatDateParts(selectedTx.date).date],
                  ['Time', formatDateParts(selectedTx.date).time],
                  ['Status', normalizeStatus(selectedTx.status)],
                  ['Fee', formatBalance(selectedTx.feeRaw, selectedTx.currency)],
                  ['Opening Balance', formatBalance(selectedTx.openingBalanceRaw, selectedTx.currency)],
                  ['Closing Balance', formatBalance(selectedTx.closingBalanceRaw, selectedTx.currency)],
                ].map(([label, value], idx) => (
                  <div
                    key={label}
                    className={cn(
                      'flex items-center justify-between px-4 py-3',
                      idx < 8 && 'border-b border-border/60'
                    )}
                  >
                    <span className="text-sm text-text-secondary">{label}</span>
                    <span className="flex items-center gap-2 text-sm text-text-primary">
                      {String(value || '--')}
                      {label === 'Reference ID' && value && (
                        <button
                          onClick={() => copyText(value)}
                          className="rounded-md p-1 text-text-muted hover:bg-card-hover hover:text-text-secondary"
                          title="Copy reference"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
