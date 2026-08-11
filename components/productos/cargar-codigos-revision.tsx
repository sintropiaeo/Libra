'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, Loader2, ArrowRight } from 'lucide-react'
import {
  aplicarCodigoInterno,
  type CambioCodigo,
  type AplicarCodigoResponse,
} from '@/app/(dashboard)/productos/cargar-codigos/actions'
import type { ResultadoCodigo } from '@/lib/codigo-interno-match'

const MAX_VISIBLE = 200

export default function CargarCodigosRevision({
  analisis,
  onAplicado,
  onVolver,
}: {
  analisis:   ResultadoCodigo
  onAplicado: (r: Extract<AplicarCodigoResponse, { rellenados: number }>) => void
  onVolver:   () => void
}) {
  const { paraRellenar, ambiguos, omitidos } = analisis
  // Por defecto todos los "para rellenar" van marcados; guardamos los DESmarcados.
  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set())
  const [aplicando,   setAplicando]   = useState(false)
  const [progreso,    setProgreso]    = useState(0)
  const [error,       setError]       = useState<string | null>(null)

  const isChecked = (id: string) => !desmarcados.has(id)
  function toggle(id: string) {
    setDesmarcados((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  function marcarTodos(v: boolean) {
    setDesmarcados(v ? new Set() : new Set(paraRellenar.map((m) => m.producto.id)))
  }

  const seleccionados = paraRellenar.filter((m) => isChecked(m.producto.id))
  const totalAAplicar = seleccionados.length

  async function confirmar() {
    setError(null)
    setAplicando(true)
    setProgreso(0)
    const cambios: CambioCodigo[] = seleccionados.map((m) => ({
      producto_id: m.producto.id, codigo_interno: m.codigoNuevo,
    }))
    const BATCH = 500
    const acc = { rellenados: 0, omitidos: 0, conflictos: [] as { producto_id: string; codigo: string }[], errores: [] as { producto_id: string; error: string }[] }
    for (let i = 0; i < cambios.length; i += BATCH) {
      const r = await aplicarCodigoInterno(cambios.slice(i, i + BATCH))
      if ('error' in r) { setError(r.error); setAplicando(false); return }
      acc.rellenados += r.rellenados
      acc.omitidos   += r.omitidos
      acc.conflictos.push(...r.conflictos)
      acc.errores.push(...r.errores)
      setProgreso(Math.round(Math.min(i + BATCH, cambios.length) / cambios.length * 100))
    }
    setAplicando(false)
    onAplicado(acc)
  }

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-2xl font-bold text-emerald-700">{paraRellenar.length}</p>
          <p className="text-xs text-emerald-800 font-medium">Para rellenar</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-2xl font-bold text-amber-700">{ambiguos.length}</p>
          <p className="text-xs text-amber-800 font-medium">Ambiguos (a mano)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-2xl font-bold text-slate-600">{omitidos}</p>
          <p className="text-xs text-slate-600 font-medium">Omitidos</p>
        </div>
      </div>

      {/* ── Para rellenar ── */}
      {paraRellenar.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Se les carga el código interno ({paraRellenar.length})
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <button onClick={() => marcarTodos(true)}  className="text-blue-600 hover:underline">Marcar todos</button>
              <span className="text-slate-300">·</span>
              <button onClick={() => marcarTodos(false)} className="text-blue-600 hover:underline">Ninguno</button>
            </div>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {paraRellenar.slice(0, MAX_VISIBLE).map((m) => (
                <label key={m.producto.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-emerald-50/50">
                  <input
                    type="checkbox"
                    checked={isChecked(m.producto.id)}
                    onChange={() => toggle(m.producto.id)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <span className="flex-1 min-w-0 text-sm text-slate-800 truncate">{m.producto.nombre}</span>
                  <span className="inline-flex items-center gap-1 text-xs shrink-0">
                    <span className="text-slate-400">(vacío)</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="font-mono font-semibold text-emerald-700">{m.codigoNuevo}</span>
                  </span>
                </label>
              ))}
              {paraRellenar.length > MAX_VISIBLE && (
                <p className="px-4 py-2 text-xs text-slate-400">… y {paraRellenar.length - MAX_VISIBLE} más (se cargan todos los marcados igual)</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Ambiguos ── */}
      {ambiguos.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Ambiguos — no se pueden cargar automáticamente ({ambiguos.length})
          </h3>
          <p className="text-xs text-slate-500 mb-2">
            Hay varios productos duplicados con el mismo nombre; el código solo puede ir a uno. Resolvé estos a mano.
          </p>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
              {ambiguos.slice(0, MAX_VISIBLE).map((m, idx) => (
                <div key={idx} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <span className="flex-1 min-w-0 text-slate-700 truncate">{m.producto.nombre}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-red-700 bg-red-100 rounded px-1.5 py-0.5 shrink-0">{m.candidatos} candidatos</span>
                  <span className="font-mono text-xs text-slate-500 shrink-0">{m.codigoNuevo}</span>
                </div>
              ))}
              {ambiguos.length > MAX_VISIBLE && (
                <p className="px-4 py-2 text-xs text-slate-400">… y {ambiguos.length - MAX_VISIBLE} más</p>
              )}
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
          {aplicando ? `Cargando… ${progreso}%` : `Cargar ${totalAAplicar} código${totalAAplicar !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
