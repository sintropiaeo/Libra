import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Phone, Mail, MapPin, FileText } from 'lucide-react'

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(v)

export default async function ProveedorDetallePage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const [{ data: proveedor }, { data: comprasRaw }] = await Promise.all([
    supabase
      .from('proveedores')
      .select('id, nombre, telefono, email, direccion, notas, activo, created_at')
      .eq('id', params.id)
      .single(),
    supabase
      .from('compras_proveedor')
      .select(`
        id, fecha, total, notas,
        compra_items (
          id, cantidad, precio_unitario, subtotal,
          productos ( nombre, unidad )
        )
      `)
      .eq('proveedor_id', params.id)
      .order('fecha', { ascending: false })
      .limit(100),
  ])

  if (!proveedor) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compras = (comprasRaw as any[]) ?? []

  const totalCompras = compras.reduce((s: number, c: any) => s + Number(c.total), 0)

  return (
    <div className="p-8 max-w-3xl">

      {/* Volver */}
      <Link
        href="/proveedores"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a proveedores
      </Link>

      {/* Info del proveedor */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{proveedor.nombre}</h1>
            <span
              className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                proveedor.activo
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {proveedor.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">
              Total comprado
            </p>
            <p className="text-2xl font-bold text-slate-900">{ARS(totalCompras)}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {compras.length} {compras.length === 1 ? 'compra' : 'compras'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {proveedor.telefono && (
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              {proveedor.telefono}
            </div>
          )}
          {proveedor.email && (
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              {proveedor.email}
            </div>
          )}
          {proveedor.direccion && (
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              {proveedor.direccion}
            </div>
          )}
          {proveedor.notas && (
            <div className="flex items-start gap-2 text-slate-600 sm:col-span-2">
              <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              {proveedor.notas}
            </div>
          )}
        </div>
      </div>

      {/* Historial de compras */}
      <h2 className="text-sm font-semibold text-slate-700 mb-3">
        Historial de compras
      </h2>

      {compras.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-14 text-center">
          <p className="text-sm font-medium text-slate-500 mb-1">Sin compras registradas</p>
          <p className="text-xs text-slate-400">Las compras a este proveedor aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {compras.map((compra: any) => {
            const items = compra.compra_items as {
              id: string
              cantidad: number
              precio_unitario: number
              subtotal: number
              productos: { nombre: string; unidad: string } | null
            }[]

            return (
              <div key={compra.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Cabecera compra */}
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono text-slate-400 mb-0.5">
                      #{compra.id.slice(-8).toUpperCase()}
                    </p>
                    <p className="text-sm text-slate-600">
                      {new Date(compra.fecha).toLocaleString('es-AR', {
                        day:    '2-digit',
                        month:  '2-digit',
                        year:   'numeric',
                        hour:   '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {compra.notas && (
                      <p className="text-xs text-slate-400 mt-0.5">{compra.notas}</p>
                    )}
                  </div>
                  <span className="text-lg font-bold text-slate-900">
                    {ARS(Number(compra.total))}
                  </span>
                </div>

                {/* Ítems */}
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-2.5 text-slate-700">
                          {item.productos?.nombre ?? 'Producto eliminado'}
                        </td>
                        <td className="px-5 py-2.5 text-slate-500 text-right whitespace-nowrap">
                          {item.cantidad} {item.productos?.unidad ?? ''}
                        </td>
                        <td className="px-5 py-2.5 text-slate-500 text-right whitespace-nowrap">
                          {ARS(item.precio_unitario)}
                        </td>
                        <td className="px-5 py-2.5 font-semibold text-slate-800 text-right whitespace-nowrap">
                          {ARS(item.subtotal ?? item.precio_unitario * item.cantidad)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
