import { createClient } from '@/lib/supabase/server'
import VentasChart from '@/components/dashboard/ventas-chart'
import { TrendingUp, Package, AlertTriangle, ShoppingCart } from 'lucide-react'

export const metadata = { title: 'Dashboard — Libra' }

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Venta = {
  id: string
  fecha: string
  total: number
  metodo_pago: 'efectivo' | 'transferencia' | 'debito' | 'credito'
}

type Producto = {
  id: string
  nombre: string
  stock_actual: number
  stock_minimo: number
  unidad: string
  categorias: { nombre: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ARS = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value)

const metodoLabel: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  debito: 'Débito',
  credito: 'Crédito',
}

const metodoBadge: Record<string, string> = {
  efectivo: 'bg-emerald-100 text-emerald-700',
  transferencia: 'bg-blue-100 text-blue-700',
  debito: 'bg-violet-100 text-violet-700',
  credito: 'bg-amber-100 text-amber-700',
}

// ─── Fetch de datos ───────────────────────────────────────────────────────────

async function getDashboardData() {
  const supabase = createClient()
  const now = new Date()

  const startToday  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startMonth  = new Date(now.getFullYear(), now.getMonth(), 1)
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)

  const [
    { data: ventasHoyRaw },
    { data: ventasMesRaw },
    { data: productosRaw },
    { data: ultimasRaw },
    { data: semanaRaw },
  ] = await Promise.all([
    supabase.from('ventas').select('total').gte('fecha', startToday.toISOString()),
    supabase.from('ventas').select('total').gte('fecha', startMonth.toISOString()),
    supabase
      .from('productos')
      .select('id, nombre, stock_actual, stock_minimo, unidad, categorias(nombre)')
      .eq('activo', true),
    supabase
      .from('ventas')
      .select('id, fecha, total, metodo_pago')
      .order('fecha', { ascending: false })
      .limit(5),
    supabase
      .from('ventas')
      .select('fecha, total')
      .gte('fecha', sevenDaysAgo.toISOString()),
  ])

  // Stats
  const totalHoy    = (ventasHoyRaw  || []).reduce((s, v) => s + Number(v.total), 0)
  const cantidadHoy = ventasHoyRaw?.length ?? 0
  const totalMes    = (ventasMesRaw  || []).reduce((s, v) => s + Number(v.total), 0)
  const cantidadMes = ventasMesRaw?.length ?? 0
  const ticketProm  = cantidadMes > 0 ? totalMes / cantidadMes : 0

  // Stock bajo (filtramos en JS porque el SDK no compara columnas entre sí)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stockBajo = ((productosRaw || []) as any as Producto[])
    .filter((p) => p.stock_actual < p.stock_minimo)
    .sort((a, b) => (a.stock_actual - a.stock_minimo) - (b.stock_actual - b.stock_minimo))

  // Ventas últimas 5
  const ultimasVentas = (ultimasRaw || []) as Venta[]

  // Datos para el gráfico: 7 días con total 0 si no hay ventas
  const salesByDay: Record<string, number> = {}
  for (const v of semanaRaw || []) {
    const day = new Date(v.fecha).toLocaleDateString('en-CA')
    salesByDay[day] = (salesByDay[day] || 0) + Number(v.total)
  }

  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i))
    const key = d.toLocaleDateString('en-CA')
    return {
      dia: key,
      total: salesByDay[key] || 0,
      label: d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }),
    }
  })

  return { totalHoy, cantidadHoy, totalMes, cantidadMes, ticketProm, stockBajo, ultimasVentas, chartData }
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const {
    totalHoy, cantidadHoy,
    totalMes, cantidadMes,
    ticketProm,
    stockBajo,
    ultimasVentas,
    chartData,
  } = await getDashboardData()

  const fechaHoy = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const stats = [
    {
      label: 'Ventas hoy',
      value: ARS(totalHoy),
      sub: cantidadHoy === 0 ? 'Sin transacciones' : `${cantidadHoy} ${cantidadHoy === 1 ? 'transacción' : 'transacciones'}`,
      icon: ShoppingCart,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Ventas del mes',
      value: ARS(totalMes),
      sub: cantidadMes === 0 ? 'Sin ventas' : `${cantidadMes} ${cantidadMes === 1 ? 'venta' : 'ventas'}`,
      icon: TrendingUp,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Ticket promedio',
      value: ticketProm > 0 ? ARS(ticketProm) : '$0',
      sub: 'Por venta este mes',
      icon: Package,
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
    },
    {
      label: 'Stock bajo',
      value: stockBajo.length.toString(),
      sub: stockBajo.length === 0 ? 'Todo en orden' : `${stockBajo.length === 1 ? 'producto' : 'productos'} por reponer`,
      icon: AlertTriangle,
      iconBg: stockBajo.length > 0 ? 'bg-red-100' : 'bg-slate-100',
      iconColor: stockBajo.length > 0 ? 'text-red-500' : 'text-slate-400',
    },
  ]

  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5 capitalize">{fechaHoy}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(({ label, value, sub, icon: Icon, iconBg, iconColor }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico + Stock bajo */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Gráfico ventas 7 días */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Ventas — últimos 7 días</h2>
          <p className="text-xs text-slate-400 mb-4">Total por día</p>
          <VentasChart data={chartData} />
        </div>

        {/* Productos con stock bajo */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Stock bajo</h2>
          <p className="text-xs text-slate-400 mb-4">Por debajo del mínimo</p>

          {stockBajo.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                <Package className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-sm text-slate-500">Todos los productos tienen stock suficiente</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {stockBajo.slice(0, 7).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.nombre}</p>
                    <p className="text-xs text-slate-400">
                      {p.categorias?.nombre ?? '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-red-600">
                      {p.stock_actual} {p.unidad}
                    </p>
                    <p className="text-xs text-slate-400">mín. {p.stock_minimo}</p>
                  </div>
                </li>
              ))}
              {stockBajo.length > 7 && (
                <p className="text-xs text-slate-400 text-center pt-1">
                  +{stockBajo.length - 7} más
                </p>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Últimas ventas */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Últimas ventas</h2>
        </div>

        {ultimasVentas.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
            No hay ventas registradas aún
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3">Fecha y hora</th>
                  <th className="px-5 py-3">Método de pago</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ultimasVentas.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-slate-600">
                      {new Date(v.fecha).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          metodoBadge[v.metodo_pago] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {metodoLabel[v.metodo_pago] ?? v.metodo_pago}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-800">
                      {ARS(Number(v.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
