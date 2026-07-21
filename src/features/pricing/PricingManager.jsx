import { useCallback, useEffect, useMemo, useState } from 'react'
import { History, Loader2, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import OverlayPortal from '../../components/ui/OverlayPortal'
import { cn, formatDate } from '../../lib/utils'
import {
  PRICING_FEE_TYPES,
  createDefaultFee,
  createMerchantFee,
  deleteDefaultFee,
  getDefaultFees,
  getFeeAudit,
  getMerchantFees,
  updateDefaultFee,
  updateMerchantFee,
} from '../../services/pricing'

const FEE_LABELS = {
  deposit: 'Deposit',
  payout: 'Payout',
  swap: 'Swap',
  transfer: 'Transfer',
  withdrawal: 'Withdrawal',
  overdraft_processing: 'Overdraft',
  wallet_maintenance: 'Wallet maintenance',
}

const EMPTY_FORM = {
  method: '',
  currency_code: 'NGN',
  charge_value: '0',
  charge_percentage: '0',
  charge_cap: '0',
  vat_include: 'N',
  is_enabled: 'Y',
}

function recordsFor(layer, feeType) {
  const source = layer?.data ?? layer ?? {}
  if (Array.isArray(source)) {
    return source.filter((row) => String(row?.fee_type || row?.type || '') === feeType)
  }
  if (Array.isArray(source?.records)) {
    return source.records.filter(
      (row) => String(row?.fee_type || row?.type || feeType) === feeType
    )
  }
  const value = source?.[feeType]
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.records)) return value.records
  if (value && typeof value === 'object') return [value]
  return []
}

function rowId(row) {
  return row?.id ?? row?.fee_id ?? row?.key
}

function matchKey(row, feeType) {
  const currency = String(row?.currency_code || '').toUpperCase()
  return feeType === 'deposit' || feeType === 'payout'
    ? `${String(row?.method || '').toLowerCase()}|${currency}`
    : currency
}

function toForm(row = {}) {
  return {
    method: String(row.method ?? ''),
    currency_code: String(row.currency_code ?? 'NGN').toUpperCase(),
    charge_value: String(row.charge_value ?? '0'),
    charge_percentage: String(row.charge_percentage ?? '0'),
    charge_cap: String(row.charge_cap ?? '0'),
    vat_include: String(row.vat_include ?? 'N').toUpperCase(),
    is_enabled: String(row.is_enabled ?? 'Y').toUpperCase(),
  }
}

function feeValue(value, suffix = '') {
  if (value == null || value === '') return '—'
  return `${value}${suffix}`
}

export default function PricingManager({
  accountKey,
  canView,
  canManage,
  defaultMode = false,
}) {
  const [payload, setPayload] = useState(null)
  const [feeType, setFeeType] = useState('deposit')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditRows, setAuditRows] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)

  const loadPricing = useCallback(async () => {
    if (!canView || (!defaultMode && !accountKey)) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      setPayload(defaultMode ? await getDefaultFees() : await getMerchantFees(accountKey))
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not load pricing.')
    } finally {
      setLoading(false)
    }
  }, [accountKey, canView, defaultMode])

  useEffect(() => {
    loadPricing()
  }, [loadPricing])

  const layers = useMemo(() => {
    if (defaultMode) {
      const defaults = payload?.defaults ?? payload
      return { effective: defaults, custom: defaults, defaults }
    }
    return {
      effective: payload?.effective,
      custom: payload?.custom,
      defaults: payload?.defaults,
    }
  }, [defaultMode, payload])

  const customRows = recordsFor(layers.custom, feeType)
  const defaultRows = recordsFor(layers.defaults, feeType)
  const effectiveRows = defaultMode ? defaultRows : recordsFor(layers.effective, feeType)

  const rows = useMemo(
    () =>
      effectiveRows.map((row) => {
        const matchingCustom = customRows.find(
          (candidate) =>
            matchKey(candidate, feeType) === matchKey(row, feeType) &&
            String(candidate.is_enabled ?? 'Y').toUpperCase() !== 'N'
        )
        return {
          ...row,
          _custom: defaultMode ? row : matchingCustom,
          _source: defaultMode || matchingCustom ? 'custom' : 'default',
        }
      }),
    [customRows, defaultMode, effectiveRows, feeType]
  )

  const openEditor = (row = null) => {
    const editable =
      !defaultMode && row?._source === 'default' ? null : row?._custom || row
    setEditor({
      row,
      record: editable,
      editing: Boolean(rowId(editable)),
      source: row?._source,
    })
    setForm(row ? toForm(row) : { ...EMPTY_FORM })
    setNotice('')
  }

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const save = async (event) => {
    event.preventDefault()
    if (!canManage) return
    if ((feeType === 'deposit' || feeType === 'payout') && !form.method.trim()) {
      setError('Method is required for deposit and payout pricing.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const body = {
        ...(feeType === 'deposit' || feeType === 'payout'
          ? { method: form.method.trim() }
          : {}),
        currency_code: form.currency_code.trim().toUpperCase(),
        charge_value: form.charge_value,
        charge_percentage: form.charge_percentage,
        charge_cap: form.charge_cap,
        vat_include: form.vat_include,
        is_enabled: form.is_enabled,
      }
      const id = rowId(editor?.record)
      const writeBody = { ...body }
      if (id) {
        delete writeBody.method
        delete writeBody.currency_code
      }
      if (defaultMode) {
        if (id) await updateDefaultFee(feeType, id, writeBody)
        else await createDefaultFee(feeType, body)
      } else if (id) {
        await updateMerchantFee(accountKey, feeType, id, writeBody)
      } else {
        await createMerchantFee(accountKey, feeType, body)
      }
      setEditor(null)
      setNotice('Pricing saved successfully.')
      await loadPricing()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not save pricing.')
    } finally {
      setSaving(false)
    }
  }

  const returnToDefault = async (row) => {
    const custom = row?._custom
    const id = rowId(custom)
    if (!id || !window.confirm('Disable this override and use the platform default?')) return
    setSaving(true)
    setError('')
    try {
      await updateMerchantFee(accountKey, feeType, id, { is_enabled: 'N' })
      setNotice('Custom pricing disabled. Platform default now applies.')
      await loadPricing()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not disable the override.')
    } finally {
      setSaving(false)
    }
  }

  const removeDefault = async (row) => {
    const id = rowId(row)
    if (!id || !window.confirm('Delete this platform default pricing record?')) return
    setSaving(true)
    try {
      await deleteDefaultFee(feeType, id)
      setNotice('Default pricing deleted.')
      await loadPricing()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not delete pricing.')
    } finally {
      setSaving(false)
    }
  }

  const openAudit = async () => {
    setAuditOpen(true)
    setAuditLoading(true)
    try {
      const result = await getFeeAudit({
        ...(accountKey ? { account_key: accountKey } : {}),
        fee_type: feeType,
        limit: 50,
        offset: 0,
      })
      setAuditRows(result?.records || result?.data?.records || result?.data || [])
    } catch {
      setAuditRows([])
    } finally {
      setAuditLoading(false)
    }
  }

  if (!canView) {
    return (
      <div className="rounded-card border border-warning/30 bg-warning-bg/20 p-5 text-sm text-text-secondary">
        You need the <code className="text-text-primary">pricing.read</code> permission to view pricing.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {defaultMode ? (
        <div className="rounded-card border border-warning/30 bg-warning-bg/20 p-4">
          <p className="text-sm font-medium text-text-primary">Platform-wide defaults</p>
          <p className="mt-1 text-sm text-text-secondary">
            Changes affect every merchant that does not have an active custom override.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-card border border-error/40 bg-error-bg px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-card border border-success/40 bg-success-bg px-4 py-3 text-sm text-success">
          {notice}
        </div>
      ) : null}

      <div className="card-shell">
        <div className="tab-scroll border-b border-border px-3 py-3">
          {PRICING_FEE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFeeType(type)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-sm',
                feeType === type
                  ? 'bg-accent text-page'
                  : 'bg-card-hover text-text-secondary hover:text-text-primary'
              )}
            >
              {FEE_LABELS[type]}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium text-text-primary">{FEE_LABELS[feeType]} pricing</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {defaultMode
                ? 'Configure the fallback price for this fee type.'
                : 'Effective pricing currently applied to this merchant.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openAudit}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-text-secondary hover:bg-card-hover"
            >
              <History size={15} />
              History
            </button>
            {canManage ? (
              <button
                type="button"
                onClick={() => openEditor()}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-page"
              >
                <Plus size={15} />
                Add pricing
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
            <Loader2 size={18} className="animate-spin" />
            Loading pricing…
          </div>
        ) : rows.length ? (
          <div className="table-scroll p-2">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-card-hover text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Match</th>
                  <th className="px-4 py-3 font-medium">Fixed</th>
                  <th className="px-4 py-3 font-medium">Percentage</th>
                  <th className="px-4 py-3 font-medium">Cap</th>
                  <th className="px-4 py-3 font-medium">VAT</th>
                  {!defaultMode ? <th className="px-4 py-3 font-medium">Source</th> : null}
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${matchKey(row, feeType)}-${rowId(row) ?? index}`}
                    className="border-t border-border/60"
                  >
                    <td className="px-4 py-3 text-text-primary">
                      <p>{row.currency_code || '—'}</p>
                      {feeType === 'deposit' || feeType === 'payout' ? (
                        <p className="text-xs capitalize text-text-muted">{row.method || '—'}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-text-secondary">
                      {feeValue(row.charge_value)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-text-secondary">
                      {feeValue(row.charge_percentage, '%')}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-text-secondary">
                      {feeValue(row.charge_cap)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {String(row.vat_include || 'N').toUpperCase() === 'Y' ? 'Included' : 'Excluded'}
                    </td>
                    {!defaultMode ? (
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-1 text-xs',
                            row._source === 'custom'
                              ? 'bg-accent/15 text-accent'
                              : 'bg-card-hover text-text-muted'
                          )}
                        >
                          {row._source === 'custom' ? 'Custom' : 'Platform default'}
                        </span>
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {canManage ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditor(row)}
                              className="rounded-lg p-2 text-text-muted hover:bg-card-hover hover:text-text-primary"
                              title={row._source === 'default' ? 'Create override' : 'Edit pricing'}
                            >
                              <Pencil size={15} />
                            </button>
                            {!defaultMode && row._source === 'custom' ? (
                              <button
                                type="button"
                                onClick={() => returnToDefault(row)}
                                disabled={saving}
                                className="rounded-lg p-2 text-text-muted hover:bg-card-hover hover:text-warning"
                                title="Return to platform default"
                              >
                                <RotateCcw size={15} />
                              </button>
                            ) : null}
                            {defaultMode ? (
                              <button
                                type="button"
                                onClick={() => removeDefault(row)}
                                disabled={saving}
                                className="rounded-lg p-2 text-text-muted hover:bg-card-hover hover:text-error"
                                title="Delete default"
                              >
                                <Trash2 size={15} />
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-text-muted">View only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-sm text-text-muted">
            No {FEE_LABELS[feeType].toLowerCase()} pricing configured.
          </div>
        )}
      </div>

      <OverlayPortal open={Boolean(editor)}>
        <div className="drawer-overlay" onClick={() => setEditor(null)} role="presentation">
          <div className="drawer-panel" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {editor?.editing ? 'Edit' : 'Add'} {FEE_LABELS[feeType].toLowerCase()} pricing
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {editor?.source === 'default'
                    ? 'This creates a custom override for the merchant.'
                    : 'Review the charge before saving.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="rounded-full p-2 text-text-muted hover:bg-card-hover"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={save} className="flex-1 space-y-4 overflow-y-auto p-6">
              {feeType === 'deposit' || feeType === 'payout' ? (
                <label className="block text-sm text-text-secondary">
                  Method
                  <input
                    value={form.method}
                    onChange={(event) => updateForm('method', event.target.value)}
                    disabled={editor?.editing}
                    placeholder="card"
                    className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-text-primary outline-none disabled:opacity-60"
                  />
                </label>
              ) : null}
              <label className="block text-sm text-text-secondary">
                Currency
                <input
                  value={form.currency_code}
                  onChange={(event) => updateForm('currency_code', event.target.value.toUpperCase())}
                  disabled={editor?.editing}
                  className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-text-primary outline-none disabled:opacity-60"
                />
              </label>
              {[
                ['charge_value', 'Fixed charge'],
                ['charge_percentage', 'Percentage charge'],
                ['charge_cap', 'Charge cap'],
              ].map(([key, label]) => (
                <label key={key} className="block text-sm text-text-secondary">
                  {label}
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={form[key]}
                    onChange={(event) => updateForm(key, event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-text-primary outline-none"
                  />
                </label>
              ))}
              <label className="block text-sm text-text-secondary">
                VAT
                <select
                  value={form.vat_include}
                  onChange={(event) => updateForm('vat_include', event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-text-primary outline-none"
                >
                  <option value="N">Excluded</option>
                  <option value="Y">Included</option>
                </select>
              </label>
              <label className="block text-sm text-text-secondary">
                Status
                <select
                  value={form.is_enabled}
                  onChange={(event) => updateForm('is_enabled', event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-text-primary outline-none"
                >
                  <option value="Y">Enabled</option>
                  <option value="N">Disabled</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={saving}
                className="min-h-12 w-full rounded-full bg-accent font-semibold text-page disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save pricing'}
              </button>
            </form>
          </div>
        </div>
      </OverlayPortal>

      <OverlayPortal open={auditOpen}>
        <div className="drawer-overlay" onClick={() => setAuditOpen(false)} role="presentation">
          <div className="drawer-panel" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Pricing history</h2>
                <p className="mt-1 text-sm text-text-secondary">{FEE_LABELS[feeType]}</p>
              </div>
              <button
                type="button"
                onClick={() => setAuditOpen(false)}
                className="rounded-full p-2 text-text-muted hover:bg-card-hover"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {auditLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-accent" />
                </div>
              ) : auditRows.length ? (
                <div className="space-y-2">
                  {auditRows.map((row, index) => (
                    <div
                      key={row.id ?? index}
                      className="rounded-xl border border-border bg-card p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium capitalize text-text-primary">
                          {row.action || row.event || 'Pricing changed'}
                        </span>
                        <span className="text-xs text-text-muted">
                          {formatDate(row.date_created || row.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-text-secondary">
                        {row.actor_email || row.user_email || row.user_key || 'System'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-text-muted">No pricing history found.</p>
              )}
            </div>
          </div>
        </div>
      </OverlayPortal>
    </div>
  )
}
