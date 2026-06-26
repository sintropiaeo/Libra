'use client'

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Plus, Trash2, Printer, Tag } from 'lucide-react'
import {
  buscarProductosParaEtiquetas,
  guardarCodigoGenerado,
  type ProductoEtiqueta,
} from '@/app/(dashboard)/productos/etiquetas/actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ItemEtiqueta = {
  producto:  ProductoEtiqueta
  cantidad:  number
  codigoEfectivo: string  // codigo_barras | codigo_interno | generado
  generado:  boolean      // true si fue generado (hay que guardarlo)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generarCodigo(id: string): string {
  const num = parseInt(id.replace(/-/g, '').slice(-6), 16) % 100000
  return `LIB${String(num).padStart(5, '0')}`
}

function resolverCodigo(p: ProductoEtiqueta): { codigo: string; generado: boolean } {
  if (p.codigo_barras)  return { codigo: p.codigo_barras,  generado: false }
  if (p.codigo_interno) return { codigo: p.codigo_interno,  generado: false }
  return { codigo: generarCodigo(p.id), generado: true }
}

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(v)

// ─── BarcodeLabel: renderiza un SVG con JsBarcode ─────────────────────────────

function BarcodeLabel({ item }: { item: ItemEtiqueta }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    import('jsbarcode').then(({ default: JsBarcode }) => {
      try {
        JsBarcode(svgRef.current!, item.codigoEfectivo, {
          format:       'CODE128',
          displayValue: true,
          fontSize:     9,
          textMargin:   2,
          height:       38,
          margin:       4,
          width:        1.4,
        })
      } catch {
        // código inválido para CODE128 — no renderiza barras pero no rompe
      }
    })
  }, [item.codigoEfectivo])

  return (
    <div
      className="etiqueta flex flex-col items-center justify-between px-1 py-1 border border-dashed border-slate-400 bg-white"
      style={{ width: '50mm', minHeight: '30mm', pageBreakInside: 'avoid', breakInside: 'avoid' }}
    >
      <svg ref={svgRef} className="w-full" />
      <p
        className="text-center font-semibold leading-tight mt-0.5"
        style={{ fontSize: '8pt', maxWidth: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
      >
        {item.producto.nombre}
      </p>
      <p className="font-bold mt-0.5" style={{ fontSize: '9pt' }}>
        {ARS(item.producto.precio_venta)}
      </p>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EtiquetasCliente() {
  // Sección 1 — Búsqueda
  const [query,        setQuery]        = useState('')
  const [resultados,   setResultados]   = useState<ProductoEtiqueta[]>([])
  const [buscando,     setBuscando]     = useState(false)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, startTransition] = useTransition()

  // Sección 2 — Lista
  const [lista, setLista] = useState<ItemEtiqueta[]>([])

  // Sección 3 — Preview
  const [preview,    setPreview]    = useState(false)
  const [guardando,  setGuardando]  = useState(false)
  const [errorGuard, setErrorGuard] = useState<string | null>(null)

  // ─── Búsqueda con debounce ──────────────────────────────────────────────────

  const buscar = useCallback((q: string) => {
    if (!q.trim()) { setResultados([]); return }
    setBuscando(true)
    startTransition(async () => {
      const res = await buscarProductosParaEtiquetas(q)
      setResultados(res)
      setBuscando(false)
    })
  }, [])

  function handleQuery(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(v), 300)
  }

  // ─── Toggle selección ───────────────────────────────────────────────────────

  function toggleSeleccion(id: string) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  // ─── Agregar seleccionados a la lista ──────────────────────────────────────

  function agregarSeleccionados() {
    const nuevos = resultados
      .filter(p => seleccionados.has(p.id))
      .filter(p => !lista.some(i => i.producto.id === p.id))

    const items: ItemEtiqueta[] = nuevos.map(p => {
      const { codigo, generado } = resolverCodigo(p)
      return { producto: p, cantidad: 1, codigoEfectivo: codigo, generado }
    })

    setLista(prev => [...prev, ...items])
    setSeleccionados(new Set())
    setPreview(false)
  }

  // ─── Editar cantidad ────────────────────────────────────────────────────────

  function setCantidad(id: string, v: number) {
    setLista(prev =>
      prev.map(i => i.producto.id === id ? { ...i, cantidad: Math.min(50, Math.max(1, v)) } : i)
    )
    setPreview(false)
  }

  function eliminarDeLista(id: string) {
    setLista(prev => prev.filter(i => i.producto.id !== id))
    setPreview(false)
  }

  // ─── Generar etiquetas ──────────────────────────────────────────────────────

  async function generarEtiquetas() {
    setErrorGuard(null)
    setGuardando(true)

    // Guardar códigos generados en Supabase
    const generados = lista.filter(i => i.generado)
    for (const item of generados) {
      const { error } = await guardarCodigoGenerado(item.producto.id, item.codigoEfectivo)
      if (error) {
        setErrorGuard(`Error al guardar código de ${item.producto.nombre}: ${error}`)
        setGuardando(false)
        return
      }
    }

    setGuardando(false)
    setPreview(true)
  }

  // ─── Expandir items por cantidad ────────────────────────────────────────────

  const etiquetasExpandidas = lista.flatMap(i =>
    Array.from({ length: i.cantidad }, (_, idx) => ({ ...i, key: `${i.producto.id}-${idx}` }))
  )

  // ─── CSS de impresión ───────────────────────────────────────────────────────

  const printCSS = `
    @media print {
      body > *:not(#print-root) { display: none !important; }
      #print-root { display: block !important; }
      @page { size: A4; margin: 10mm; }
      .no-print { display: none !important; }
      .etiqueta { border: 1px dashed #999 !important; break-inside: avoid; page-break-inside: avoid; }
      #grilla-etiquetas { display: flex; flex-wrap: wrap; gap: 4mm; }
    }
  `

  // ─── Render ────────────────────────────────────────────────────────────────

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

  return (
    <>
      <style>{printCSS}</style>

      {/* Zona imprimible */}
      <div id="print-root" className="hidden">
        <div
          id="grilla-etiquetas"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '4mm', padding: '0' }}
        >
          {etiquetasExpandidas.map(item => (
            <BarcodeLabel key={item.key} item={item} />
          ))}
        </div>
      </div>

      {/* UI principal */}
      <div className="p-8 max-w-4xl mx-auto no-print">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/productos"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Productos
          </Link>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-slate-600" />
            <h1 className="text-xl font-bold text-slate-900">Imprimir etiquetas</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ─── Sección 1: Buscador ─────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              1. Buscar productos
            </h2>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Buscar por nombre, código interno o barras..."
                value={query}
                onChange={handleQuery}
                className={`${inputCls} pl-9`}
              />
            </div>

            {buscando && (
              <p className="text-xs text-slate-400 text-center py-4">Buscando...</p>
            )}

            {!buscando && resultados.length > 0 && (
              <div className="border border-slate-100 rounded-lg overflow-hidden">
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                  {resultados.map(p => {
                    const enLista = lista.some(i => i.producto.id === p.id)
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                          enLista ? 'bg-slate-50 opacity-50 cursor-not-allowed' : 'hover:bg-blue-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={enLista}
                          checked={seleccionados.has(p.id)}
                          onChange={() => !enLista && toggleSeleccion(p.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{p.nombre}</p>
                          <p className="text-xs text-slate-500">
                            {p.codigo_barras ?? p.codigo_interno ?? 'Sin código'} · {ARS(p.precio_venta)}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {!buscando && query.trim() && resultados.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">Sin resultados</p>
            )}

            <button
              onClick={agregarSeleccionados}
              disabled={seleccionados.size === 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar seleccionados ({seleccionados.size})
            </button>
          </div>

          {/* ─── Sección 2: Lista ────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              2. Etiquetas a imprimir
            </h2>

            {lista.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <Tag className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Aún no agregaste productos</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {lista.map(item => (
                  <div key={item.producto.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.producto.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {item.codigoEfectivo}
                        {item.generado && (
                          <span className="ml-1 text-amber-600 font-medium">(generado)</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <label className="text-xs text-slate-500 mr-1">Cant.</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={item.cantidad}
                        onChange={e => setCantidad(item.producto.id, Number(e.target.value))}
                        className="w-14 px-2 py-1 text-sm text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={() => eliminarDeLista(item.producto.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {lista.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-slate-400 text-right">
                  {etiquetasExpandidas.length} etiqueta{etiquetasExpandidas.length !== 1 ? 's' : ''} en total
                </p>
                {errorGuard && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {errorGuard}
                  </p>
                )}
                <button
                  onClick={generarEtiquetas}
                  disabled={guardando}
                  className="w-full px-4 py-2.5 text-sm font-semibold bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {guardando ? 'Guardando códigos...' : 'Generar etiquetas para imprimir'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Sección 3: Preview ────────────────────────────────────────── */}
        {preview && (
          <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                3. Vista previa — {etiquetasExpandidas.length} etiqueta{etiquetasExpandidas.length !== 1 ? 's' : ''}
              </h2>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>

            <div className="flex flex-wrap gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
              {etiquetasExpandidas.map(item => (
                <BarcodeLabel key={item.key} item={item} />
              ))}
            </div>

            <p className="text-xs text-slate-400 text-center">
              Al imprimir, se ocultará todo excepto las etiquetas · Layout A4 · 4 columnas
            </p>
          </div>
        )}
      </div>
    </>
  )
}
