import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'

function formatYAxis(value) {
  if (value >= 1000000) return `${value / 1000000}M`
  if (value >= 1000) return `${value / 1000}K`
  return value
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-text-primary">{label}</p>
      <p className="text-xs text-accent">
        {new Intl.NumberFormat('en-NG').format(payload[0].value)}
      </p>
    </div>
  )
}

export default function CurrencyUsageChart({ data }) {
  if (!data || data.length === 0) return null

  const chartData = data.map((item) => ({
    currency: item.currency_code,
    amount: parseFloat(item.total_volume || item.wallet_count || 0),
  }))

  const maxVal = Math.max(...chartData.map((d) => d.amount))
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal || 1)))
  const ceilMax = Math.ceil(maxVal / magnitude) * magnitude
  const step = Math.ceil(ceilMax / 5)
  const ticks = Array.from({ length: 6 }, (_, i) => i * step)

  return (
    <div className="h-full rounded-card border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-base font-medium text-text-primary">Customer Currency Usage</h3>
      </div>
      <div className="p-3">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid
              strokeDasharray="0"
              stroke="#1E2530"
              vertical={true}
              horizontal={true}
            />
            <XAxis
              dataKey="currency"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8B8F97', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={formatYAxis}
              tick={{ fill: '#8B8F97', fontSize: 12 }}
              domain={[0, ceilMax]}
              ticks={ticks}
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Legend
              formatter={() => <span style={{ color: '#8B8F97', fontSize: 12 }}>Currencies</span>}
              iconType="square"
              iconSize={12}
            />
            <Bar
              dataKey="amount"
              name="Currencies"
              fill="#C8E64A"
              radius={[4, 4, 0, 0]}
              maxBarSize={80}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
