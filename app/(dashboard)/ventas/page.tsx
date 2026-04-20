import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, TrendingUp } from 'lucide-react'

export const metadata = { title: 'Ventas — Libra' }

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(v)

const metodoLabel: Record<string, string> = {
  efectivo:      'Efectivo',
  transferencia: 'Transferencia',
  debito:        'Débito',
  credito:       'Crédito',
}

const metodoBadge: Record<string, string> = {
  efectivo:      'bg-emerald-100 text-emerald-700',
  transferencia: 'bg-blue-100 text-blue-700',
  debito:        'bg-violet-100 text-violet-700',
  credito:       'bg-amber-100 text-amber-700',
}

export default async function VentasPage() {
  const supabase = createClient()

  const { data: ventas } = await supabase
    .from('ventas')
    .select('id, numero_venta, fecha, total, metodo_pago, notas')
    .order('numero_venta', { ascending: false })
    .limit(300)

  // Stats del día
  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const ventasHoy = (ventas || []).filter(
    (v) => new Date(v.fecha) >= startToday
  )
  const totalHoy = ventasHoy.reduce((s, v) => s + Number(v.total), 0)

  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ventas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Historial de transacciones</p>
        </div>
        <Link
          href="/ventas/nueva"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva venta
        </Link>
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Ventas hoy</p>
            <p className="text-xl font-bold text-slate-900">{ARS(totalHoy)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-blue-600 font-bold text-sm">#</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Transacciones hoy</p>
            <p className="text-xl font-bold text-slate-900">{ventasHoy.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-slate-500 font-bold text-sm">∑</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total registros</p>
            <p className="text-xl font-bold text-slate-900">{(ventas || []).length}</p>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {!ventas || ventas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-slate-500 mb-1">No hay ventas registradas</p>
            <p className="text-xs text-slate-400 mb-4">Las ventas realizadas aparecerán aquí</p>
            <Link
              href="/ventas/nueva"
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Ir al punto de venta →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3.5 w-20">#</th>
                  <th className="px-5 py-3.5">Fecha y hora</th>
                  <th className="px-5 py-3.5">Método</th>
                  <th className="px-5 py-3.5">Notas</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ventas.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-bold text-slate-500 text-sm">
                        {v.numero_venta ? `#${String(v.numero_venta).padStart(3, '0')}` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {new Date(v.fecha).toLocaleString('es-AR', {
                        day:    '2-digit',
                        month:  '2-digit',
                        year:   'numeric',
                        hour:   '2-digit',
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
                    <td className="px-5 py-3.5 text-slate-400 text-xs max-w-xs truncate">
                      {v.notas || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                      {ARS(Number(v.total))}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/ventas/${v.id}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                      >
                        Ver detalle →
                      </Link>
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
