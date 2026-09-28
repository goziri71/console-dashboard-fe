import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet, LoaderCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { downloadReportCsv } from '../../lib/reportDownload'
import {
  REPORT_DEFINITIONS,
  canExportReport,
  reportById,
  requiredPermissionLabel,
  unwrapReportPayload,
} from '../../lib/reportsCatalog'
import { canReadConsole, canReadFinancial } from '../../lib/permissions'
import { cn, formatNumber } from '../../lib/utils'
import { fetchReportJson } from '../../services/reports'

const GROUP_LABELS = {
  reports: 'Financial reports',
  growth: 'Growth exports',
  compliance: 'Compliance',
}

const DEFAULT_LIMIT = '500'

function inputClassName() {
  return 'w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent/50'
}

function labelClassName() {
  return 'mb-1 block text-xs font-medium text-text-secondary'
}

function buildQuery(form, report) {
  const q = {
    from_date: form.from_date,
    to_date: form.to_date,
    account_key: form.account_key,
    identifier: form.identifier,
    currency_code: form.currency_code,
    status: form.status,
    search: form.search,
    wallet_key: form.wallet_key,
    limit: form.limit || DEFAULT_LIMIT,
  }
  if (report.extraParams?.includes('scope')) {
    q.scope = form.scope || 'all'
  }
  if (report.extraParams?.includes('window_ms')) {
    q.window_ms = form.window_ms || '1000'
  }
  if (report.extraParams?.includes('min_amount')) {
    q.min_amount = form.min_amount || '1000000'
  }
  return q
}

function SummaryBlock({ summary }) {
  const entries = Object.entries(summary || {})
  if (!entries.length) return null
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <p className="mb-3 text-sm font-medium text-text-primary">Summary</p>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-lg bg-page px-3 py-2">
            <dt className="text-xs text-text-muted">{key.replace(/_/g, ' ')}</dt>
            <dd className="text-sm font-medium text-text-primary">
              {typeof value === 'number' ? formatNumber(value) : String(value ?? '—')}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function PreviewTable({ rows }) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
        No rows in this preview. Adjust filters or run the report again.
      </p>
    )
  }

  const columns = Object.keys(rows[0]).slice(0, 12)
  return (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <table className="min-w-full text-left text-xs">
        <thead className="border-b border-border bg-card text-text-secondary">
          <tr>
            {columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-3 py-2.5 font-medium">
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row, idx) => (
            <tr key={idx} className="border-b border-border/50 last:border-0">
              {columns.map((col) => (
                <td key={col} className="max-w-[220px] truncate px-3 py-2 text-text-primary">
                  {row[col] == null ? '—' : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 ? (
        <p className="border-t border-border px-3 py-2 text-xs text-text-muted">
          Showing first 50 of {rows.length} rows returned (server cap 5000).
        </p>
      ) : null}
    </div>
  )
}

export default function ReportsPage() {
  const { user } = useAuth()
  const permissions = user?.permissions
  const canFinancial = canReadFinancial(permissions)
  const canConsole = canReadConsole(permissions)

  const [reportId, setReportId] = useState(REPORT_DEFINITIONS[0].id)
  const report = useMemo(() => reportById(reportId), [reportId])

  const [form, setForm] = useState({
    from_date: '',
    to_date: '',
    account_key: '',
    identifier: '',
    currency_code: '',
    status: '',
    search: '',
    wallet_key: '',
    limit: DEFAULT_LIMIT,
    scope: 'all',
    window_ms: '1000',
    min_amount: '1000000',
  })

  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const canCsv = canExportReport(report, { canFinancial, canConsole })
  const permLabel = requiredPermissionLabel(report)

  const groupedReports = useMemo(() => {
    const groups = { reports: [], growth: [], compliance: [] }
    for (const def of REPORT_DEFINITIONS) {
      groups[def.group].push(def)
    }
    return groups
  }, [])

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const runPreview = async () => {
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const payload = await fetchReportJson(report.path, buildQuery(form, report))
      const parsed = unwrapReportPayload(payload)
      setRows(parsed.rows)
      setSummary(parsed.summary)
      if (!canFinancial && report.permission === 'financial') {
        setNotice(
          'Monetary fields may be redacted without financial.read. CSV export requires that permission.'
        )
      }
    } catch (err) {
      setRows([])
      setSummary(null)
      setError(err.response?.data?.message || err.message || 'Failed to load report.')
    } finally {
      setLoading(false)
    }
  }

  const runCsvExport = async () => {
    if (!canCsv) return
    setError('')
    setNotice('')
    setExporting(true)
    try {
      await downloadReportCsv(report.path, buildQuery(form, report), `${report.id}.csv`)
      setNotice('Download started.')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'CSV export failed.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Reports</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Preview JSON or export CSV for operational, growth, and compliance datasets.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="space-y-4 rounded-card border border-border/70 bg-card p-4">
          <div>
            <label htmlFor="report-type" className={labelClassName()}>
              Report
            </label>
            <select
              id="report-type"
              value={reportId}
              onChange={(e) => {
                setReportId(e.target.value)
                setRows([])
                setSummary(null)
                setError('')
                setNotice('')
              }}
              className={inputClassName()}
            >
              {Object.entries(groupedReports).map(([group, items]) =>
                items.length ? (
                  <optgroup key={group} label={GROUP_LABELS[group]}>
                    {items.map((def) => (
                      <option key={def.id} value={def.id}>
                        {def.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null
              )}
            </select>
            {report.description ? (
              <p className="mt-2 text-xs text-text-muted">{report.description}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="from_date" className={labelClassName()}>
                From
              </label>
              <input
                id="from_date"
                type="date"
                value={form.from_date}
                onChange={(e) => setField('from_date', e.target.value)}
                className={inputClassName()}
              />
            </div>
            <div>
              <label htmlFor="to_date" className={labelClassName()}>
                To
              </label>
              <input
                id="to_date"
                type="date"
                value={form.to_date}
                onChange={(e) => setField('to_date', e.target.value)}
                className={inputClassName()}
              />
            </div>
          </div>

          {report.extraParams?.includes('scope') ? (
            <div>
              <label htmlFor="scope" className={labelClassName()}>
                Customer scope
              </label>
              <select
                id="scope"
                value={form.scope}
                onChange={(e) => setField('scope', e.target.value)}
                className={inputClassName()}
              >
                <option value="all">All customers</option>
                <option value="active">Active customers</option>
              </select>
            </div>
          ) : null}

          {report.extraParams?.includes('window_ms') ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="window_ms" className={labelClassName()}>
                  Window (ms)
                </label>
                <input
                  id="window_ms"
                  type="number"
                  min={1}
                  value={form.window_ms}
                  onChange={(e) => setField('window_ms', e.target.value)}
                  className={inputClassName()}
                />
              </div>
              <div>
                <label htmlFor="min_amount" className={labelClassName()}>
                  Min amount
                </label>
                <input
                  id="min_amount"
                  type="number"
                  min={0}
                  value={form.min_amount}
                  onChange={(e) => setField('min_amount', e.target.value)}
                  className={inputClassName()}
                />
              </div>
            </div>
          ) : null}

          <details className="rounded-xl border border-border/60 bg-page/40 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-text-secondary">
              Scope filters
            </summary>
            <div className="mt-3 space-y-3">
              {[
                ['account_key', 'Account key'],
                ['identifier', 'Customer identifier'],
                ['wallet_key', 'Wallet key'],
                ['currency_code', 'Currency'],
                ['status', 'Status'],
                ['search', 'Search'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={key} className={labelClassName()}>
                    {label}
                  </label>
                  <input
                    id={key}
                    type="text"
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    className={inputClassName()}
                  />
                </div>
              ))}
              <div>
                <label htmlFor="limit" className={labelClassName()}>
                  Row limit (max 5000)
                </label>
                <input
                  id="limit"
                  type="number"
                  min={1}
                  max={5000}
                  value={form.limit}
                  onChange={(e) => setField('limit', e.target.value)}
                  className={inputClassName()}
                />
              </div>
            </div>
          </details>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={runPreview}
              disabled={loading}
              className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-page hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <LoaderCircle size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              {loading ? 'Loading…' : 'Preview JSON'}
            </button>
            <button
              type="button"
              onClick={runCsvExport}
              disabled={!canCsv || exporting}
              title={
                canCsv
                  ? 'Download CSV attachment'
                  : permLabel
                    ? `Requires ${permLabel}`
                    : undefined
              }
              className={cn(
                'flex min-h-11 items-center justify-center gap-2 rounded-full border text-sm font-semibold transition-colors',
                canCsv
                  ? 'border-accent text-accent hover:bg-accent/10'
                  : 'cursor-not-allowed border-border text-text-muted opacity-60'
              )}
            >
              {exporting ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <Download size={18} />
              )}
              {exporting ? 'Exporting…' : 'Download CSV'}
            </button>
          </div>

          {!canCsv && permLabel ? (
            <p className="text-xs text-text-muted">
              CSV export requires <code className="text-text-secondary">{permLabel}</code>.
            </p>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <FileSpreadsheet size={18} className="text-accent" />
            <span>
              {rows.length
                ? `${formatNumber(rows.length)} row${rows.length === 1 ? '' : 's'} loaded`
                : 'Run a preview to see results'}
            </span>
          </div>

          {error ? (
            <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-text-secondary">
              {notice}
            </p>
          ) : null}

          {report.hasSummary && summary ? <SummaryBlock summary={summary} /> : null}

          <PreviewTable rows={rows} />

          {report.id === 'transaction-anomalies' && rows.length > 0 ? (
            <p className="text-xs text-text-muted">
              Anomaly types: <code className="text-text-secondary">same_ticket_millisecond</code>,{' '}
              <code className="text-text-secondary">high_ticket</code>.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
