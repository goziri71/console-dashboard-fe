import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Search, Wallet, WalletCards } from 'lucide-react'
import MetricCard from '../../components/ui/MetricCard'
import Pagination from '../../components/ui/Pagination'
import { cn, formatCurrency, formatDate, formatNumber } from '../../lib/utils'
import {
  parseWalletsPageResponse,
  resolveWalletRowNavigation,
  walletRowIsNavigable,
} from '../../lib/walletNavigation'
import { getWalletsPage } from '../../services/wallets'

const TABLE_LIMIT = 10

export default function WalletsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [navError, setNavError] = useState(null)
  const [navigatingKey, setNavigatingKey] = useState(null)
  const [summary, setSummary] = useState({
    total_wallets: 0,
    total_value: '0',
    active_wallets: 0,
    pending_transactions: 0,
  })
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currencyCode, setCurrencyCode] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState({
    search: '',
    status: '',
    currency_code: '',
  })
  const [page, setPage] = useState(1)

  const abortRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery({
        search: search.trim(),
        status: statusFilter,
        currency_code: currencyCode.trim().toUpperCase(),
      })
    }, 350)
    return () => clearTimeout(t)
  }, [search, statusFilter, currencyCode])

  const fetchWallets = useCallback(async () => {
    const params = { page, limit: TABLE_LIMIT }
    if (debouncedQuery.search) params.search = debouncedQuery.search
    if (debouncedQuery.status) params.status = debouncedQuery.status
    if (debouncedQuery.currency_code) params.currency_code = debouncedQuery.currency_code
    abortRef.current?.abort?.()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const res = await getWalletsPage(params, controller.signal)
      const payload = parseWalletsPageResponse(res)
      setSummary(payload.summary || {
        total_wallets: 0,
        total_value: '0',
        active_wallets: 0,
        pending_transactions: 0,
      })
      setRows(payload.records)
      setTotal(payload.pagination?.total || 0)
      setTotalPages(payload.pagination?.total_pages || 1)
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
      setError(err.response?.data?.message || 'Failed to load wallets.')
      setRows([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, page])

  useEffect(() => {
    fetchWallets()
    return () => abortRef.current?.abort?.()
  }, [fetchWallets])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery.search, debouncedQuery.status, debouncedQuery.currency_code])

  const stats = useMemo(() => ({
    totalWallets: Number(summary.total_wallets || 0),
    totalValue: summary.total_value || '0',
    activeWallets: Number(summary.active_wallets || 0),
    pendingTransactions: Number(summary.pending_transactions || 0),
  }), [summary])

  const totalValueDisplay = useMemo(() => {
    const value = Number(stats.totalValue)
    if (!Number.isFinite(value)) return '--'
    return formatCurrency(value, 'NGN')
  }, [stats.totalValue])

  const handleWalletRowClick = useCallback(
    async (row) => {
      if (!walletRowIsNavigable(row)) return

      const rowKey = `${row.owner_type}-${row.owner_key}-${row.wallet_key}`
      setNavigatingKey(rowKey)
      setNavError(null)

      try {
        const result = await resolveWalletRowNavigation(row)
        if ('error' in result) {
          setNavError(result.error)
          return
        }
        navigate(result.path, {
          state: result.walletKey ? { walletKey: result.walletKey } : undefined,
        })
      } catch {
        setNavError('Could not open profile for this wallet.')
      } finally {
        setNavigatingKey(null)
      }
    },
    [navigate]
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Wallets</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage and monitor merchant and customer wallets across multiple currencies.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 sm:gap-6">
        <MetricCard
          label="Total Wallets"
          value={formatNumber(stats.totalWallets)}
          icon={Wallet}
          iconColor="accent"
          comparison={null}
        />
        <MetricCard
          label="Total Value"
          value={totalValueDisplay}
          icon={WalletCards}
          iconColor="info"
          comparison={null}
        />
        <MetricCard
          label="Active Wallets"
          value={formatNumber(stats.activeWallets)}
          icon={Activity}
          iconColor="success"
          comparison={null}
        />
        <MetricCard
          label="Pending Transactions"
          value={formatNumber(stats.pendingTransactions)}
          icon={Activity}
          iconColor="warning"
          comparison={null}
        />
      </div>

      <div className="mt-6 card-shell">
        {navError ? (
            <div className="border-b border-error/30 bg-error-bg px-4 py-3 text-sm text-error">{navError}</div>
        ) : null}
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-base font-medium text-text-primary">All Wallets</h3>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 sm:min-w-[200px] sm:max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search wallets..."
                className="h-9 w-full rounded-lg border border-border bg-page pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full shrink-0 rounded-lg border border-border bg-page px-3 text-sm text-text-secondary outline-none focus:border-accent/50 sm:w-auto"
            >
              <option value="">All Status</option>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <input
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              placeholder="Currency (e.g. NGN)"
              className="h-9 w-full shrink-0 rounded-lg border border-border bg-page px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50 sm:w-44"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-sm text-error">{error}</div>
        ) : (
          <div className="table-scroll">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-card-hover/30">
                  <th className="px-4 py-3 text-xs font-medium text-text-muted">Owner</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted">Wallet ID</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted">Balance</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted">Currency</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted">Date Created</th>
                  <th className="px-4 py-3 text-xs font-medium text-text-muted">Environment</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((row) => {
                    const rowKey = `${row.owner_type}-${row.owner_key}-${row.wallet_key}`
                    const navigable = walletRowIsNavigable(row)
                    const isNavigating = navigatingKey === rowKey
                    return (
                      <tr
                        key={rowKey}
                        role={navigable ? 'button' : undefined}
                        tabIndex={navigable ? 0 : undefined}
                        onClick={navigable ? () => handleWalletRowClick(row) : undefined}
                        onKeyDown={
                          navigable
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  handleWalletRowClick(row)
                                }
                              }
                            : undefined
                        }
                        className={cn(
                          'border-b border-border/40 transition-colors',
                          navigable &&
                            'cursor-pointer hover:bg-card-hover/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent/50',
                          isNavigating && 'opacity-60'
                        )}
                        aria-busy={isNavigating || undefined}
                      >
                        <td className="px-4 py-2.5">
                          <p className="text-text-primary">{row.owner_name || '--'}</p>
                          <p className="text-[11px] text-text-muted capitalize">{row.owner_type}</p>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">
                          {row.wallet_key || row.wallet_id || '--'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-text-secondary">
                          {row.current_balance != null
                            ? formatNumber(Number(row.current_balance))
                            : '--'}
                        </td>
                        <td className="px-4 py-2.5 text-text-secondary">{row.currency_code || '--'}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-3 py-0.5 text-[11px] font-medium',
                              row.status === 'active'
                                ? 'bg-success-bg text-success'
                                : 'bg-card-hover text-text-muted'
                            )}
                          >
                            {row.status || '--'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">
                          {row.date_created ? formatDate(row.date_created) : '--'}
                        </td>
                        <td className="px-4 py-2.5 text-text-secondary">{row.environment || '--'}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">
                      No wallets found. Try a broader search.
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
          label="Wallets"
          onPageChange={setPage}
        />
      </div>
    </div>
  )
}
