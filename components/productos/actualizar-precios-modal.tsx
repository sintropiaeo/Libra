'use client'

import { useState, useCallback, useRef } from 'react'
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx'
import {
  X, Upload, FileSpreadsheet, ArrowRight, DollarSign,
  CheckCircle, AlertTriangle, Loader2,
} from 'lucide-react'
import { traerCatalogoPrecios, type AplicarResponse } from '@/app/(dashboard)/productos/actualizar-precios/actions'
import { clasificarFilas, type FilaPrecio, type ResultadoAnalisis } from '@/lib/precios-match'
import ActualizarPreciosRevision from '@/components/productos/actualizar-precios-revision'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapeo' | 'analizando' | 'revision' | 'resultado'

type CampoDestino = 'nombre' | 'codigo_barras' | 'codigo_interno' | 'precio_venta' | 'precio_costo' | ''

interface ColMapping { origen: string; destino: CampoDestino }

const CAMPOS_DESTINO: { value: CampoDestino; label: string }[] = [
  { value: 'nombre',         label: 'Nombre' },
  { value: 'codigo_barras',  label: 'Código de barras' },
  { value: 'codigo_interno', label: 'Código interno' },
  { value: 'precio_venta',   label: 'Precio venta' },
  { value: 'precio_costo',   label: 'Precio costo' },
]

// ─── Helpers (mismo criterio es-AR que el importador) ──────────────────────────

function toStr(v: unknown): string { return String(v ?? '').trim() }

function toNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const s = String(v ?? '').trim().replace(/[$ ]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return isNaN(n) ? 0 : n
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ActualizarPreciosModal({
  onClose,
  onSuccess,
}: {
  onClose:   () => void
  onSuccess: () => void
}) {
  const [step,        setStep]        = useState<Step>('upload')
  const [fileName,    setFileName]    = useState('')
  const [filas,       setFilas]       = useState<Record<string, unknown>[]>([])
  const [mapeo,       setMapeo]       = useState<ColMapping[]>([])
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)
  const [dragOver,    setDragOver]    = useState(false)
  const [analisis,    setAnalisis]    = useState<ResultadoAnalisis | null>(null)
  const [totalProd,   setTotalProd]   = useState(0)
  const [resumen,     setResumen]     = useState<Extract<AplicarResponse, { actualizados: number }> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Cargar archivo ─────────────────────────────────────────────────────────

  const procesarArchivo = useCallback((file: File) => {
    setErrorMsg(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb   = xlsxRead(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const json = xlsxUtils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true })

        if (json.length === 0) { setErrorMsg('El archivo no tiene datos.'); return }

        const cols = Object.keys(json[0])
        const autoMapeo: ColMapping[] = cols.map((col) => {
          const c = col.toLowerCase().replace(/[\s_-]/g, '')
          let destino: CampoDestino = ''
          if      (c.includes('nombre'))                                   destino = 'nombre'
          else if (c.includes('costo'))                                    destino = 'precio_costo'
          else if (c.includes('venta') || c.includes('precio'))           destino = 'precio_venta'
          else if (c.includes('interno'))                                  destino = 'codigo_interno'
          else if (c.includes('barras') || c.includes('ean') || c.includes('sku') || c.includes('codigo') || c === 'cod') destino = 'codigo_barras'
          return { origen: col, destino }
        })

        setFilas(json)
        setFileName(file.name)
        setMapeo(autoMapeo)
        setStep('mapeo')
      } catch {
        setErrorMsg('No se pudo leer el archivo. Verificá que sea .xlsx, .xls o .csv.')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) procesarArchivo(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) procesarArchivo(file)
  }

  function setDestino(origen: string, destino: CampoDestino) {
    setMapeo((prev) => prev.map((m) => (m.origen === origen ? { ...m, destino } : m)))
  }

  const tieneNombre = mapeo.some((m) => m.destino === 'nombre')
  const tienePrecio = mapeo.some((m) => m.destino === 'precio_venta' || m.destino === 'precio_costo')

  // ─── Convertir fila → FilaPrecio ──────────────────────────────────────────────

  function filaAPrecio(fila: Record<string, unknown>): FilaPrecio {
    const get = (d: CampoDestino) => {
      const col = mapeo.find((m) => m.destino === d)?.origen
      return col ? fila[col] : undefined
    }
    return {
      nombre:         toStr(get('nombre')),
      codigo_barras:  toStr(get('codigo_barras'))  || null,
      codigo_interno: toStr(get('codigo_interno')) || null,
      precio_venta:   toNum(get('precio_venta')),
      precio_costo:   toNum(get('precio_costo')),
    }
  }

  // ─── Analizar (dry-run) ───────────────────────────────────────────────────────

  async function analizar() {
    setErrorMsg(null)
    setStep('analizando')

    const todas = filas.map(filaAPrecio)
    // Solo filas accionables: con algo para matchear y al menos un precio > 0
    const utiles = todas.filter(
      (p) => (p.nombre || p.codigo_barras || p.codigo_interno) && (p.precio_venta > 0 || p.precio_costo > 0)
    )

    if (utiles.length === 0) {
      setErrorMsg('Ninguna fila tiene un precio válido (> 0) junto con nombre o código. Revisá el mapeo.')
      setStep('mapeo')
      return
    }

    // Traemos el catálogo del negocio una sola vez (scopeado server-side) y
    // hacemos el match en el navegador — así no mandamos las filas del Excel al
    // server (evita el límite de 1MB con listas grandes).
    const cat = await traerCatalogoPrecios()
    if ('error' in cat) {
      setErrorMsg(cat.error)
      setStep('mapeo')
      return
    }
    const resultado = clasificarFilas(utiles, cat.productos)
    setAnalisis(resultado)
    setTotalProd(cat.productos.length)
    setStep('revision')
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Actualizar precios</h2>
              <p className="text-xs text-slate-500">Solo modifica precio de venta y costo — nunca stock, códigos ni otros datos.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">

          {errorMsg && (
            <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* ── Paso: Upload ── */}
          {step === 'upload' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center py-14 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-300 hover:bg-slate-50'
              }`}
            >
              <Upload className="w-9 h-9 text-slate-400 mb-3" />
              <p className="text-sm font-medium text-slate-700">Arrastrá tu lista de precios o hacé clic para elegir</p>
              <p className="text-xs text-slate-400 mt-1">.xlsx, .xls o .csv · precios con coma decimal (ej: 1234,50)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* ── Paso: Mapeo ── */}
          {step === 'mapeo' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">{fileName}</span>
                <span className="text-slate-400">· {filas.length.toLocaleString('es-AR')} filas</span>
              </div>

              <p className="text-xs text-slate-500">
                Asigná cada columna del Excel. Todo lo que no mapees se ignora. Necesitás <b>Nombre</b> y al menos un precio.
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {mapeo.map((m) => (
                    <div key={m.origen} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{m.origen}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <select
                        value={m.destino}
                        onChange={(e) => setDestino(m.origen, e.target.value as CampoDestino)}
                        className="w-44 shrink-0 px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Ignorar —</option>
                        {CAMPOS_DESTINO.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {!tieneNombre && <p className="text-xs text-amber-600">Falta mapear el campo <b>Nombre</b>.</p>}
              {!tienePrecio && <p className="text-xs text-amber-600">Mapeá al menos <b>Precio venta</b> o <b>Precio costo</b>.</p>}

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => { setStep('upload'); setErrorMsg(null) }}
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={analizar}
                  disabled={!tieneNombre || !tienePrecio}
                  className="px-5 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-colors"
                >
                  Analizar
                </button>
              </div>
            </div>
          )}

          {/* ── Paso: Analizando ── */}
          {step === 'analizando' && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin mb-3" />
              <p className="text-sm">Comparando contra tu catálogo…</p>
            </div>
          )}

          {/* ── Paso: Revisión ── */}
          {step === 'revision' && analisis && (
            <>
              <p className="text-xs text-slate-400 mb-3">Comparado contra {totalProd.toLocaleString('es-AR')} productos activos del negocio.</p>
              <ActualizarPreciosRevision
                analisis={analisis}
                onVolver={() => setStep('mapeo')}
                onAplicado={(r) => { setResumen(r); setStep('resultado') }}
              />
            </>
          )}

          {/* ── Paso: Resultado ── */}
          {step === 'resultado' && resumen && (
            <div className="flex flex-col items-center text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Precios actualizados</h3>
              <p className="text-sm text-slate-500 mb-4">
                {resumen.actualizados} actualizado{resumen.actualizados !== 1 ? 's' : ''}
                {resumen.sinCambios > 0 && ` · ${resumen.sinCambios} sin cambios`}
                {resumen.noEncontrados > 0 && ` · ${resumen.noEncontrados} no encontrados`}
              </p>
              {resumen.errores.length > 0 && (
                <div className="w-full text-left bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 max-h-32 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-700 mb-1">{resumen.errores.length} con error:</p>
                  {resumen.errores.map((e) => (
                    <p key={e.producto_id} className="text-[11px] text-red-600 font-mono truncate">{e.producto_id}: {e.error}</p>
                  ))}
                </div>
              )}
              <button
                onClick={onSuccess}
                className="px-6 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Listo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
