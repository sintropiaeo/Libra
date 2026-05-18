'use client'

import { useState, useCallback, useRef } from 'react'
import { read as xlsxRead, utils as xlsxUtils, writeFile as xlsxWriteFile } from 'xlsx'
import {
  X, Upload, FileSpreadsheet, ArrowRight,
  CheckCircle, AlertTriangle, Loader2, Download,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapeo' | 'preview' | 'importando' | 'resultado'

type CampoDestino =
  | 'nombre' | 'descripcion' | 'precio_costo' | 'precio_venta'
  | 'stock_actual' | 'stock_minimo' | 'codigo_barras' | 'unidad'
  | 'categoria_nombre' | ''

interface ColMapping { origen: string; destino: CampoDestino }

interface ProductoImport {
  nombre:           string
  descripcion?:     string | null
  precio_costo?:    number
  precio_venta?:    number
  stock_actual?:    number
  stock_minimo?:    number
  codigo_barras?:   string | null
  unidad?:          string
  categoria_nombre?: string | null
}

interface FilaFallida extends ProductoImport { _error: string }

// ─── Constantes ───────────────────────────────────────────────────────────────

const BATCH_SIZE = 500

const CAMPOS_DESTINO: { value: CampoDestino; label: string; required?: boolean }[] = [
  { value: 'nombre',           label: 'Nombre',        required: true },
  { value: 'descripcion',      label: 'Descripción'   },
  { value: 'precio_costo',     label: 'Precio costo'  },
  { value: 'precio_venta',     label: 'Precio venta'  },
  { value: 'stock_actual',     label: 'Stock actual'  },
  { value: 'stock_minimo',     label: 'Stock mínimo'  },
  { value: 'codigo_barras',    label: 'Código barras' },
  { value: 'unidad',           label: 'Unidad'        },
  { value: 'categoria_nombre', label: 'Categoría'     },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const s = String(v ?? '').trim()
    .replace(/[$ ]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(s)
  return isNaN(n) ? 0 : n
}

function toStr(v: unknown): string { return String(v ?? '').trim() }

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ImportarModal({ onClose, onSuccess }: {
  onClose:   () => void
  onSuccess: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep]               = useState<Step>('upload')
  const [fileName, setFileName]       = useState('')
  const [columnas, setColumnas]       = useState<string[]>([])
  const [filas, setFilas]             = useState<Record<string, unknown>[]>([])
  const [mapeo, setMapeo]             = useState<ColMapping[]>([])
  const [onDuplicate, setOnDuplicate] = useState<'actualizar' | 'saltar'>('actualizar')
  const [progreso, setProgreso]       = useState(0)
  const [progresoTexto, setProgresoTexto] = useState('')
  const [resultado, setResultado]     = useState<{ importados: number; fallidos: number } | null>(null)
  const [filasFallidas, setFilasFallidas] = useState<FilaFallida[]>([])
  const [errorMsg, setErrorMsg]       = useState<string | null>(null)
  const [dragOver, setDragOver]       = useState(false)

  // ─── Leer archivo ──────────────────────────────────────────────────────────

  const procesarArchivo = useCallback((file: File) => {
    setErrorMsg(null)
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('El archivo no puede superar 50 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb   = xlsxRead(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const json = xlsxUtils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true })

        if (json.length === 0) { setErrorMsg('El archivo no tiene datos.'); return }

        const cols = Object.keys(json[0])
        setColumnas(cols)
        setFilas(json)
        setFileName(file.name)

        const autoMapeo: ColMapping[] = cols.map((col) => {
          const c = col.toLowerCase().replace(/[\s_-]/g, '')
          let destino: CampoDestino = ''
          if      (c.includes('nombre'))                                   destino = 'nombre'
          else if (c.includes('desc'))                                     destino = 'descripcion'
          else if (c.includes('costo'))                                    destino = 'precio_costo'
          else if (c.includes('venta'))                                    destino = 'precio_venta'
          else if (c.includes('stockact') || c === 'stock')               destino = 'stock_actual'
          else if (c.includes('stockmin') || c.includes('minimo'))        destino = 'stock_minimo'
          else if (c.includes('codigo') || c.includes('barras') || c.includes('ean') || c.includes('sku')) destino = 'codigo_barras'
          else if (c.includes('unidad'))                                   destino = 'unidad'
          else if (c.includes('categ'))                                    destino = 'categoria_nombre'
          return { origen: col, destino }
        })
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

  // ─── Convertir fila → producto ─────────────────────────────────────────────

  function filaAProducto(fila: Record<string, unknown>): ProductoImport {
    const get = (d: CampoDestino) => {
      const col = mapeo.find((m) => m.destino === d)?.origen
      return col ? fila[col] : undefined
    }
    return {
      nombre:           toStr(get('nombre')),
      descripcion:      toStr(get('descripcion')) || null,
      precio_costo:     toNum(get('precio_costo')),
      precio_venta:     toNum(get('precio_venta')),
      stock_actual:     toNum(get('stock_actual')),
      stock_minimo:     toNum(get('stock_minimo')),
      codigo_barras:    toStr(get('codigo_barras')) || null,
      unidad:           toStr(get('unidad')) || 'unidad',
      categoria_nombre: toStr(get('categoria_nombre')) || null,
    }
  }

  const preview       = filas.slice(0, 10).map(filaAProducto)
  const nombreMapeado = mapeo.some((m) => m.destino === 'nombre')

  // ─── Importar (directo a Supabase, sin server action) ──────────────────────

  async function iniciarImportacion() {
    setStep('importando')
    setProgreso(0)
    setProgresoTexto('Preparando...')
    setErrorMsg(null)

    const supabase = createClient()

    // Resolver todas las categorías de una sola vez
    const productos = filas.map(filaAProducto).filter((p) => p.nombre.trim())
    const total = productos.length

    const nombresCategoria = Array.from(new Set(
      productos.map((p) => p.categoria_nombre).filter(Boolean) as string[]
    ))
    const categoriaMap: Record<string, string> = {}
    if (nombresCategoria.length > 0) {
      const { data: cats } = await supabase
        .from('categorias')
        .select('id, nombre')
        .in('nombre', nombresCategoria)
      for (const c of cats ?? []) categoriaMap[c.nombre] = c.id
    }

    let totalImportados = 0
    const fallidos: FilaFallida[] = []
    let procesados = 0

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batchRaw = productos.slice(i, i + BATCH_SIZE)
      const loteNum  = Math.floor(i / BATCH_SIZE) + 1
      const lotesTot = Math.ceil(total / BATCH_SIZE)

      setProgresoTexto(
        `Lote ${loteNum} de ${lotesTot} · ${Math.min(i + BATCH_SIZE, total).toLocaleString('es-AR')} de ${total.toLocaleString('es-AR')} productos`
      )

      // Deduplicar dentro del batch: Postgres rechaza ON CONFLICT si el mismo
      // código aparece dos veces en el mismo INSERT.
      const seen = new Set<string>()
      const batch = batchRaw.filter((p) => {
        const codigo = p.codigo_barras?.trim()
        if (!codigo) return true
        if (seen.has(codigo)) return false
        seen.add(codigo)
        return true
      })

      const toRow = (p: ProductoImport) => ({
        nombre:                   p.nombre.trim(),
        descripcion:              p.descripcion?.trim() || null,
        categoria_id:             (p.categoria_nombre && categoriaMap[p.categoria_nombre]) || null,
        precio_costo:             p.precio_costo  ?? 0,
        precio_venta:             p.precio_venta  ?? 0,
        stock_actual:             p.stock_actual  ?? 0,
        stock_minimo:             p.stock_minimo  ?? 5,
        codigo_barras:            p.codigo_barras?.trim() || null,
        unidad:                   (['unidad','pack','resma','metro'].includes(p.unidad ?? '') ? p.unidad : 'unidad') as string,
        activo:                   true,
        permitir_venta_sin_stock: true,
      })

      const conBarras = batch.filter((p) => p.codigo_barras?.trim())
      const sinBarras = batch.filter((p) => !p.codigo_barras?.trim())

      // Upsert de los que tienen código de barras
      if (conBarras.length > 0) {
        const { error } = await supabase
          .from('productos')
          .upsert(conBarras.map(toRow), {
            onConflict:       'codigo_barras',
            ignoreDuplicates: onDuplicate === 'saltar',
          })
        if (error) {
          console.error(`[Importar] lote ${loteNum} conBarras:`, error.message)
          conBarras.forEach((p) => fallidos.push({ ...p, _error: error.message }))
        } else {
          totalImportados += conBarras.length
        }
      }

      // Insert de los que NO tienen código de barras
      if (sinBarras.length > 0) {
        const { error } = await supabase.from('productos').insert(sinBarras.map(toRow))
        if (error) {
          console.error(`[Importar] lote ${loteNum} sinBarras:`, error.message)
          sinBarras.forEach((p) => fallidos.push({ ...p, _error: error.message }))
        } else {
          totalImportados += sinBarras.length
        }
      }

      procesados += batchRaw.length
      setProgreso(Math.round((procesados / total) * 100))
    }

    setFilasFallidas(fallidos)
    setResultado({ importados: totalImportados, fallidos: fallidos.length })
    setStep('resultado')
    onSuccess()
  }

  // ─── Descargar fallidos ────────────────────────────────────────────────────

  function descargarFallidos() {
    const data = filasFallidas.map(({ _error, ...p }) => ({
      nombre:        p.nombre,
      descripcion:   p.descripcion ?? '',
      precio_costo:  p.precio_costo ?? 0,
      precio_venta:  p.precio_venta ?? 0,
      stock_actual:  p.stock_actual ?? 0,
      stock_minimo:  p.stock_minimo ?? 0,
      codigo_barras: p.codigo_barras ?? '',
      unidad:        p.unidad ?? '',
      categoria:     p.categoria_nombre ?? '',
      error:         _error,
    }))
    const ws = xlsxUtils.json_to_sheet(data)
    const wb = xlsxUtils.book_new()
    xlsxUtils.book_append_sheet(wb, ws, 'Fallidos')
    xlsxWriteFile(wb, 'productos_fallidos.xlsx')
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && step !== 'importando') onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-slate-900">Importar productos</h2>
            {fileName && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full truncate max-w-[180px]">
                {fileName}
              </span>
            )}
          </div>
          {step !== 'importando' && (
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Stepper */}
        {step !== 'resultado' && step !== 'importando' && (
          <div className="px-6 pt-4 shrink-0">
            <div className="flex items-center gap-2 text-xs">
              {(['upload', 'mapeo', 'preview'] as const).map((s, i) => {
                const pasos = ['upload', 'mapeo', 'preview'] as const
                const idx   = pasos.indexOf(step)
                const isActive = step === s
                const isDone   = pasos.indexOf(s) < idx
                return (
                  <div key={s} className="flex items-center gap-2">
                    {i > 0 && <div className="w-8 h-px bg-slate-200" />}
                    <div className={`flex items-center gap-1.5 ${isActive ? 'text-blue-600 font-semibold' : isDone ? 'text-emerald-600' : 'text-slate-400'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-blue-100 text-blue-600' : isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {i + 1}
                      </span>
                      {s === 'upload' ? 'Subir archivo' : s === 'mapeo' ? 'Mapear columnas' : 'Vista previa'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── STEP: Upload ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-blue-500' : 'text-slate-300'}`} />
                <p className="text-sm font-medium text-slate-600">
                  Arrastrá el archivo o hacé clic para seleccionar
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  .xlsx, .xls o .csv · máximo 50 MB · sin límite de filas
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {errorMsg && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {errorMsg}
                </div>
              )}
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
                <p className="font-semibold">Formato esperado:</p>
                <p>Primera fila = encabezados. Columnas sugeridas:</p>
                <p className="font-mono">nombre, precio_venta, precio_costo, stock_actual, codigo_barras, unidad</p>
              </div>
            </div>
          )}

          {/* ── STEP: Mapeo ── */}
          {step === 'mapeo' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600">
                El archivo tiene <strong>{filas.length.toLocaleString('es-AR')}</strong> filas y {columnas.length} columnas.
                Asigná cada columna al campo correspondiente.
              </p>
              <div className="space-y-2">
                {columnas.map((col) => {
                  const m = mapeo.find((x) => x.origen === col)!
                  return (
                    <div key={col} className="flex items-center gap-3">
                      <div className="flex-1 px-3 py-2 bg-slate-100 rounded-lg text-sm font-mono text-slate-700 truncate">{col}</div>
                      <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                      <select
                        value={m.destino}
                        onChange={(e) => {
                          const nuevoDestino = e.target.value as CampoDestino
                          setMapeo((prev) => prev.map((x) => x.origen === col ? { ...x, destino: nuevoDestino } : x))
                        }}
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Ignorar columna —</option>
                        {CAMPOS_DESTINO.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}{c.required ? ' *' : ''}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
              {!nombreMapeado && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-lg">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  Debés mapear al menos la columna <strong>Nombre</strong> para continuar.
                </div>
              )}
            </div>
          )}

          {/* ── STEP: Preview ── */}
          {step === 'preview' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600">
                Primeros {preview.length} de <strong>{filas.length.toLocaleString('es-AR')}</strong> productos.
              </p>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {(['nombre','precio_venta','precio_costo','stock_actual','codigo_barras','unidad'] as CampoDestino[]).map((f) => {
                        const label   = CAMPOS_DESTINO.find(c => c.value === f)?.label ?? f
                        const mapeado = mapeo.some(m => m.destino === f)
                        return mapeado ? (
                          <th key={f} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{label}</th>
                        ) : null
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.map((p, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        {mapeo.some(m => m.destino === 'nombre') && (
                          <td className="px-3 py-2 font-medium text-slate-800 max-w-[200px] truncate">{p.nombre || <span className="text-red-400 italic">vacío</span>}</td>
                        )}
                        {mapeo.some(m => m.destino === 'precio_venta') && (
                          <td className="px-3 py-2 text-slate-600">${p.precio_venta ?? 0}</td>
                        )}
                        {mapeo.some(m => m.destino === 'precio_costo') && (
                          <td className="px-3 py-2 text-slate-600">${p.precio_costo ?? 0}</td>
                        )}
                        {mapeo.some(m => m.destino === 'stock_actual') && (
                          <td className="px-3 py-2 text-slate-600">{p.stock_actual ?? 0}</td>
                        )}
                        {mapeo.some(m => m.destino === 'codigo_barras') && (
                          <td className="px-3 py-2 font-mono text-slate-500">{p.codigo_barras ?? '—'}</td>
                        )}
                        {mapeo.some(m => m.destino === 'unidad') && (
                          <td className="px-3 py-2 text-slate-500">{p.unidad}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Opciones duplicados */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700">
                  ¿Qué hacer si ya existe un producto con el mismo código de barras?
                </p>
                <div className="flex gap-4">
                  {(['actualizar', 'saltar'] as const).map((opt) => (
                    <label key={opt} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      onDuplicate === opt
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                      <input
                        type="radio"
                        name="onDuplicate"
                        value={opt}
                        checked={onDuplicate === opt}
                        onChange={() => setOnDuplicate(opt)}
                        className="accent-blue-600"
                      />
                      <span className="text-sm font-medium capitalize">{opt}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400">
                  {onDuplicate === 'saltar'
                    ? 'Los productos que ya existen no se modifican.'
                    : 'Los productos existentes se actualizan con los datos del archivo.'}
                </p>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {errorMsg}
                </div>
              )}
            </div>
          )}

          {/* ── STEP: Importando ── */}
          {step === 'importando' && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-5">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <div>
                <p className="text-base font-semibold text-slate-800">Importando productos...</p>
                <p className="text-sm text-slate-400 mt-1 max-w-xs">{progresoTexto}</p>
              </div>
              <div className="w-full max-w-sm space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{progreso}%</span>
                  <span>{Math.ceil(filas.length / BATCH_SIZE)} lotes de {BATCH_SIZE}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progreso}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-4 py-2 rounded-lg">
                No cerrés esta ventana mientras se importa
              </p>
            </div>
          )}

          {/* ── STEP: Resultado ── */}
          {step === 'resultado' && resultado && (
            <div className="flex flex-col items-center py-6 text-center space-y-5">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                resultado.fallidos === 0 ? 'bg-emerald-100' : 'bg-amber-100'
              }`}>
                {resultado.fallidos === 0
                  ? <CheckCircle className="w-8 h-8 text-emerald-600" />
                  : <AlertTriangle className="w-8 h-8 text-amber-600" />
                }
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {resultado.fallidos === 0 ? '¡Importación completada!' : 'Importación con errores parciales'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {filas.length.toLocaleString('es-AR')} registros procesados
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-3xl font-bold text-emerald-600">{resultado.importados.toLocaleString('es-AR')}</p>
                  <p className="text-xs text-emerald-700 mt-0.5">importados</p>
                </div>
                <div className={`rounded-xl p-4 ${resultado.fallidos > 0 ? 'bg-red-50' : 'bg-slate-100'}`}>
                  <p className={`text-3xl font-bold ${resultado.fallidos > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {resultado.fallidos.toLocaleString('es-AR')}
                  </p>
                  <p className={`text-xs mt-0.5 ${resultado.fallidos > 0 ? 'text-red-700' : 'text-slate-500'}`}>fallidos</p>
                </div>
              </div>

              {filasFallidas.length > 0 && (
                <div className="w-full space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left space-y-2">
                    <p className="text-sm font-semibold text-red-800">
                      {filasFallidas.length} productos no se pudieron importar
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {filasFallidas.slice(0, 5).map((f, i) => (
                        <p key={i} className="text-xs text-red-700 truncate">
                          <span className="font-mono font-semibold">{f.nombre || '(sin nombre)'}</span>
                          {' — '}{f._error}
                        </p>
                      ))}
                      {filasFallidas.length > 5 && (
                        <p className="text-xs text-red-500">... y {filasFallidas.length - 5} más</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={descargarFallidos}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Descargar productos fallidos (.xlsx)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center shrink-0">
          {step === 'upload' && (
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
          )}
          {step === 'mapeo' && (
            <>
              <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                ← Volver
              </button>
              <button
                onClick={() => setStep('preview')}
                disabled={!nombreMapeado}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-colors"
              >
                Vista previa <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('mapeo')} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                ← Volver
              </button>
              <button
                onClick={iniciarImportacion}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                Confirmar importación · {filas.length.toLocaleString('es-AR')} productos
              </button>
            </>
          )}
          {step === 'resultado' && (
            <div className="flex w-full justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}
          {step === 'importando' && <div />}
        </div>
      </div>
    </div>
  )
}
