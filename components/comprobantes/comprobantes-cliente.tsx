'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Printer, SlidersHorizontal, Search, ChevronRight } from 'lucide-react'
import { generarHTMLTicket } from '@/lib/ticket'
import type { ConfiguracionTicket } from '@/lib/permisos'
import type { TipoComprobante, DatosCliente, PrintData } from '@/lib/ticket'
import { obtenerVentaDetalle } from '@/app/(dashboard)/comprobantes/actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Comprobante = {
  id:                 string
  numero_venta:       number | null
  fecha:              string
  total:              number
  metodo_pago:        string
  tipo_comprobante:   TipoComprobante
  numero_comprobante: string | null
  datos_cliente:      DatosCliente | null
}

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(v)

const TIPO_LABELS: Record<string, string> = {
  ticket:    'Ticket',
  factura_x: 'Factura X',
}

const METODO_LABELS: Record<string, string> = {
  efectivo:      'Efectivo',
  transferencia: 'Transferencia',
  debito:        'Débito',
  credito:       'Crédito',
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ComprobantesCliente({
  comprobantes,
  configTicket,
  negocioNombre,
  tamanoTicket,
  tipoFiltroInicial,
  desdeFiltroInicial,
  hastaFiltroInicial,
}: {
  comprobantes:       Comprobante[]
  configTicket:       ConfiguracionTicket | null
  negocioNombre:      string
  tamanoTicket:       '58mm' | '80mm'
  tipoFiltroInicial:  string
  desdeFiltroInicial: string | null
  hastaFiltroInicial: string | null
}) {
  const router = useRouter()
  const [reimprimiendo, setReimprimiendo] = useState<string | null>(null)

  // ─── Filtros locales ────────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('')

  const filtrados = comprobantes.filter(c => {
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    return (
      c.numero_comprobante?.toLowerCase().includes(q) ||
      (c.datos_cliente?.razon_social ?? '').toLowerCase().includes(q) ||
      (c.datos_cliente?.cuit_dni ?? '').toLowerCase().includes(q)
    )
  })

  // ─── Filtros URL (tipo, fecha) ──────────────────────────────────────────────
  function pushFiltro(params: Record<string, string | null>) {
    const sp = new URLSearchParams()
    const merged = {
      tipo:  tipoFiltroInicial,
      desde: desdeFiltroInicial,
      hasta: hastaFiltroInicial,
      ...params,
    }
    Object.entries(merged).forEach(([k, v]) => { if (v) sp.set(k, v) })
    router.push(`/comprobantes?${sp.toString()}`)
  }

  // ─── Reimprimir ────────────────────────────────────────────────────────────
  async function handleReimprimir(id: string, tipo: TipoComprobante) {
    setReimprimiendo(id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await obtenerVentaDetalle(id) as any
    setReimprimiendo(null)
    if (!raw) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (raw.venta_items ?? []).map((vi: any) => ({
      nombre:          vi.productos?.nombre ?? 'Producto',
      unidad:          vi.productos?.unidad ?? 'unidad',
      cantidad:        vi.cantidad,
      precio_unitario: vi.precio_unitario,
    }))

    const printData: PrintData = {
      numeroVenta:       raw.numero_venta ?? 0,
      items,
      total:             Number(raw.total),
      metodoPago:        raw.metodo_pago,
      tipoComprobante:   tipo,
      numeroComprobante: raw.numero_comprobante ?? undefined,
      datosCliente:      raw.datos_cliente ?? null,
    }

    const html = generarHTMLTicket(printData, { configTicket, tamanoTicket, negocioNombre })
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;visibility:hidden;width:0;height:0;border:0'
    document.body.appendChild(iframe)
    iframe.contentDocument!.open()
    iframe.contentDocument!.write(html)
    iframe.contentDocument!.close()
    iframe.contentWindow!.focus()
    setTimeout(() => {
      iframe.contentWindow!.print()
      setTimeout(() => document.body.removeChild(iframe), 1500)
    }, 200)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Comprobantes</h1>
          <p className="text-slate-500 text-sm mt-0.5">Historial de Facturas X y otros comprobantes no fiscales</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="font-medium">Filtrar:</span>
        </div>

        {/* Tipo */}
        <div className="flex gap-1">
          {[
            { value: 'factura_x', label: 'Factura X' },
            { value: 'todos',     label: 'Todos'     },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => pushFiltro({ tipo: value })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tipoFiltroInicial === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Desde */}
        <input
          type="date"
          value={desdeFiltroInicial ?? ''}
          onChange={e => pushFiltro({ desde: e.target.value || null })}
          className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-slate-400">→</span>
        <input
          type="date"
          value={hastaFiltroInicial ?? ''}
          onChange={e => pushFiltro({ hasta: e.target.value || null })}
          className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Búsqueda local */}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar cliente o nro..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          />
        </div>

        {filtrados.length > 0 && (
          <span className="text-sm text-slate-500">
            {filtrados.length} {filtrados.length === 1 ? 'comprobante' : 'comprobantes'} ·{' '}
            <span className="font-semibold text-slate-700">
              {ARS(filtrados.reduce((s, c) => s + Number(c.total), 0))}
            </span>
          </span>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-500 mb-1">
              {comprobantes.length === 0
                ? 'Todavía no hay comprobantes emitidos'
                : 'Sin resultados para los filtros seleccionados'}
            </p>
            {comprobantes.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Los comprobantes se generan al cobrar con tipo &quot;Factura X&quot; en el POS
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3.5">Nro. Comprobante</th>
                  <th className="px-5 py-3.5">Tipo</th>
                  <th className="px-5 py-3.5">Fecha</th>
                  <th className="px-5 py-3.5">Cliente</th>
                  <th className="px-5 py-3.5">Método</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      {c.numero_comprobante ? (
                        <span className="font-mono text-sm font-semibold text-slate-800">
                          {c.numero_comprobante}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-mono">
                          #{String(c.numero_venta ?? 0).padStart(3, '0')}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        <FileText className="w-3 h-3" />
                        {TIPO_LABELS[c.tipo_comprobante] ?? c.tipo_comprobante}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                      {new Date(c.fecha).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.datos_cliente ? (
                        <div>
                          <p className="text-slate-800 font-medium text-sm">{c.datos_cliente.razon_social}</p>
                          {c.datos_cliente.cuit_dni && (
                            <p className="text-xs text-slate-500">{c.datos_cliente.cuit_dni}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">
                      {METODO_LABELS[c.metodo_pago] ?? c.metodo_pago}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-800 whitespace-nowrap">
                      {ARS(Number(c.total))}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleReimprimir(c.id, c.tipo_comprobante)}
                        disabled={reimprimiendo === c.id}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:text-slate-400 transition-colors"
                      >
                        {reimprimiendo === c.id ? (
                          <span className="w-3 h-3 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                        ) : (
                          <Printer className="w-3.5 h-3.5" />
                        )}
                        {reimprimiendo === c.id ? 'Imprimiendo...' : 'Reimprimir'}
                        <ChevronRight className="w-3 h-3" />
                      </button>
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
