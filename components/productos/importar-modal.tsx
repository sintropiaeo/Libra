'use client'

import { useState, useCallback, useRef } from 'react'
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx'
import { X, Upload, FileSpreadsheet, ArrowRight, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { importarLoteProductos, type ProductoImport } from '@/app/(dashboard)/productos/actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapeo' | 'preview' | 'importando' | 'resultado'

type CampoDestino =
  | 'nombre'
  | 'descripcion'
  | 'precio_costo'
  | 'precio_venta'
  | 'stock_actual'
  | 'stock_minimo'
  | 'codigo_barras'
  | 'unidad'
  | 'categoria_nombre'
  | ''

interface ColMapping {
  origen: string   // columna del archivo
  destino: CampoDestino
}

const CAMPOS_DESTINO: { value: CampoDestino; label: string; required?: boolean }[] = [
  { value: 'nombre',          label: 'Nombre',           required: true },
  { value: 'descripcion',     label: 'Descripción'   },
  { value: 'precio_costo',    label: 'Precio costo'  },
  { value: 'precio_venta',    label: 'Precio venta'  },
  { value: 'stock_actual',    label: 'Stock actual'  },
  { value: 'stock_minimo',    label: 'Stock mínimo'  },
  { value: 'codigo_barras',   label: 'Código barras' },
  { value: 'unidad',          label: 'Unidad'        },
  { value: 'categoria_nombre',label: 'Categoría'     },
]

const BATCH_SIZE = 500

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown): number {
  const n = Number(String(v ?? '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ImportarModal({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep]               = useState<Step>('upload')
  const [fileName, setFileName]       = useState('')
  const [columnas, setColumnas]       = useState<string[]>([])
  const [filas, setFilas]             = useState<Record<string, unknown>[]>([])
  const [mapeo, setMapeo]             = useState<ColMapping[]>([])
  const [onDuplicate, setOnDuplicate] = useState<'actualizar' | 'saltar'>('saltar')
  const [progreso, setProgreso]       = useState(0)
  const [resultado, setResultado]     = useState<{
    insertados: number; actualizados: number; saltados: number
  } | null>(null)
  const [errorMsg, setErrorMsg]       = useState<string | null>(null)
  const [dragOver, setDragOver]       = useState(false)

  // ─── Leer archivo ──────────────────────────────────────────────────────────

  const procesarArchivo = useCallback((file: File) => {
    setErrorMsg(null)

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('El archivo no puede superar 25 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data   = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb     = xlsxRead(data, { type: 'array' })
        const ws     = wb.Sheets[wb.SheetNames[0]]
        const json   = xlsxUtils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: '',
          raw: false,
        })

        if (json.length === 0) { setErrorMsg('El archivo no tiene datos.'); return }

        const cols = Object.keys(json[0])
        setColumnas(cols)
        setFilas(json)
        setFileName(file.name)

        // Auto-mapeo inteligente por nombre de columna
        const autoMapeo: ColMapping[] = cols.map((col) => {
          const c = col.toLowerCase().replace(/[\s_-]/g, '')
          let destino: CampoDestino = ''
          if (c.includes('nombre'))        destino = 'nombre'
          else if (c.includes('desc'))     destino = 'descripcion'
          else if (c.includes('costo'))    destino = 'precio_costo'
          else if (c.includes('venta'))    destino = 'precio_venta'
          else if (c.includes('stockact') || c === 'stock') destino = 'stock_actual'
          else if (c.includes('stockmin') || c.includes('minimo')) destino = 'stock_minimo'
          else if (c.includes('codigo') || c.includes('barras') || c.includes('ean')) destino = 'codigo_barras'
          else if (c.includes('unidad'))   destino = 'unidad'
          else if (c.includes('categ'))    destino = 'categoria_nombre'
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

  // ─── Preview ───────────────────────────────────────────────────────────────

  function filaAProducto(fila: Record<string, unknown>): ProductoImport {
    const get = (destino: CampoDestino) => {
      const col = mapeo.find((m) => m.destino === destino)?.origen
      return col ? fila[col] : undefined
    }
    return {
      nombre:          toStr(get('nombre')),
      descripcion:     toStr(get('descripcion')) || null,
      precio_costo:    toNum(get('precio_costo')),
      precio_venta:    toNum(get('precio_venta')),
      stock_actual:    toNum(get('stock_actual')),
      stock_minimo:    toNum(get('stock_minimo')),
      codigo_barras:   toStr(get('codigo_barras')) || null,
      unidad:          toStr(get('unidad')) || 'unidad',
      categoria_nombre:toStr(get('categoria_nombre')) || null,
    }
  }

  const preview = filas.slice(0, 10).map(filaAProducto)
  const nombreMapeado = mapeo.some((m) => m.destino === 'nombre')

  // ─── Importar ──────────────────────────────────────────────────────────────

  async function iniciarImportacion() {
    setStep('importando')
    setProgreso(0)
    setErrorMsg(null)

    const productos = filas.map(filaAProducto).filter((p) => p.nombre.trim())
    const total     = productos.length
    let insertados  = 0
    let actualizados = 0
    let saltados    = 0
    let procesados  = 0

    for (let i = 0; i < productos.length; i += BATCH_SIZE) {
      const batch = productos.slice(i, i + BATCH_SIZE)
      const res   = await importarLoteProductos(batch, onDuplicate)

      if (res.error) {
        setErrorMsg(`Error en lote ${Math.floor(i / BATCH_SIZE) + 1}: ${res.error}`)
        setStep('preview')
        return
      }

      insertados  += res.insertados
      actualizados += res.actualizados
      saltados    += res.saltados
      procesados  += batch.length
      setProgreso(Math.round((procesados / total) * 100))
    }

    setResultado({ insertados, actualizados, saltados })
    setStep('resultado')
    onSuccess()
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
              {(['upload', 'mapeo', 'preview'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className="w-8 h-px bg-slate-200" />}
                  <div className={`flex items-center gap-1.5 ${
                    step === s ? 'text-blue-600 font-semibold' :
                    (['upload', 'mapeo'].indexOf(s) < ['upload', 'mapeo', 'preview'].indexOf(step))
                      ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      step === s ? 'bg-blue-100 text-blue-600' :
                      (['upload', 'mapeo'].indexOf(s) < ['upload', 'mapeo', 'preview'].indexOf(step))
                        ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                    }`}>{i + 1}</span>
                    {s === 'upload' ? 'Subir archivo' : s === 'mapeo' ? 'Mapear columnas' : 'Vista previa'}
                  </div>
                </div>
              ))}
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
                  .xlsx, .xls o .csv · máximo 25 MB · hasta 25.000 filas
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
                <p className="font-semibold">Formato esperado del archivo:</p>
                <p>La primera fila debe ser el encabezado con los nombres de columnas.</p>
                <p>Columnas sugeridas: <span className="font-mono">nombre, precio_venta, precio_costo, stock_actual, codigo_barras, unidad</span></p>
              </div>
            </div>
          )}

          {/* ── STEP: Mapeo ── */}
          {step === 'mapeo' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600">
                El archivo tiene <strong>{filas.length.toLocaleString('es-AR')}</strong> filas y {columnas.length} columnas.
                Asigná cada columna del archivo al campo correspondiente.
              </p>

              <div className="space-y-2">
                {columnas.map((col) => {
                  const m = mapeo.find((x) => x.origen === col)!
                  return (
                    <div key={col} className="flex items-center gap-3">
                      <div className="flex-1 px-3 py-2 bg-slate-100 rounded-lg text-sm font-mono text-slate-700 truncate">
                        {col}
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                      <select
                        value={m.destino}
                        onChange={(e) => {
                          const nuevoDestino = e.target.value as CampoDestino
                          setMapeo((prev) => prev.map((x) =>
                            x.origen === col ? { ...x, destino: nuevoDestino } : x
                          ))
                        }}
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Ignorar columna —</option>
                        {CAMPOS_DESTINO.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}{c.required ? ' *' : ''}
                          </option>
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
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Mostrando los primeros {preview.length} de{' '}
                  <strong>{filas.length.toLocaleString('es-AR')}</strong> productos.
                </p>
              </div>

              {/* Tabla preview */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {(['nombre', 'precio_venta', 'precio_costo', 'stock_actual', 'codigo_barras', 'unidad'] as CampoDestino[]).map((f) => {
                        const label = CAMPOS_DESTINO.find(c => c.value === f)?.label ?? f
                        const mapeado = mapeo.some(m => m.destino === f)
                        return mapeado ? (
                          <th key={f} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">
                            {label}
                          </th>
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
                  {(['saltar', 'actualizar'] as const).map((opt) => (
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
                <p className="text-sm text-slate-400 mt-1">
                  {progreso}% completado · no cerrés esta ventana
                </p>
              </div>
              <div className="w-full max-w-sm bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                Procesando en lotes de {BATCH_SIZE} · {Math.ceil(filas.length / BATCH_SIZE)} lote{Math.ceil(filas.length / BATCH_SIZE) !== 1 ? 's' : ''} total
              </p>
            </div>
          )}

          {/* ── STEP: Resultado ── */}
          {step === 'resultado' && resultado && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-5">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">¡Importación completada!</h3>
                <p className="text-sm text-slate-500 mt-1">Procesados {filas.length.toLocaleString('es-AR')} registros</p>
              </div>
              <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-emerald-600">{resultado.insertados}</p>
                  <p className="text-xs text-emerald-700 mt-0.5">nuevos</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-blue-600">{resultado.actualizados}</p>
                  <p className="text-xs text-blue-700 mt-0.5">actualizados</p>
                </div>
                <div className="bg-slate-100 rounded-xl p-3">
                  <p className="text-2xl font-bold text-slate-500">{resultado.saltados}</p>
                  <p className="text-xs text-slate-500 mt-0.5">saltados</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer con botones */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center shrink-0">
          {step === 'upload' && (
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
          )}
          {step === 'mapeo' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
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
              <button
                onClick={() => setStep('mapeo')}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
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
