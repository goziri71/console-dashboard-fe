import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, FileSpreadsheet, LoaderCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { downloadReportCsv } from '../../lib/reportDownload'
import {
  DEFAULT_REPORT_LIMIT,
  MAX_REPORT_LIMIT,
  PARAM_LABELS,
  REPORT_DEFINITIONS,
  buildReportQuery,
  canExportReport,
  previewColumnsForReport,
  reportById,
  reportSupportsParam,
  requiredPermissionLabel,
  scopeFilterKeysForReport,
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

function inputClassName() {
  return 'w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent/50'
}

function labelClassName() {
  return 'mb-1 block text-xs font-medium text-text-secondary'
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

function AnomalyLegend() {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 text-xs leading-relaxed text-text-secondary">
      <p className="mb-2 font-medium text-text-primary">Anomaly types</p>
      <ul className="list-disc space-y-2 pl-4">
        <li>
          <code className="text-text-primary">same_ticket_millisecond</code> — same customer, amount,
          and currency within the window, with a shared{' '}
          <strong>session_id</strong>, <strong>message</strong> (ticket text), or{' '}
          <strong>ip_address + account</strong>.
        </li>
        <li>
          <code className="text-text-primary">duplicate_amount_millisecond</code> — broad rule (same
          customer / amount / currency / ms) when no ticket anchor matched.
        </li>
        <li>
          <code className="text-text-primary">high_ticket</code> — amount ≥ min threshold on
          transfers or deposits.
        </li>
      </ul>
      <p className="mt-3 text-text-muted">
        Strict rows may include <code className="text-text-secondary">ticket_match</code>:{' '}
        <code className="text-text-secondary">session_id</code>,{' '}
        <code className="text-text-secondary">message</code>, or{' '}
        <code className="text-text-secondary">ip_address</code>.
      </p>
    </div>
  )
}

function PreviewTable({ reportId, rows }) {
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
        No rows in this preview. Adjust filters or run the report again.
      </p>
    )
  }

  const columns = previewColumnsForReport(reportId, rows)
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
          Showing first 50 of {rows.length} rows returned (server cap {MAX_REPORT_LIMIT}).
        </p>
      ) : null}
    </div>
  )
}

function initialReportId(searchParams) {
  const fromUrl = searchParams.get('report')
  if (fromUrl && REPORT_DEFINITIONS.some((r) => r.id === fromUrl)) return fromUrl
  return REPORT_DEFINITIONS[0].id
}

export default function ReportsPage() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const permissions = user?.permissions
  const canFinancial = canReadFinancial(permissions)
  const canConsole = canReadConsole(permissions)

  const [reportId, setReportId] = useState(() => initialReportId(searchParams))
  const report = useMemo(() => reportById(reportId), [reportId])

  useEffect(() => {
    const fromUrl = searchParams.get('report')
    if (!fromUrl || !REPORT_DEFINITIONS.some((r) => r.id === fromUrl)) return
    setReportId(fromUrl)
    setRows([])
    setSummary(null)
    setError('')
    setNotice('')
  }, [searchParams])

  const [form, setForm] = useState({
    from_date: '',
    to_date: '',
    account_key: '',
    identifier: '',
    currency_code: '',
    status: '',
    search: '',
    wallet_key: '',
    limit: String(DEFAULT_REPORT_LIMIT),
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
  const scopeFilters = useMemo(() => scopeFilterKeysForReport(report), [report])

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

  const query = useMemo(() => buildReportQuery(report, form), [report, form])

  const runPreview = async () => {
    setError('')
    setNotice('')
    setLoading(true)
    try {
      const payload = await fetchReportJson(report.path, query)
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
      await downloadReportCsv(report.path, query, `${report.id}.csv`)
      setNotice('Download started.')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'CSV export failed.')
    } finally {
      setExporting(false)
    }
  }

  const showDateRange =
    reportSupportsParam(report, 'from_date') || reportSupportsParam(report, 'to_date')

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

          {showDateRange ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {reportSupportsParam(report, 'from_date') ? (
                <div>
                  <label htmlFor="from_date" className={labelClassName()}>
                    {PARAM_LABELS.from_date}
                  </label>
                  <input
                    id="from_date"
                    type="datetime-local"
                    value={form.from_date}
                    onChange={(e) => setField('from_date', e.target.value)}
                    className={inputClassName()}
                  />
                </div>
              ) : null}
              {reportSupportsParam(report, 'to_date') ? (
                <div>
                  <label htmlFor="to_date" className={labelClassName()}>
                    {PARAM_LABELS.to_date}
                  </label>
                  <input
                    id="to_date"
                    type="datetime-local"
                    value={form.to_date}
                    onChange={(e) => setField('to_date', e.target.value)}
                    className={inputClassName()}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {reportSupportsParam(report, 'scope') ? (
            <div>
              <label htmlFor="scope" className={labelClassName()}>
                {PARAM_LABELS.scope}
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

          {reportSupportsParam(report, 'window_ms') ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="window_ms" className={labelClassName()}>
                  {PARAM_LABELS.window_ms}
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
              {reportSupportsParam(report, 'min_amount') ? (
                <div>
                  <label htmlFor="min_amount" className={labelClassName()}>
                    {PARAM_LABELS.min_amount}
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
              ) : null}
            </div>
          ) : null}

          {scopeFilters.length > 0 ? (
            <details className="rounded-xl border border-border/60 bg-page/40 px-3 py-2" open>
              <summary className="cursor-pointer text-xs font-medium text-text-secondary">
                Scope filters
              </summary>
              <div className="mt-3 space-y-3">
                {scopeFilters.map((key) => (
                  <div key={key}>
                    <label htmlFor={key} className={labelClassName()}>
                      {PARAM_LABELS[key] || key}
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
              </div>
            </details>
          ) : null}

          {reportSupportsParam(report, 'limit') ? (
            <div>
              <label htmlFor="limit" className={labelClassName()}>
                {PARAM_LABELS.limit}
              </label>
              <input
                id="limit"
                type="number"
                min={1}
                max={MAX_REPORT_LIMIT}
                value={form.limit}
                onChange={(e) => setField('limit', e.target.value)}
                className={inputClassName()}
              />
            </div>
          ) : null}

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

          {report.id === 'transaction-anomalies' ? <AnomalyLegend /> : null}

          {report.hasSummary && summary ? <SummaryBlock summary={summary} /> : null}

          <PreviewTable reportId={report.id} rows={rows} />
        </div>
      </div>
    </div>
  )
}
