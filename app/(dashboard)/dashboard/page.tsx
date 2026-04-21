import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { tieneAcceso } from '@/lib/permisos'
import type { Perfil } from '@/lib/permisos'
import { ShoppingCart, AlertTriangle, Package, Lock, Unlock } from 'lucide-react'

export const metadata = { title: 'Dashboard — Libra' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(v)

const METODO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  efectivo:      { label: 'Efectivo',      color: 'text-emerald-700', bg: 'bg-emerald-100' },
  transferencia: { label: 'Transferencia', color: 'text-blue-700',    bg: 'bg-blue-100'    },
  debito:        { label: 'Débito',        color: 'text-violet-700',  bg: 'bg-violet-100'  },
  credito:       { label: 'Crédito',       color: 'text-amber-700',   bg: 'bg-amber-100'   },
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfilData } = await supabase
    .from('perfiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const perfil = perfilData as Perfil | null

  if (!tieneAcceso(perfil, 'dashboard')) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <p className="text-slate-700 font-medium">Sin acceso al Dashboard</p>
          <p className="text-slate-400 text-sm">Tu rol no tiene permiso para ver esta sección.</p>
        </div>
      </div>
    )
  }

  // Inicio del día en Argentina (UTC-3, sin DST)
  const hoyLocal    = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const hoyStartUTC = new Date(`${hoyLocal}T03:00:00.000Z`)

  const [ventasRes, productosRes, arqueoRes] = await Promise.all([
    supabase
      .from('ventas')
      .select(`
        id, total, metodo_pago,
        venta_items ( cantidad, productos ( nombre ) )
      `)
      .gte('fecha', hoyStartUTC.toISOString()),
    supabase
      .from('productos')
      .select('id, nombre, stock_actual, stock_minimo, unidad, categorias ( nombre )')
      .eq('activo', true),
    supabase
      .from('arqueos_caja')
      .select('monto_inicial, fecha_apertura')
      .eq('estado', 'abierta')
      .limit(1)
      .maybeSingle(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ventas: any[] = ventasRes.data ?? []
  const totalHoy    = ventas.reduce((s, v) => s + Number(v.total), 0)
  const cantidadHoy = ventas.length

  // Desglose por método de pago
  const porMetodo: Record<string, { total: number; cantidad: number }> = {}
  for (const v of ventas) {
    const m = v.metodo_pago as string
    if (!porMetodo[m]) porMetodo[m] = { total: 0, cantidad: 0 }
    porMetodo[m].total    += Number(v.total)
    porMetodo[m].cantidad += 1
  }

  // Top 5 productos vendidos hoy (agrupado por nombre)
  const productoMap: Record<string, number> = {}
  for (const v of ventas) {
    for (const item of (v.venta_items ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nombre = (item.productos as any)?.nombre ?? 'Desconocido'
      productoMap[nombre] = (productoMap[nombre] ?? 0) + Number(item.cantidad)
    }
  }
  const top5 = Object.entries(productoMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Stock bajo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stockBajo = ((productosRes.data ?? []) as any[])
    .filter((p) => p.stock_actual < p.stock_minimo)
    .sort((a, b) => (a.stock_actual - a.stock_minimo) - (b.stock_actual - b.stock_minimo))

  const arqueo = arqueoRes.data

  const fechaHoy = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  })

  return (
    <div className="p-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5 capitalize">{fechaHoy}</p>
      </div>

      {/* Stats principales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Ventas hoy */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Ventas hoy</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{ARS(totalHoy)}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {cantidadHoy === 0
                ? 'Sin transacciones'
                : `${cantidadHoy} ${cantidadHoy === 1 ? 'venta' : 'ventas'}`}
            </p>
          </div>
        </div>

        {/* Estado de caja */}
        <div className={`bg-white rounded-xl border p-5 flex items-start gap-4 ${arqueo ? 'border-emerald-200' : 'border-slate-200'}`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${arqueo ? 'bg-emerald-100' : 'bg-slate-100'}`}>
            {arqueo
              ? <Unlock className="w-5 h-5 text-emerald-600" />
              : <Lock   className="w-5 h-5 text-slate-400"   />
            }
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Caja</p>
            <p className={`text-xl font-bold mt-0.5 ${arqueo ? 'text-emerald-700' : 'text-slate-400'}`}>
              {arqueo ? 'Abierta' : 'Cerrada'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {arqueo
                ? `Inicial: ${ARS(Number(arqueo.monto_inicial))}`
                : 'Sin turno activo'}
            </p>
          </div>
        </div>

        {/* Stock bajo */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${stockBajo.length > 0 ? 'bg-red-100' : 'bg-slate-100'}`}>
            <AlertTriangle className={`w-5 h-5 ${stockBajo.length > 0 ? 'text-red-500' : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Stock bajo</p>
            <p className={`text-xl font-bold mt-0.5 ${stockBajo.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {stockBajo.length}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {stockBajo.length === 0
                ? 'Todo en orden'
                : `${stockBajo.length === 1 ? 'producto' : 'productos'} por reponer`}
            </p>
          </div>
        </div>
      </div>

      {/* Desglose métodos + Top productos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Cobros por método */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Cobros de hoy por método</h2>
          {Object.keys(porMetodo).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-slate-400">Todavía no hay ventas hoy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(porMetodo).map(([metodo, data]) => {
                const cfg = METODO_CFG[metodo] ?? { label: metodo, color: 'text-slate-700', bg: 'bg-slate-100' }
                return (
                  <div key={metodo} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        {data.cantidad} {data.cantidad === 1 ? 'venta' : 'ventas'}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{ARS(data.total)}</span>
                  </div>
                )
              })}
              <div className="pt-2 border-t border-slate-100 flex justify-between">
                <span className="text-xs font-medium text-slate-500">Total</span>
                <span className="text-sm font-bold text-slate-900">{ARS(totalHoy)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Top 5 productos */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Productos más vendidos hoy</h2>
          {top5.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">Sin ventas registradas hoy</p>
            </div>
          ) : (
            <ol className="space-y-3">
              {top5.map(([nombre, cantidad], i) => (
                <li key={nombre} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-slate-700 truncate">{nombre}</span>
                  <span className="text-sm font-semibold text-slate-900 shrink-0">{cantidad} u.</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Alertas de stock bajo (detalle) */}
      {stockBajo.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-5">
          <h2 className="text-sm font-semibold text-red-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Alertas de stock bajo ({stockBajo.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {stockBajo.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between bg-red-50 rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.nombre}</p>
                  <p className="text-xs text-slate-400">{p.categorias?.nombre ?? '—'}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-semibold text-red-600">{p.stock_actual} {p.unidad}</p>
                  <p className="text-xs text-slate-400">mín. {p.stock_minimo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
