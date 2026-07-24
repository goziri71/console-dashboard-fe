import { useCallback, useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import Pagination from '../../components/ui/Pagination'
import { cn, formatBalance, formatDate } from '../../lib/utils'
import { getMerchantWallets } from '../../services/merchants'

const LIMIT = 20

function unwrap(payload) {
  if (payload == null) return null
  if (payload.data != null && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data
  }
  return payload
}

function pickRecords(res) {
  const inner = unwrap(res) ?? res ?? {}
  if (Array.isArray(inner.records)) return inner.records
  if (Array.isArray(inner.wallets)) return inner.wallets
  if (Array.isArray(inner)) return inner
  return []
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    if (obj?.[k] != null && obj[k] !== '') return obj[k]
  }
  return ''
}

export default function MerchantWalletsPanel({ accountKey, financial }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchWallets = useCallback(async () => {
    if (!accountKey) return
    setLoading(true)
    setError('')
    try {
      const res = await getMerchantWallets(accountKey, { page, limit: LIMIT })
      const records = pickRecords(res)
      const pag = unwrap(res)?.pagination || {}
      setRows(records)
      const t = Number(pag.total ?? records.length)
      setTotal(t)
      const tp = Number(pag.total_pages)
      setTotalPages(
        Number.isFinite(tp) && tp > 0 ? tp : Math.max(1, Math.ceil(t / LIMIT))
      )
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load merchant wallets.')
      setRows([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [accountKey, page])

  useEffect(() => {
    fetchWallets()
  }, [fetchWallets])

  return (
    <div className="overflow-hidden rounded-card border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-accent" />
          <h2 className="text-base font-medium text-text-primary">Merchant wallets</h2>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          Wallets owned by this merchant account.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <p className="py-12 text-center text-sm text-error">{error}</p>
      ) : (
        <>
          <div className="table-scroll p-2">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-card-hover text-xs text-text-muted">
                <tr>
                  <th className="px-3 py-3 font-medium">Wallet key</th>
                  <th className="px-3 py-3 font-medium">Currency</th>
                  <th className="px-3 py-3 font-medium">Balance</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((w, i) => {
                    const currency = String(
                      pickFirst(w, ['currency_code', 'currency', 'asset_code']) || 'NGN'
                    ).toUpperCase()
                    const balanceRaw = pickFirst(w, [
                      'available_balance',
                      'balance',
                      'closing_balance',
                      'ledger_balance',
                    ])
                    return (
                      <tr
                        key={pickFirst(w, ['wallet_key', 'wallet_id', 'id']) || i}
                        className="border-t border-border/60"
                      >
                        <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">
                          {pickFirst(w, ['wallet_key', 'wallet_id', 'id']) || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-text-primary">{currency}</td>
                        <td
                          className={cn(
                            'px-3 py-2.5 tabular-nums',
                            financial ? 'text-text-secondary' : 'text-text-muted'
                          )}
                        >
                          {financial && balanceRaw !== ''
                            ? formatBalance(balanceRaw, currency)
                            : financial
                              ? '—'
                              : 'Hidden'}
                        </td>
                        <td className="px-3 py-2.5 capitalize text-text-secondary">
                          {pickFirst(w, ['status', 'wallet_status']) || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-text-muted">
                          {(() => {
                            const d = pickFirst(w, ['date_modified', 'updated_at', 'date_created'])
                            return d ? formatDate(d) : '—'
                          })()}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center text-sm text-text-muted">
                      No wallets found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={LIMIT}
            label="wallets"
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
