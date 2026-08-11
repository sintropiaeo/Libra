'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, Loader2, ArrowRight } from 'lucide-react'
import {
  aplicarActualizacionPrecios,
  type CambioPrecio,
  type AplicarResponse,
} from '@/app/(dashboard)/productos/actualizar-precios/actions'
import type { ResultadoAnalisis, MatchFila, CampoMatch } from '@/lib/precios-match'

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v)

const LABEL_CAMPO: Record<CampoMatch, string> = {
  codigo_barras:  'Código de barras',
  codigo_interno: 'Código interno',
  nombre:         'Nombre',
}

// Muestra anterior → nuevo, o "sin cambio" si no se actualiza ese precio.
function CeldaPrecio({ anterior, nuevo }: { anterior: number | null; nuevo: number | null }) {
  if (anterior == null) return <span className="text-slate-400">—</span>
  if (nuevo == null) {
    return <span className="text-slate-500">{ARS(anterior)} <span className="text-slate-400 text-xs">· sin cambio</span></span>
  }
  const subeVenta = nuevo > anterior
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-slate-400 line-through">{ARS(anterior)}</span>
      <ArrowRight className="w-3 h-3 text-slate-400" />
      <span className={`font-semibold ${subeVenta ? 'text-emerald-700' : 'text-amber-700'}`}>{ARS(nuevo)}</span>
    </span>
  )
}

export default function ActualizarPreciosRevision({
  analisis,
  onAplicado,
  onVolver,
}: {
  analisis:   ResultadoAnalisis
  onAplicado: (resumen: Extract<AplicarResponse, { actualizados: number }>) => void
  onVolver:   () => void
}) {
  const { actualizados, parciales, sinMatch } = analisis
  const [checked,   setChecked]   = useState<Set<string>>(new Set())
  const [aplicando, setAplicando] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const parcialesChecked = parciales.filter((m) => m.producto && checked.has(m.producto.id))
  const totalAAplicar = actualizados.length + parcialesChecked.length

  function toggle(id: string) {
    setChecked((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  function cambioDe(m: MatchFila): CambioPrecio {
    return {
      producto_id:        m.producto!.id,
      precio_venta_excel: m.fila.precio_venta,
      precio_costo_excel: m.fila.precio_costo,
    }
  }

  async function confirmar() {
    setError(null)
    setAplicando(true)
    const cambios: CambioPrecio[] = [
      ...actualizados.filter((m) => m.producto).map(cambioDe),
      ...parcialesChecked.map(cambioDe),
    ]
    const r = await aplicarActualizacionPrecios(cambios)
    setAplicando(false)
    if ('error' in r) { setError(r.error); return }
    onAplicado(r)
  }

  return (
    <div className="space-y-5">
      {/* Resumen arriba */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-2xl font-bold text-emerald-700">{actualizados.length}</p>
          <p className="text-xs text-emerald-800 font-medium">Se van a actualizar (3/3)</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-2xl font-bold text-amber-700">{parciales.length}</p>
          <p className="text-xs text-amber-800 font-medium">Revisión manual (2/3)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-2xl font-bold text-slate-600">{sinMatch.length}</p>
          <p className="text-xs text-slate-600 font-medium">Sin match (0-1/3)</p>
        </div>
      </div>

      {/* ── Sección 1: Actualizados (3/3) ── */}
      {actualizados.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Se van a actualizar automáticamente ({actualizados.length})
          </h3>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {actualizados.map((m, idx) => (
                <div key={m.producto?.id ?? idx} className="px-4 py-2.5 text-sm">
                  <p className="font-medium text-slate-800 truncate">{m.producto?.nombre}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-0.5 text-xs mt-1">
                    <span className="text-slate-500">Venta: <CeldaPrecio anterior={m.ventaAnterior} nuevo={m.ventaNueva} /></span>
                    <span className="text-slate-500">Costo: <CeldaPrecio anterior={m.costoAnterior} nuevo={m.costoNueva} /></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Sección 2: Match parcial (2/3) ── */}
      {parciales.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Revisión manual — 2 de 3 campos coinciden ({parciales.length})
          </h3>
          <p className="text-xs text-slate-500 mb-2">
            Marcá los que quieras actualizar igual. Ninguno está marcado por defecto.
          </p>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {parciales.map((m, idx) => {
                const id = m.producto?.id ?? String(idx)
                const isChecked = m.producto ? checked.has(m.producto.id) : false
                return (
                  <label key={id} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-amber-50/50">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => m.producto && toggle(m.producto.id)}
                      className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-800 truncate">{m.producto?.nombre}</p>
                        {m.campoQueFallo && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                            no coincide: {LABEL_CAMPO[m.campoQueFallo]}
                          </span>
                        )}
                        {m.ambiguo && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-red-700 bg-red-100 rounded px-1.5 py-0.5">
                            ambiguo · {m.candidatos} candidatos
                          </span>
                        )}
                      </div>
                      {/* Libra vs Excel para el campo que falló */}
                      {m.campoQueFallo && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {LABEL_CAMPO[m.campoQueFallo]}: Libra “<b className="text-slate-700">{valorCampo(m, m.campoQueFallo, 'producto')}</b>” vs Excel “<b className="text-slate-700">{valorCampo(m, m.campoQueFallo, 'fila')}</b>”
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-6 gap-y-0.5 text-xs mt-1">
                        <span className="text-slate-500">Venta: <CeldaPrecio anterior={m.ventaAnterior} nuevo={m.ventaNueva} /></span>
                        <span className="text-slate-500">Costo: <CeldaPrecio anterior={m.costoAnterior} nuevo={m.costoNueva} /></span>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Sección 3: Sin match (0-1/3) ── */}
      {sinMatch.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
            <Info className="w-4 h-4 text-slate-400" />
            Sin match — no se tocan ({sinMatch.length})
          </h3>
          <p className="text-xs text-slate-500 mb-2">
            No se encontró un producto suficientemente parecido. Si son nuevos, cargalos con el importador normal.
          </p>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
              {sinMatch.map((m, idx) => (
                <div key={idx} className="px-4 py-2 text-sm">
                  <p className="text-slate-700 truncate">{m.fila.nombre || <span className="italic text-slate-400">(sin nombre)</span>}</p>
                  <p className="text-xs text-slate-400">
                    {m.fila.codigo_barras || 's/barras'} · {m.fila.codigo_interno || 's/interno'} · {m.coincidencias}/3
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          onClick={onVolver}
          disabled={aplicando}
          className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
        >
          Volver
        </button>
        <button
          onClick={confirmar}
          disabled={aplicando || totalAAplicar === 0}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-colors"
        >
          {aplicando && <Loader2 className="w-4 h-4 animate-spin" />}
          {aplicando ? 'Actualizando...' : `Confirmar y actualizar ${totalAAplicar} precio${totalAAplicar !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

// Devuelve el valor de un campo, del lado del producto (Libra) o de la fila (Excel).
function valorCampo(m: MatchFila, campo: CampoMatch, lado: 'producto' | 'fila'): string {
  const src = lado === 'producto' ? m.producto : m.fila
  if (!src) return '—'
  const v = campo === 'nombre' ? src.nombre : campo === 'codigo_barras' ? src.codigo_barras : src.codigo_interno
  return (v ?? '').toString().trim() || '(vacío)'
}
