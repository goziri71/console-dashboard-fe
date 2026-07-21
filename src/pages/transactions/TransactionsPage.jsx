import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import OverlayPortal from '../../components/ui/OverlayPortal'
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
  { key: 'payouts', label: 'Payouts', icon: ArrowUpCircle, fetcher: getNgnPayouts },
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

/** Deposits credit the merchant wallet; API often maps merchant under sender_* and external payer under recipient_*. */
function extractDepositParties(tx) {
  const merchantName = pickFirstPath(tx, [
    'sender_account_name',
    'sender_name',
    'account_name',
    'target_account_name',
    'recipient_account_name',
    'recipient_name',
    'wallet.name',
    'target.name',
  ]) || '--'

  const merchantMeta = pickFirstPath(tx, [
    'sender_account_number',
    'target_account_number',
    'recipient_account_number',
    'target_account_key',
    'account_key',
  ]) || '--'

  const externalSenderName = pickFirstPath(tx, [
    'recipient_account_name',
    'recipient_name',
    'beneficiary_name',
    'debit_party_name',
    'origin.name',
  ]) || '--'

  const externalSenderMeta = pickFirstPath(tx, [
    'recipient_account_number',
    'sender_account_number',
    'source_account_number',
    'source_reference',
  ]) || '--'

  return {
    primaryName: merchantName,
    primaryMeta: merchantMeta,
    secondaryName: externalSenderName,
    secondaryMeta: externalSenderMeta,
  }
}

function extractDefaultParties(tx) {
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

  return {
    primaryName: recipientName,
    primaryMeta: recipientMeta,
    secondaryName: senderName,
    secondaryMeta: senderMeta,
  }
}

function tableColumnsForTab(tab) {
  if (tab === 'deposits') {
    return { primary: 'Merchant', secondary: 'Sender' }
  }
  if (tab === 'transfers') {
    return { primary: 'Recipient', secondary: 'Sender' }
  }
  return { primary: 'Recipient', secondary: 'Merchant' }
}

function partiesForTab(tab, tx) {
  if (tab === 'deposits') return extractDepositParties(tx)
  return extractDefaultParties(tx)
}

function statusFromBackend(status) {
  const value = String(status ?? '').trim()
  return value || '--'
}

function statusKind(status) {
  const value = statusFromBackend(status).toLowerCase()
  if (value.includes('success')) return 'completed'
  if (value.includes('fail') || value.includes('error')) return 'failed'
  if (value.includes('pending') || value.includes('process')) return 'processing'
  return 'neutral'
}

function statusBadgeCls(status) {
  const kind = statusKind(status)
  if (kind === 'completed') return 'bg-success-bg text-success'
  if (kind === 'failed') return 'bg-error-bg text-error'
  if (kind === 'processing') return 'bg-warning-bg text-warning'
  return 'bg-card-hover text-text-muted'
}

function FilterPill({ icon: Icon, label, value, options, onChange }) {
  return (
    <div className="relative min-w-0">
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
        {createElement(Icon, { size: 14 })}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="filter-select w-full min-w-[120px] sm:w-auto"
      >
        {options.map((option) => (
          <option key={option || 'all'} value={option}>
            {option || label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
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
  }, [page, query, selectedTab])

  useEffect(() => {
    fetchTransactions()
    return () => abortRef.current?.abort?.()
  }, [fetchTransactions])

  useEffect(() => {
    setPage(1)
  }, [activeTab, query.search, query.status, query.currency_code])

  function mapRow(tx, index) {
    const sn = (page - 1) * TABLE_LIMIT + index + 1
    const parties = partiesForTab(activeTab, tx)
    const isSwap = activeTab === 'swaps'
    const sourceCurrency = pickFirst(tx, ['source_currency_code']) || 'NGN'
    const targetCurrency = pickFirst(tx, ['target_currency_code']) || 'NGN'
    const sourceAmountRaw = pickFirst(tx, ['source_amount']) || 0
    const targetAmountRaw = pickFirst(tx, ['target_amount']) || 0
    const currency = isSwap
      ? sourceCurrency
      : pickFirst(tx, ['currency_code', 'currency', 'asset_code']) || 'NGN'
    const amountRaw = isSwap
      ? sourceAmountRaw
      : pickFirst(tx, ['amount', 'value', 'gross_amount', 'net_amount']) || 0
    const date = pickFirst(tx, ['date_created', 'created_at', 'timestamp', 'date_modified', 'date']) || ''
    const statusValue =
      (activeTab === 'deposits'
        ? pickFirst(tx, ['credit_status', 'status', 'transaction_status'])
        : activeTab === 'payouts'
          ? pickFirst(tx, ['payout_status', 'status', 'transaction_status'])
          : pickFirst(tx, ['status', 'transaction_status'])) || '--'
    const id = pickFirst(tx, ['reference', 'source_reference', 'target_reference', 'transaction_id']) || `TX-${sn}`
    const feeRaw = pickFirst(tx, ['fee', 'transaction_fee', 'charges', 'charge']) || 0
    const openingBalanceRaw = pickFirst(tx, ['opening_balance', 'balance_before']) || 0
    const closingBalanceRaw = pickFirst(tx, ['closing_balance', 'balance_after']) || 0

    return {
      sn,
      id,
      primaryName: parties.primaryName,
      primaryMeta: parties.primaryMeta,
      secondaryName: parties.secondaryName,
      secondaryMeta: parties.secondaryMeta,
      amount: isSwap
        ? `${formatBalance(sourceAmountRaw, sourceCurrency)} → ${formatBalance(targetAmountRaw, targetCurrency)}`
        : formatBalance(amountRaw, currency),
      amountRaw,
      currency,
      sourceAmountRaw,
      sourceCurrency,
      targetAmountRaw,
      targetCurrency,
      feeRaw,
      openingBalanceRaw,
      closingBalanceRaw,
      date,
      status: statusValue,
      raw: tx,
    }
  }

  const displayRows = rows.map(mapRow)
  const columnLabels = useMemo(() => tableColumnsForTab(activeTab), [activeTab])

  function handleExport() {
    if (!displayRows.length) return
    exportToCsv(
      displayRows.map((row) => ({
        SN: row.sn,
        Transaction_ID: row.id,
        [columnLabels.primary]: row.primaryName,
        [columnLabels.secondary]: row.secondaryName,
        Amount: row.amount,
        Date: row.date ? formatDate(row.date) : '--',
        Status: row.status,
      })),
      `transactions-${activeTab}-page-${page}.csv`
    )
  }

  function copyText(value) {
    if (!value) return
    navigator.clipboard?.writeText(String(value)).catch(() => {})
  }

  function buildDetailRows(tx, tab) {
    if (!tx) return []
    if (tab === 'swaps') {
      return [
        ['Sender', tx.secondaryName],
        ['Recipient', tx.primaryName],
        ['Source Amount', formatBalance(tx.sourceAmountRaw, tx.sourceCurrency)],
        ['Target Amount', formatBalance(tx.targetAmountRaw, tx.targetCurrency)],
        ['Exchange Rate', pickFirst(tx.raw, ['exchange_rate'])],
        ['Source Charge', formatBalance(pickFirst(tx.raw, ['source_charge']) || 0, tx.sourceCurrency)],
        ['Target Charge', formatBalance(pickFirst(tx.raw, ['target_charge']) || 0, tx.targetCurrency)],
        ['Source Reference', pickFirst(tx.raw, ['source_from_reference'])],
        ['Target Reference', pickFirst(tx.raw, ['target_to_reference'])],
        ['Reversal Reference', pickFirst(tx.raw, ['reversal_reference'])],
        ['Message', pickFirst(tx.raw, ['message'])],
        ['Session ID', pickFirst(tx.raw, ['session_id'])],
        ['Status', statusFromBackend(tx.status)],
      ]
    }

    if (tab === 'payouts') {
      return [
        ['Recipient', tx.primaryName],
        ['Recipient Account Number', pickFirstPath(tx.raw, ['recipient_account_number'])],
        ['Recipient Account Name', pickFirstPath(tx.raw, ['recipient_account_name'])],
        ['Recipient Institution', pickFirstPath(tx.raw, ['recipient_institution_name'])],
        ['Recipient Institution ID', pickFirstPath(tx.raw, ['recipient_institution_identifier'])],
        ['Merchant', tx.secondaryName],
        ['Merchant Account Name', pickFirstPath(tx.raw, ['source_account_name', 'sender_account_name'])],
        ['Merchant Account Number', pickFirstPath(tx.raw, ['source_account_number', 'sender_account_number'])],
        ['Amount', formatBalance(tx.amountRaw, tx.currency)],
        ['Charge', formatBalance(pickFirst(tx.raw, ['charge', 'charges', 'transaction_fee', 'fee']) || 0, tx.currency)],
        ['VAT', formatBalance(pickFirst(tx.raw, ['vat']) || 0, tx.currency)],
        ['Narration', pickFirst(tx.raw, ['narration'])],
        ['Live Reference', pickFirst(tx.raw, ['live_reference'])],
        ['ISVS Reference', pickFirst(tx.raw, ['isvs_reference'])],
        ['Reversal Reference', pickFirst(tx.raw, ['reversal_reference'])],
        ['Vendor Reference', pickFirst(tx.raw, ['vendor_reference'])],
        ['Vendor', pickFirst(tx.raw, ['vendor'])],
        ['Payout Status', pickFirst(tx.raw, ['payout_status'])],
        ['Opening Balance', formatBalance(tx.openingBalanceRaw, tx.currency)],
        ['Closing Balance', formatBalance(tx.closingBalanceRaw, tx.currency)],
        ['Session ID', pickFirst(tx.raw, ['session_id'])],
        ['Date Reversed', pickFirst(tx.raw, ['date_reversed']) ? formatDate(pickFirst(tx.raw, ['date_reversed'])) : '--'],
        ['Date Modified', pickFirst(tx.raw, ['date_modified']) ? formatDate(pickFirst(tx.raw, ['date_modified'])) : '--'],
        
      ]
    }

    if (tab === 'deposits') {
      return [
        ['Merchant', tx.primaryName],
        ['Merchant Account Number', pickFirstPath(tx.raw, ['sender_account_number', 'target_account_number'])],
        ['Sender', tx.secondaryName],
        ['Sender Account Number', pickFirstPath(tx.raw, ['recipient_account_number', 'source_account_number'])],
        ['Sender Bank Name', pickFirstPath(tx.raw, ['sender_bank_name', 'recipient_bank_name'])],
        ['Reference ID', tx.id],
        ['Deposit Reference', pickFirstPath(tx.raw, ['deposit_reference'])],
        ['Amount', formatBalance(tx.amountRaw, tx.currency)],
        ['Charge', formatBalance(pickFirst(tx.raw, ['charge', 'charges', 'transaction_fee', 'fee']) || 0, tx.currency)],
        ['VAT', formatBalance(pickFirst(tx.raw, ['vat']) || 0, tx.currency)],
        ['Settlement', formatBalance(pickFirst(tx.raw, ['settlement']) || 0, tx.currency)],
        ['Credit Status', pickFirst(tx.raw, ['credit_status', 'status', 'transaction_status'])],
        ['Opening Balance', formatBalance(tx.openingBalanceRaw, tx.currency)],
        ['Closing Balance', formatBalance(tx.closingBalanceRaw, tx.currency)],
        ['Session ID', pickFirst(tx.raw, ['session_id'])],
        ['Date Modified', pickFirst(tx.raw, ['date_modified']) ? formatDate(pickFirst(tx.raw, ['date_modified'])) : '--'],
        ['Status', statusFromBackend(tx.status)],
      ]
    }

    return [
      ['Recipient', tx.primaryName],
      ['Recipient Account Number', pickFirstPath(tx.raw, ['recipient_account_number'])],
      ['Merchant', tx.secondaryName],
      ['Merchant Bank Name', pickFirstPath(tx.raw, ['sender_bank_name'])],
      ['Reference ID', tx.id],
      ['Deposit Reference', pickFirstPath(tx.raw, ['deposit_reference'])],
      ['Amount', formatBalance(tx.amountRaw, tx.currency)],
      ['Charge', formatBalance(pickFirst(tx.raw, ['charge', 'charges', 'transaction_fee', 'fee']) || 0, tx.currency)],
      ['VAT', formatBalance(pickFirst(tx.raw, ['vat']) || 0, tx.currency)],
      ['Settlement', formatBalance(pickFirst(tx.raw, ['settlement']) || 0, tx.currency)],
      ['Credit Status', pickFirst(tx.raw, ['credit_status', 'status', 'transaction_status'])],
      ['Opening Balance', formatBalance(tx.openingBalanceRaw, tx.currency)],
      ['Closing Balance', formatBalance(tx.closingBalanceRaw, tx.currency)],
      ['Session ID', pickFirst(tx.raw, ['session_id'])],
      ['Date Modified', pickFirst(tx.raw, ['date_modified']) ? formatDate(pickFirst(tx.raw, ['date_modified'])) : '--'],
      ['Status', statusFromBackend(tx.status)],
    ]
  }

  const modalState = selectedTx ? statusKind(selectedTx.status) : 'neutral'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Transactions</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Monitor and review all transactions across deposits, payouts, transfers, swaps, and statements.
        </p>
      </div>

      <div className="card-shell">
        <div className="tab-scroll bg-page lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm transition-colors lg:h-[62px] lg:min-w-0 lg:rounded-none lg:border-r lg:border-border lg:px-4 lg:last:border-r-0',
                  active
                    ? 'bg-accent text-page lg:bg-card-hover lg:text-text-primary'
                    : 'bg-card-hover text-text-secondary hover:text-text-primary lg:bg-transparent lg:hover:bg-card-hover/60'
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
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-semi text-page transition-colors hover:brightness-95"
          >
            <Download size={14} />
            Export
            <ChevronDown size={14} />
          </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-sm text-error">{error}</div>
        ) : (
          <div className="table-scroll p-2">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-card-hover">
                  <th className="px-4 py-3 text-sm font-medium text-text-muted">S/N</th>
                  <th className="px-4 py-3 text-sm font-medium text-text-muted">{columnLabels.primary}</th>
                  <th className="px-4 py-3 text-sm font-medium text-text-muted">{columnLabels.secondary}</th>
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
                        <p className="text-text-primary">{row.primaryName}</p>
                        <p className="text-[11px] text-text-muted">{row.primaryMeta}</p>
                      </td>
                      <td className="px-4 py-2">
                        <p className="text-text-primary">{row.secondaryName}</p>
                        <p className="text-[11px] text-text-muted">{row.secondaryMeta}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 tabular-nums text-text-secondary">{row.amount}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-text-secondary">{row.date ? formatDate(row.date) : '--'}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <span className={cn('inline-flex rounded-full px-3 py-0.5 text-[11px] font-medium', statusBadgeCls(row.status))}>
                          {statusFromBackend(row.status)}
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
        <OverlayPortal open>
          <div className="drawer-overlay" onClick={() => setSelectedTx(null)} role="presentation">
            <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
              <div className="relative shrink-0 border-b border-border px-6 pb-5 pt-6">
                <button
                  onClick={() => setSelectedTx(null)}
                  className="absolute right-5 top-5 rounded-md p-1 text-text-muted transition-colors hover:bg-card-hover hover:text-text-secondary"
                >
                  <X size={18} />
                </button>
                <div
                  className={cn(
                    'mx-auto flex h-20 w-20 items-center justify-center rounded-full',
                    modalState === 'completed' && 'bg-success-bg/20',
                    modalState === 'failed' && 'bg-error-bg/20',
                    modalState === 'processing' && 'bg-warning-bg/20',
                    modalState === 'neutral' && 'bg-card-hover'
                  )}
                >
                  {modalState === 'completed' && <CheckCircle2 size={36} className="text-success" />}
                  {modalState === 'failed' && <XCircle size={36} className="text-error" />}
                  {modalState === 'processing' && <Clock3 size={36} className="text-warning" />}
                  {modalState === 'neutral' && <Clock3 size={36} className="text-text-muted" />}
                </div>
                <p className="mt-4 text-center text-xl font-semibold uppercase tracking-wide text-text-primary">
                  {statusFromBackend(selectedTx.status)}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="mb-6 text-center">
                  <p className="text-sm text-text-muted">Amount</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-text-primary">{selectedTx.amount}</p>
                  <p className="mt-1 text-sm text-text-secondary">{formatDate(selectedTx.date)}</p>
                </div>

                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="border-b border-border bg-card-hover px-4 py-3 text-sm font-medium text-text-primary">
                    Payment Details
                  </div>

                  {buildDetailRows(selectedTx, activeTab).map(([label, value], idx, arr) => {
                    const isAmountField = [
                      'Amount',
                      'Source Amount',
                      'Target Amount',
                      'Source Charge',
                      'Target Charge',
                      'Charge',
                      'VAT',
                      'Settlement',
                      'Opening Balance',
                      'Closing Balance',
                    ].includes(label)
                    return (
                      <div
                        key={label}
                        className={cn(
                          'flex items-start justify-between gap-3 px-4 py-3',
                          idx < arr.length - 1 && 'border-b border-border/60'
                        )}
                      >
                        <span className="shrink-0 text-sm text-text-secondary">{label}</span>
                        <span
                          className={cn(
                            'flex min-w-0 items-center justify-end gap-2 text-right text-sm text-text-primary',
                            isAmountField && 'shrink-0 whitespace-nowrap tabular-nums'
                          )}
                        >
                          {String(value || '--')}
                          {label === 'Reference ID' && value && (
                            <button
                              onClick={() => copyText(value)}
                              className="shrink-0 rounded-md p-1 text-text-muted hover:bg-card-hover hover:text-text-secondary"
                              title="Copy reference"
                            >
                              <Copy size={14} />
                            </button>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </OverlayPortal>
      )}
    </div>
  )
}
