import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2 } from 'lucide-react'

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(v)

export default async function CompraDetallePage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const { data: compra } = await supabase
    .from('compras_proveedor')
    .select(`
      id, fecha, total, notas, created_at,
      proveedores ( id, nombre ),
      compra_items (
        id, cantidad, precio_unitario, subtotal,
        productos ( nombre, unidad, codigo_barras )
      )
    `)
    .eq('id', params.id)
    .single()

  if (!compra) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (compra as any).compra_items as {
    id: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    productos: { nombre: string; unidad: string; codigo_barras: string | null } | null
  }[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proveedor = (compra as any).proveedores as { id: string; nombre: string } | null

  return (
    <div className="p-8 max-w-2xl">

      {/* Volver */}
      <Link
        href="/compras"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al historial
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs text-slate-400 font-mono mb-1">
              #{compra.id.slice(-8).toUpperCase()}
            </p>
            <h1 className="text-xl font-bold text-slate-900">Detalle de compra</h1>
          </div>
          {proveedor ? (
            <Link
              href={`/proveedores/${proveedor.id}`}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Building2 className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">{proveedor.nombre}</span>
            </Link>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Sin proveedor</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">
              Fecha y hora
            </p>
            <p className="text-slate-700">
              {new Date(compra.fecha).toLocaleString('es-AR', {
                weekday: 'long',
                day:     '2-digit',
                month:   'long',
                year:    'numeric',
                hour:    '2-digit',
                minute:  '2-digit',
              })}
            </p>
          </div>
          {compra.notas && (
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Notas</p>
              <p className="text-slate-700">{compra.notas}</p>
            </div>
          )}
        </div>
      </div>

      {/* Ítems */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            Productos ({items.length} {items.length === 1 ? 'ítem' : 'ítems'})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3 text-right">Cant.</th>
              <th className="px-5 py-3 text-right">P. Unit.</th>
              <th className="px-5 py-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-800">
                    {item.productos?.nombre ?? 'Producto eliminado'}
                  </p>
                  {item.productos?.codigo_barras && (
                    <p className="text-xs text-slate-400">#{item.productos.codigo_barras}</p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right text-slate-600">
                  {item.cantidad} {item.productos?.unidad ?? ''}
                </td>
                <td className="px-5 py-3.5 text-right text-slate-600">
                  {ARS(item.precio_unitario)}
                </td>
                <td className="px-5 py-3.5 text-right font-semibold text-slate-800">
                  {ARS(item.subtotal ?? item.precio_unitario * item.cantidad)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
        <span className="font-semibold text-slate-700">Total pagado</span>
        <span className="text-2xl font-bold text-slate-900">{ARS(Number(compra.total))}</span>
      </div>
    </div>
  )
}
