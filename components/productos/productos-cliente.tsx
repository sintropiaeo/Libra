'use client'

import { useState, useTransition, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, AlertTriangle, X, Package, Upload,
  ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import { formatDistanceToNow, format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  crearProducto,
  actualizarProducto,
  toggleActivoProducto,
} from '@/app/(dashboard)/productos/actions'
import ImportarModal from '@/components/productos/importar-modal'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Categoria = { id: string; nombre: string }

type Producto = {
  id: string
  nombre: string
  descripcion: string | null
  categoria_id: string | null
  precio_costo: number
  precio_venta: number
  stock_actual: number
  stock_minimo: number
  codigo_barras: string | null
  codigo_interno: string | null
  unidad: 'unidad' | 'pack' | 'resma' | 'metro'
  activo: boolean
  permitir_venta_sin_stock: boolean
  updated_at: string | null
  categorias: { nombre: string } | null
}

type FormValues = {
  nombre: string
  descripcion: string
  categoria_id: string
  precio_costo: string
  precio_venta: string
  stock_actual: string
  stock_minimo: string
  codigo_barras: string
  codigo_interno: string
  unidad: 'unidad' | 'pack' | 'resma' | 'metro'
  permitir_venta_sin_stock: boolean
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const UNIDADES = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'pack',   label: 'Pack'   },
  { value: 'resma',  label: 'Resma'  },
  { value: 'metro',  label: 'Metro'  },
]

const FORM_VACIO: FormValues = {
  nombre:                   '',
  descripcion:              '',
  categoria_id:             '',
  precio_costo:             '',
  precio_venta:             '',
  stock_actual:             '0',
  stock_minimo:             '5',
  codigo_barras:            '',
  codigo_interno:           '',
  unidad:                   'unidad',
  permitir_venta_sin_stock: true,
}

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(v)

// ─── Componente principal ─────────────────────────────────────────────────────

type SortField = 'nombre' | 'updated_at'
type SortDir   = 'asc' | 'desc'

interface Props {
  productos:   Producto[]
  total:       number
  page:        number
  pageSize:    number
  categorias:  Categoria[]
  puedeEditar?: boolean
  q:           string
  cat:         string
  sort:        SortField
  dir:         SortDir
}

export default function ProductosCliente({
  productos, total, page, pageSize, categorias, puedeEditar = true, q, cat, sort, dir,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Modal crear/editar
  const [modalAbierto,     setModalAbierto]     = useState(false)
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null)
  const [form,             setForm]             = useState<FormValues>(FORM_VACIO)
  const [guardando,        setGuardando]        = useState(false)
  const [error,            setError]            = useState<string | null>(null)

  // Modal importar
  const [modalImportar, setModalImportar] = useState(false)

  // Búsqueda con debounce (no hace navigate en cada tecla)
  const debounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastInputTimeRef = useRef(0)
  const isScannerRef     = useRef(false)
  const [busquedaLocal, setBusquedaLocal] = useState(q)

  const navigate = useCallback((params: { q?: string; cat?: string; p?: number; sort?: SortField; dir?: SortDir }) => {
    const sp = new URLSearchParams()
    const newQ    = params.q    !== undefined ? params.q    : q
    const newCat  = params.cat  !== undefined ? params.cat  : cat
    const newP    = params.p    !== undefined ? params.p    : 1
    const newSort = params.sort !== undefined ? params.sort : sort
    const newDir  = params.dir  !== undefined ? params.dir  : dir
    if (newQ)              sp.set('q',    newQ)
    if (newCat)            sp.set('cat',  newCat)
    if (newP > 1)          sp.set('p',    String(newP))
    if (newSort !== 'nombre') sp.set('sort', newSort)
    if (newDir  !== 'asc')    sp.set('dir',  newDir)
    startTransition(() => router.push(`/productos?${sp.toString()}`))
  }, [q, cat, sort, dir, router])

  function handleSort(field: SortField) {
    if (field === sort) {
      navigate({ sort: field, dir: dir === 'asc' ? 'desc' : 'asc', p: 1 })
    } else {
      navigate({ sort: field, dir: field === 'updated_at' ? 'desc' : 'asc', p: 1 })
    }
  }

  function formatRelativo(iso: string | null): string {
    if (!iso) return '—'
    const fecha = new Date(iso)
    const dias  = differenceInDays(new Date(), fecha)
    if (dias < 7) return formatDistanceToNow(fecha, { locale: es, addSuffix: true })
    return `el ${format(fecha, 'dd/MM/yyyy', { locale: es })}`
  }

  function formatAbsoluto(iso: string | null): string {
    if (!iso) return '—'
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: es })
  }

  function handleBusqueda(e: React.ChangeEvent<HTMLInputElement>) {
    const now = Date.now()
    const gap = now - lastInputTimeRef.current
    lastInputTimeRef.current = now
    if (gap > 200)                isScannerRef.current = false
    else if (gap > 0 && gap < 50) isScannerRef.current = true

    const value = e.target.value
    setBusquedaLocal(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => navigate({ q: value, p: 1 }), 350)
  }

  function handleKeyDownBusqueda(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && isScannerRef.current && busquedaLocal.trim()) {
      e.preventDefault()
      if (debounceRef.current) clearTimeout(debounceRef.current)
      isScannerRef.current = false
      navigate({ q: busquedaLocal.trim(), p: 1 })
    }
  }

  function handleCategoria(value: string) {
    navigate({ cat: value, p: 1 })
  }

  // ─── Modal helpers ────────────────────────────────────────────────────────

  function abrirNuevo() {
    setProductoEditando(null)
    setForm(FORM_VACIO)
    setError(null)
    setModalAbierto(true)
  }

  function abrirEditar(p: Producto) {
    setProductoEditando(p)
    setForm({
      nombre:                   p.nombre,
      descripcion:              p.descripcion   ?? '',
      categoria_id:             p.categoria_id  ?? '',
      precio_costo:             String(p.precio_costo),
      precio_venta:             String(p.precio_venta),
      stock_actual:             String(p.stock_actual),
      stock_minimo:             String(p.stock_minimo),
      codigo_barras:            p.codigo_barras  ?? '',
      codigo_interno:           p.codigo_interno ?? '',
      unidad:                   p.unidad,
      permitir_venta_sin_stock: p.permitir_venta_sin_stock ?? true,
    })
    setError(null)
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setProductoEditando(null)
    setError(null)
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)

    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, String(v)))

    const result = productoEditando
      ? await actualizarProducto(productoEditando.id, fd)
      : await crearProducto(fd)

    if (result?.error) {
      setError(result.error)
      setGuardando(false)
      return
    }

    cerrarModal()
    setGuardando(false)
    startTransition(() => router.refresh())
  }

  async function handleToggle(e: React.MouseEvent, p: Producto) {
    e.stopPropagation()
    await toggleActivoProducto(p.id, !p.activo)
    startTransition(() => router.refresh())
  }

  // ─── Paginación ────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(total / pageSize)

  // ─── Estilos reutilizables ────────────────────────────────────────────────

  const input =
    'w-full px-3 py-2 text-base rounded-lg border border-slate-200 text-slate-900 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white'
  const label = 'block text-sm font-medium text-slate-700 mb-1.5'

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Productos</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {total.toLocaleString('es-AR')} productos en total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {puedeEditar && (
            <button
              onClick={() => setModalImportar(true)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors border border-slate-200"
            >
              <Upload className="w-4 h-4" />
              Importar
            </button>
          )}
          {puedeEditar && (
            <button
              onClick={abrirNuevo}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo producto
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            id="busqueda-productos"
            name="busqueda-productos"
            type="search"
            placeholder="Buscar por nombre o código de barras..."
            value={busquedaLocal}
            onChange={handleBusqueda}
            onKeyDown={handleKeyDownBusqueda}
            className="w-full pl-9 pr-4 py-2.5 text-base rounded-lg border border-slate-200 text-slate-900 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
          />
        </div>
        <select
          id="categoria-filtro"
          name="categoria-filtro"
          value={cat}
          onChange={(e) => handleCategoria(e.target.value)}
          className="px-3 py-2.5 text-sm rounded-lg border border-slate-200 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        {(q || cat)
          ? `${total.toLocaleString('es-AR')} resultado${total !== 1 ? 's' : ''}`
          : `Mostrando ${Math.min((page - 1) * pageSize + 1, total)}–${Math.min(page * pageSize, total)} de ${total.toLocaleString('es-AR')}`
        }
      </p>

      {/* Tabla */}
      <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden transition-opacity ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
        {productos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <Package className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              {q || cat ? 'Sin resultados para esta búsqueda' : 'No hay productos cargados'}
            </p>
            {!q && !cat && (
              <p className="text-xs text-slate-400 mt-1">
                Creá tu primer producto con el botón de arriba
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3.5">
                    <button
                      onClick={() => handleSort('nombre')}
                      className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                    >
                      Nombre
                      {sort === 'nombre'
                        ? dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="px-5 py-3.5">Código</th>
                  <th className="px-5 py-3.5">Categoría</th>
                  <th className="px-5 py-3.5">P. Venta</th>
                  <th className="px-5 py-3.5">Stock</th>
                  <th className="px-5 py-3.5">Unidad</th>
                  <th className="px-5 py-3.5">
                    <button
                      onClick={() => handleSort('updated_at')}
                      className="flex items-center gap-1 hover:text-slate-600 transition-colors whitespace-nowrap"
                    >
                      Última modificación
                      {sort === 'updated_at'
                        ? dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  </th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productos.map((p) => {
                  const stockBajo = p.stock_actual < p.stock_minimo
                  return (
                    <tr
                      key={p.id}
                      onClick={() => puedeEditar && abrirEditar(p)}
                      className={`transition-colors ${puedeEditar ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                    >
                      <td className="px-5 py-4 max-w-xs">
                        <p className="font-medium text-slate-800">{p.nombre}</p>
                        {p.codigo_barras && (
                          <p className="text-xs text-slate-500 mt-0.5 font-mono">{p.codigo_barras}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-sm text-slate-600 whitespace-nowrap">
                        {p.codigo_interno ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 whitespace-nowrap">
                          {p.categorias?.nombre ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-800 whitespace-nowrap">
                        {ARS(p.precio_venta)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {stockBajo ? (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            <span className="font-semibold text-red-600">{p.stock_actual}</span>
                            <span className="text-xs text-red-400">/ mín.{p.stock_minimo}</span>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-700">{p.stock_actual}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-500 capitalize">{p.unidad}</td>
                      <td className="px-5 py-4 text-xs text-slate-600 whitespace-nowrap">
                        {formatRelativo(p.updated_at)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${p.activo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {puedeEditar && (
                          <button
                            onClick={(e) => handleToggle(e, p)}
                            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                              p.activo
                                ? 'text-slate-500 hover:bg-red-50 hover:text-red-600'
                                : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                            }`}
                          >
                            {p.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-400">
            Página {page} de {totalPages.toLocaleString('es-AR')}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ p: page - 1 })}
              disabled={page <= 1 || isPending}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>

            {/* Números de página (máx 5 visibles) */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number
                if (totalPages <= 5) {
                  p = i + 1
                } else if (page <= 3) {
                  p = i + 1
                } else if (page >= totalPages - 2) {
                  p = totalPages - 4 + i
                } else {
                  p = page - 2 + i
                }
                return (
                  <button
                    key={p}
                    onClick={() => navigate({ p })}
                    disabled={isPending}
                    className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
                      p === page
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => navigate({ p: page + 1 })}
              disabled={page >= totalPages || isPending}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {modalAbierto && puedeEditar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) cerrarModal() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-semibold text-slate-900">
                {productoEditando ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <div className="flex items-center gap-3">
                {productoEditando?.updated_at && (
                  <span className="text-xs text-slate-400">
                    Última modificación: {formatAbsoluto(productoEditando.updated_at)}
                  </span>
                )}
                <button onClick={cerrarModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form id="form-producto" onSubmit={handleSubmit} className="overflow-y-auto">
              <div className="px-6 py-5 space-y-4">

                <div>
                  <label htmlFor="p-nombre" className={label}>Nombre *</label>
                  <input
                    id="p-nombre" name="p-nombre" type="text" required minLength={2}
                    placeholder="Ej: Lapicera azul"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className={input}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="p-cod-interno" className={label}>Código interno</label>
                    <input
                      id="p-cod-interno" name="codigo_interno" type="text"
                      placeholder="Ej: A-101, LIB-25"
                      value={form.codigo_interno}
                      onChange={(e) => setForm({ ...form, codigo_interno: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label htmlFor="p-barras" className={label}>Código de barras</label>
                    <input
                      id="p-barras" name="p-barras" type="text" placeholder="Opcional"
                      value={form.codigo_barras}
                      onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })}
                      className={input}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="p-descripcion" className={label}>Descripción</label>
                  <input
                    id="p-descripcion" name="p-descripcion" type="text"
                    placeholder="Descripción breve (opcional)"
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    className={input}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="p-categoria" className={label}>Categoría</label>
                    <select
                      id="p-categoria" name="p-categoria"
                      value={form.categoria_id}
                      onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
                      className={input}
                    >
                      <option value="">Sin categoría</option>
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="p-unidad" className={label}>Unidad de medida *</label>
                    <select
                      id="p-unidad" name="p-unidad" required
                      value={form.unidad}
                      onChange={(e) => setForm({ ...form, unidad: e.target.value as FormValues['unidad'] })}
                      className={input}
                    >
                      {UNIDADES.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="p-costo" className={label}>Precio costo *</label>
                    <input
                      id="p-costo" name="p-costo" type="number" required min="0" step="0.01" placeholder="0"
                      value={form.precio_costo}
                      onChange={(e) => setForm({ ...form, precio_costo: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label htmlFor="p-venta" className={label}>Precio venta *</label>
                    <input
                      id="p-venta" name="p-venta" type="number" required min="0" step="0.01" placeholder="0"
                      value={form.precio_venta}
                      onChange={(e) => setForm({ ...form, precio_venta: e.target.value })}
                      className={input}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="p-stock" className={label}>Stock actual *</label>
                    <input
                      id="p-stock" name="p-stock" type="number" required min="0" step="1"
                      value={form.stock_actual}
                      onChange={(e) => setForm({ ...form, stock_actual: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label htmlFor="p-stock-min" className={label}>Stock mínimo *</label>
                    <input
                      id="p-stock-min" name="p-stock-min" type="number" required min="0" step="1"
                      value={form.stock_minimo}
                      onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })}
                      className={input}
                    />
                  </div>
                </div>

                <div
                  className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-colors cursor-pointer ${
                    form.permitir_venta_sin_stock ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'
                  }`}
                  onClick={() => setForm({ ...form, permitir_venta_sin_stock: !form.permitir_venta_sin_stock })}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">Permitir vender sin stock</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {form.permitir_venta_sin_stock
                        ? 'Se puede vender aunque el stock sea 0 o negativo'
                        : 'El producto se bloquea en el POS cuando el stock llega a 0'}
                    </p>
                  </div>
                  <div className={`relative shrink-0 ml-4 w-11 h-6 rounded-full transition-colors ${
                    form.permitir_venta_sin_stock ? 'bg-blue-500' : 'bg-slate-300'
                  }`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.permitir_venta_sin_stock ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl shrink-0">
                <button
                  type="button" onClick={cerrarModal}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={guardando}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
                >
                  {guardando ? 'Guardando...' : productoEditando ? 'Guardar cambios' : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal importar */}
      {modalImportar && (
        <ImportarModal
          onClose={() => setModalImportar(false)}
          onSuccess={() => {
            setModalImportar(false)
            startTransition(() => router.refresh())
          }}
        />
      )}
    </div>
  )
}
