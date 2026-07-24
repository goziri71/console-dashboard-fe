import { useCallback, useEffect, useState } from 'react'
import Pagination from '../../components/ui/Pagination'
import { formatBalance, formatDate } from '../../lib/utils'

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
  if (Array.isArray(inner.items)) return inner.items
  if (Array.isArray(inner)) return inner
  return []
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    if (obj?.[k] != null && obj[k] !== '') return obj[k]
  }
  return ''
}

/**
 * Generic paginated list for merchant settlements / ledgers.
 */
export default function MerchantResourceListPanel({
  title,
  description,
  accountKey,
  fetcher,
  financial,
  emptyLabel = 'No records found.',
}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setPage(1)
  }, [accountKey])

  const load = useCallback(async () => {
    if (!accountKey || !fetcher) return
    setLoading(true)
    setError('')
    try {
      const res = await fetcher(accountKey, { page, limit: LIMIT })
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
      setError(err.response?.data?.message || `Failed to load ${title.toLowerCase()}.`)
      setRows([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [accountKey, fetcher, page, title])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="overflow-hidden rounded-card border border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-base font-medium text-text-primary">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        ) : null}
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
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-card-hover text-xs text-text-muted">
                <tr>
                  <th className="px-3 py-3 font-medium">Reference</th>
                  <th className="px-3 py-3 font-medium">Currency</th>
                  <th className="px-3 py-3 font-medium">Amount</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row, i) => {
                    const currency = String(
                      pickFirst(row, ['currency_code', 'currency', 'asset_code']) || 'NGN'
                    ).toUpperCase()
                    const amountRaw = pickFirst(row, [
                      'amount',
                      'settlement_amount',
                      'value',
                      'gross_amount',
                      'net_amount',
                    ])
                    return (
                      <tr
                        key={
                          pickFirst(row, ['reference', 'settlement_reference', 'ledger_key', 'id']) ||
                          i
                        }
                        className="border-t border-border/60"
                      >
                        <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">
                          {pickFirst(row, [
                            'reference',
                            'settlement_reference',
                            'ledger_key',
                            'id',
                          ]) || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-text-primary">{currency}</td>
                        <td className="px-3 py-2.5 tabular-nums text-text-secondary">
                          {financial && amountRaw !== ''
                            ? formatBalance(amountRaw, currency)
                            : financial
                              ? '—'
                              : 'Hidden'}
                        </td>
                        <td className="px-3 py-2.5 capitalize text-text-secondary">
                          {pickFirst(row, ['status', 'settlement_status']) || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-text-muted">
                          {(() => {
                            const d = pickFirst(row, [
                              'date_created',
                              'created_at',
                              'date_modified',
                              'settlement_date',
                            ])
                            return d ? formatDate(d) : '—'
                          })()}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center text-sm text-text-muted">
                      {emptyLabel}
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
            label={title.toLowerCase()}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
