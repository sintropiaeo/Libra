'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart,
} from 'recharts'
import {
  TrendingUp, ShoppingCart, DollarSign, Percent,
  BarChart3, Calendar,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type VentaItem = {
  cantidad: number
  precio_unitario: number
  subtotal: number
  productos: { id: string; nombre: string; precio_costo: number } | null
}

type Venta = {
  id: string
  fecha: string
  total: number
  metodo_pago: string
  venta_items: VentaItem[]
}

type Periodo = 'hoy' | 'semana' | 'mes' | 'trimestre' | 'personalizado'

// ─── Constantes ───────────────────────────────────────────────────────────────

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(v)

const tickARS = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'hoy',          label: 'Hoy' },
  { value: 'semana',       label: 'Últimos 7 días' },
  { value: 'mes',          label: 'Este mes' },
  { value: 'trimestre',    label: 'Últimos 3 meses' },
  { value: 'personalizado', label: 'Personalizado' },
]

const METODO_COLOR: Record<string, string> = {
  efectivo:      '#10b981',
  transferencia: '#3b82f6',
  debito:        '#8b5cf6',
  credito:       '#f59e0b',
}

const METODO_LABEL: Record<string, string> = {
  efectivo:      'Efectivo',
  transferencia: 'Transferencia',
  debito:        'Débito',
  credito:       'Crédito',
}

// ─── Helpers de fechas ────────────────────────────────────────────────────────

function calcularRango(
  periodo: Periodo,
  customDesde: string,
  customHasta: string
): [Date, Date] {
  const hoy = new Date()
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999)

  switch (periodo) {
    case 'hoy': {
      return [new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()), hasta]
    }
    case 'semana': {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
      d.setDate(d.getDate() - 6)
      return [d, hasta]
    }
    case 'mes': {
      return [new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta]
    }
    case 'trimestre': {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
      d.setMonth(d.getMonth() - 3)
      return [d, hasta]
    }
    case 'personalizado': {
      if (customDesde && customHasta) {
        const [y1, m1, d1] = customDesde.split('-').map(Number)
        const [y2, m2, d2] = customHasta.split('-').map(Number)
        return [
          new Date(y1, m1 - 1, d1, 0, 0, 0),
          new Date(y2, m2 - 1, d2, 23, 59, 59, 999),
        ]
      }
      return [new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta]
    }
  }
}

/** Genera array de "YYYY-MM-DD" para cada día del rango */
function generarDias(desde: Date, hasta: Date): string[] {
  const dias: string[] = []
  const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate())
  const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate())
  while (d <= fin) {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    dias.push(`${d.getFullYear()}-${mm}-${dd}`)
    d.setDate(d.getDate() + 1)
  }
  return dias
}

function labelDia(fechaStr: string, diffDias: number): string {
  const [y, m, d] = fechaStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (diffDias <= 7) {
    return date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

// ─── Helpers de datos ─────────────────────────────────────────────────────────

type DayMap = Map<string, { total: number; costo: number; count: number }>

function buildDayMap(ventas: Venta[]): DayMap {
  const map: DayMap = new Map()
  ventas.forEach((v) => {
    const f = new Date(v.fecha)
    const mm = String(f.getMonth() + 1).padStart(2, '0')
    const dd = String(f.getDate()).padStart(2, '0')
    const key = `${f.getFullYear()}-${mm}-${dd}`
    const prev = map.get(key) ?? { total: 0, costo: 0, count: 0 }
    let costo = 0
    v.venta_items.forEach((item) => {
      if (item.productos) costo += Number(item.productos.precio_costo) * item.cantidad
    })
    map.set(key, {
      total: prev.total + Number(v.total),
      costo: prev.costo + costo,
      count: prev.count + 1,
    })
  })
  return map
}

type PuntoTiempo = { key: string; label: string; total: number; ganancia: number; transacciones: number }

function chartPorDia(dias: string[], map: DayMap, diffDias: number): PuntoTiempo[] {
  return dias.map((dia) => {
    const v = map.get(dia) ?? { total: 0, costo: 0, count: 0 }
    return {
      key:           dia,
      label:         labelDia(dia, diffDias),
      total:         v.total,
      ganancia:      v.total - v.costo,
      transacciones: v.count,
    }
  })
}

function chartPorSemana(dias: string[], map: DayMap): PuntoTiempo[] {
  const semanas: PuntoTiempo[] = []
  for (let i = 0; i < dias.length; i += 7) {
    const chunk = dias.slice(i, i + 7)
    const [y, m, d] = chunk[0].split('-').map(Number)
    const label = new Date(y, m - 1, d).toLocaleDateString('es-AR', {
      day: 'numeric', month: 'short',
    })
    let total = 0, costo = 0, count = 0
    chunk.forEach((dia) => {
      const v = map.get(dia)
      if (v) { total += v.total; costo += v.costo; count += v.count }
    })
    semanas.push({ key: chunk[0], label, total, ganancia: total - costo, transacciones: count })
  }
  return semanas
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ReportesCliente({ ventas }: { ventas: Venta[] }) {
  const [periodo,     setPeriodo]     = useState<Periodo>('mes')
  const [customDesde, setCustomDesde] = useState('')
  const [customHasta, setCustomHasta] = useState('')

  // ─── Rango activo ─────────────────────────────────────────────────────────
  const [desde, hasta] = useMemo(
    () => calcularRango(periodo, customDesde, customHasta),
    [periodo, customDesde, customHasta]
  )
  const diffDias = Math.ceil((hasta.getTime() - desde.getTime()) / 86_400_000) + 1

  // ─── Ventas del período ───────────────────────────────────────────────────
  const ventasFiltradas = useMemo(
    () => ventas.filter((v) => { const f = new Date(v.fecha); return f >= desde && f <= hasta }),
    [ventas, desde, hasta]
  )

  // ─── Métricas resumen ─────────────────────────────────────────────────────
  const metricas = useMemo(() => {
    const totalVentas = ventasFiltradas.reduce((s, v) => s + Number(v.total), 0)
    let costoTotal = 0
    ventasFiltradas.forEach((v) =>
      v.venta_items.forEach((item) => {
        if (item.productos) costoTotal += Number(item.productos.precio_costo) * item.cantidad
      })
    )
    const ganancia = totalVentas - costoTotal
    const margen   = totalVentas > 0 ? (ganancia / totalVentas) * 100 : 0
    return {
      totalVentas,
      transacciones:  ventasFiltradas.length,
      ticketPromedio: ventasFiltradas.length > 0 ? totalVentas / ventasFiltradas.length : 0,
      ganancia,
      costoTotal,
      margen,
    }
  }, [ventasFiltradas])

  // ─── Chart: tiempo ────────────────────────────────────────────────────────
  const chartTiempo = useMemo(() => {
    const dias = generarDias(desde, hasta)
    const map  = buildDayMap(ventasFiltradas)
    return diffDias > 31
      ? chartPorSemana(dias, map)
      : chartPorDia(dias, map, diffDias)
  }, [ventasFiltradas, desde, hasta, diffDias])

  // ─── Chart: top 10 productos ──────────────────────────────────────────────
  const chartProductos = useMemo(() => {
    const map = new Map<string, { nombre: string; cantidad: number; total: number }>()
    ventasFiltradas.forEach((v) =>
      v.venta_items.forEach((item) => {
        const id     = item.productos?.id ?? '__del__'
        const nombre = item.productos?.nombre ?? 'Producto eliminado'
        const sub    = Number(item.subtotal) || item.cantidad * item.precio_unitario
        const prev   = map.get(id) ?? { nombre, cantidad: 0, total: 0 }
        map.set(id, { nombre, cantidad: prev.cantidad + item.cantidad, total: prev.total + sub })
      })
    )
    // Orden descendente; recharts layout="vertical" pone data[0] arriba
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [ventasFiltradas])

  // ─── Chart: métodos de pago ───────────────────────────────────────────────
  const chartMetodos = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {}
    ventasFiltradas.forEach((v) => {
      if (!map[v.metodo_pago]) map[v.metodo_pago] = { count: 0, total: 0 }
      map[v.metodo_pago].count++
      map[v.metodo_pago].total += Number(v.total)
    })
    return Object.entries(map)
      .map(([metodo, d]) => ({
        name:   METODO_LABEL[metodo] ?? metodo,
        metodo,
        count:  d.count,
        total:  d.total,
      }))
      .sort((a, b) => b.total - a.total)
  }, [ventasFiltradas])

  const sinDatos = ventasFiltradas.length === 0

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
          <p className="text-slate-500 text-sm mt-0.5">Análisis de ventas y rentabilidad</p>
        </div>

        {/* Selector de período */}
        <div className="flex flex-wrap gap-1.5">
          {PERIODOS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPeriodo(value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                periodo === value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Rango personalizado */}
      {periodo === 'personalizado' && (
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-white rounded-xl border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-sm text-slate-600">Desde</span>
          <input
            type="date"
            value={customDesde}
            onChange={(e) => setCustomDesde(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-600">hasta</span>
          <input
            type="date"
            value={customHasta}
            onChange={(e) => setCustomHasta(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {customDesde && customHasta && (
            <span className="text-xs text-slate-400">
              {Math.ceil((new Date(customHasta).getTime() - new Date(customDesde).getTime()) / 86_400_000) + 1} días
            </span>
          )}
        </div>
      )}

      {/* Tarjetas de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Total ventas"
          value={ARS(metricas.totalVentas)}
          sub={`${metricas.transacciones} transacciones`}
          color="blue"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          label="Ticket promedio"
          value={ARS(metricas.ticketPromedio)}
          sub="por transacción"
          color="slate"
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <MetricCard
          label="Ganancia estimada"
          value={ARS(metricas.ganancia)}
          sub={`Costo: ${ARS(metricas.costoTotal)}`}
          color="emerald"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          label="Margen estimado"
          value={`${metricas.margen.toFixed(1)}%`}
          sub="ganancia / ventas"
          color="violet"
          icon={<Percent className="w-5 h-5" />}
        />
      </div>

      {/* Estado vacío */}
      {sinDatos ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Sin ventas en el período seleccionado</p>
          <p className="text-sm text-slate-400 mt-1">Probá cambiar el período o el rango de fechas</p>
        </div>
      ) : (
        <>

          {/* ── Chart: Ventas + Ganancia por tiempo ── */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700">
                Ventas por {diffDias > 31 ? 'semana' : 'día'}
              </h2>
              <div className="flex items-center gap-5 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2 rounded-sm bg-blue-600 inline-block" />
                  Ventas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-2 rounded-sm bg-emerald-400 inline-block opacity-60" />
                  Ganancia est.
                </span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={chartTiempo} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  interval={diffDias <= 7 ? 0 : 'preserveStartEnd'}
                />
                <YAxis
                  tickFormatter={tickARS}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const byKey = Object.fromEntries(payload.map((p) => [p.dataKey, p.value as number]))
                    return (
                      <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3 text-xs">
                        <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
                        <p className="text-blue-600">Ventas: <strong>{ARS(byKey.total ?? 0)}</strong></p>
                        <p className="text-emerald-600">Ganancia: <strong>{ARS(byKey.ganancia ?? 0)}</strong></p>
                        {(byKey.transacciones ?? 0) > 0 && (
                          <p className="text-slate-400 mt-1">{byKey.transacciones} transacc.</p>
                        )}
                      </div>
                    )
                  }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar
                  dataKey="total"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
                <Area
                  dataKey="ganancia"
                  fill="#10b981"
                  fillOpacity={0.2}
                  stroke="#10b981"
                  strokeWidth={2}
                  type="monotone"
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981' }}
                />
                {/* dataKey oculto para pasarlo al tooltip */}
                <Area dataKey="transacciones" fill="transparent" stroke="transparent" dot={false} activeDot={false} legendType="none" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* ── Row inferior: Top 10 productos + Métodos de pago ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Top 10 productos */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Top 10 productos más vendidos</h2>
              {chartProductos.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">Sin datos de productos</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, chartProductos.length * 32)}>
                  <BarChart
                    data={chartProductos}
                    layout="vertical"
                    margin={{ top: 0, right: 8, bottom: 0, left: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={tickARS}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      tickLine={false}
                      axisLine={false}
                      width={140}
                      tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 19) + '…' : v}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload as { nombre: string; total: number; cantidad: number }
                        return (
                          <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3 text-xs">
                            <p className="font-semibold text-slate-700 mb-1">{d.nombre}</p>
                            <p className="text-blue-600">Total: <strong>{ARS(d.total)}</strong></p>
                            <p className="text-slate-500">{d.cantidad} {d.cantidad === 1 ? 'unidad vendida' : 'unidades vendidas'}</p>
                          </div>
                        )
                      }}
                      cursor={{ fill: '#f8fafc' }}
                    />
                    <Bar
                      dataKey="total"
                      fill="#2563eb"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={22}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Métodos de pago */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Métodos de pago</h2>
              {chartMetodos.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">Sin datos</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={chartMetodos}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={88}
                        dataKey="total"
                        paddingAngle={2}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {chartMetodos.map((entry) => (
                          <Cell
                            key={entry.metodo}
                            fill={METODO_COLOR[entry.metodo] ?? '#94a3b8'}
                            stroke="none"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const d = payload[0].payload as { name: string; metodo: string; total: number; count: number }
                          const porcentaje = metricas.totalVentas > 0
                            ? ((d.total / metricas.totalVentas) * 100).toFixed(1)
                            : '0'
                          return (
                            <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3 text-xs">
                              <p className="font-semibold text-slate-700 mb-1">{d.name}</p>
                              <p style={{ color: METODO_COLOR[d.metodo] ?? '#94a3b8' }}>
                                Total: <strong>{ARS(d.total)}</strong> ({porcentaje}%)
                              </p>
                              <p className="text-slate-500">{d.count} transacciones</p>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Leyenda */}
                  <ul className="mt-1 space-y-2.5">
                    {chartMetodos.map((m) => {
                      const pct = metricas.totalVentas > 0
                        ? ((m.total / metricas.totalVentas) * 100).toFixed(1)
                        : '0'
                      return (
                        <li key={m.metodo} className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: METODO_COLOR[m.metodo] ?? '#94a3b8' }}
                          />
                          <span className="text-sm text-slate-600 flex-1">{m.name}</span>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-800">{ARS(m.total)}</p>
                            <p className="text-xs text-slate-400">{pct}% · {m.count} transacc.</p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

const CARD_STYLE: Record<string, { bg: string; icon: string }> = {
  blue:    { bg: 'bg-blue-100',    icon: 'text-blue-600'    },
  slate:   { bg: 'bg-slate-100',   icon: 'text-slate-600'   },
  emerald: { bg: 'bg-emerald-100', icon: 'text-emerald-600' },
  violet:  { bg: 'bg-violet-100',  icon: 'text-violet-600'  },
}

function MetricCard({
  label, value, sub, color, icon,
}: {
  label: string
  value: string
  sub: string
  color: string
  icon: React.ReactNode
}) {
  const { bg, icon: iconColor } = CARD_STYLE[color] ?? CARD_STYLE.slate
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${bg} ${iconColor} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5 truncate">{value}</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>
        </div>
      </div>
    </div>
  )
}
