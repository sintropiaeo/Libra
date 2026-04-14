'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface ChartData {
  dia: string
  total: number
  label: string
}

function formatARS(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function VentasChart({ data }: { data: ChartData[] }) {
  const hasData = data.some((d) => d.total > 0)

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-52 text-slate-400 text-sm">
        Sin ventas en los últimos 7 días
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={208}>
      <BarChart data={data} margin={{ top: 5, right: 8, bottom: 5, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(v) =>
            v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
          }
        />
        <Tooltip
          formatter={(value: number) => [formatARS(value), 'Total']}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
            fontSize: '12px',
            padding: '8px 12px',
          }}
          cursor={{ fill: '#f8fafc' }}
        />
        <Bar
          dataKey="total"
          fill="#2563eb"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
