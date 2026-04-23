'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, AlertTriangle, X, Package, Upload,
} from 'lucide-react'
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
  unidad: 'unidad' | 'pack' | 'resma' | 'metro'
  activo: boolean
  permitir_venta_sin_stock: boolean
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
  unidad: 'unidad' | 'pack' | 'resma' | 'metro'
  permitir_venta_sin_stock: boolean
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const UNIDADES = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'pack',   label: 'Pack' },
  { value: 'resma',  label: 'Resma' },
  { value: 'metro',  label: 'Metro' },
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
  unidad:                   'unidad',
  permitir_venta_sin_stock: true,
}

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(v)

// ─── Componente principal ─────────────────────────────────────────────────────

interface Props {
  initialProductos: Producto[]
  categorias:       Categoria[]
  puedeEditar?:     boolean
}

export default function ProductosCliente({ initialProductos, categorias, puedeEditar = true }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Filtros
  const [busqueda,  setBusqueda]  = useState('')
  const [catFiltro, setCatFiltro] = useState('')

  // Modal crear/editar
  const [modalAbierto,     setModalAbierto]     = useState(false)
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null)
  const [form,             setForm]             = useState<FormValues>(FORM_VACIO)
  const [guardando,        setGuardando]        = useState(false)
  const [error,            setError]            = useState<string | null>(null)

  // Modal importar
  const [modalImportar, setModalImportar] = useState(false)

  // ─── Filtrado ──────────────────────────────────────────────────────────────

  const productosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase()
    return initialProductos.filter((p) => {
      const matchNombre = p.nombre.toLowerCase().includes(q)
      const matchCat    = !catFiltro || p.categoria_id === catFiltro
      return matchNombre && matchCat
    })
  }, [initialProductos, busqueda, catFiltro])

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
      codigo_barras:            p.codigo_barras ?? '',
      unidad:                   p.unidad,
      permitir_venta_sin_stock: p.permitir_venta_sin_stock ?? false,
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

  // ─── Estilos reutilizables ────────────────────────────────────────────────

  const input =
    'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white'
  const label = 'block text-xs font-medium text-slate-600 mb-1.5'

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Productos</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestión de inventario y precios</p>
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
          />
        </div>
        <select
          value={catFiltro}
          onChange={(e) => setCatFiltro(e.target.value)}
          className="px-3 py-2.5 text-sm rounded-lg border border-slate-200 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        {productosFiltrados.length}{' '}
        {productosFiltrados.length === 1 ? 'producto' : 'productos'}
        {(busqueda || catFiltro) && ' encontrados'}
      </p>

      {/* Tabla */}
      <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden transition-opacity ${isPending ? 'opacity-60' : ''}`}>
        {productosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <Package className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              {busqueda || catFiltro
                ? 'Sin resultados para esta búsqueda'
                : 'No hay productos cargados'}
            </p>
            {!busqueda && !catFiltro && (
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
                  <th className="px-5 py-3.5">Nombre</th>
                  <th className="px-5 py-3.5">Categoría</th>
                  <th className="px-5 py-3.5">P. Venta</th>
                  <th className="px-5 py-3.5">Stock</th>
                  <th className="px-5 py-3.5">Unidad</th>
                  <th className="px-5 py-3.5">Estado</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productosFiltrados.map((p) => {
                  const stockBajo = p.stock_actual < p.stock_minimo
                  return (
                    <tr
                      key={p.id}
                      onClick={() => puedeEditar && abrirEditar(p)}
                      className={`transition-colors ${puedeEditar ? 'hover:bg-slate-50 cursor-pointer' : ''}`}
                    >
                      {/* Nombre */}
                      <td className="px-5 py-4 max-w-xs">
                        <p className="font-medium text-slate-800">{p.nombre}</p>
                        {p.descripcion && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{p.descripcion}</p>
                        )}
                      </td>

                      {/* Categoría */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 whitespace-nowrap">
                          {p.categorias?.nombre ?? '—'}
                        </span>
                      </td>

                      {/* Precio venta */}
                      <td className="px-5 py-4 font-medium text-slate-800 whitespace-nowrap">
                        {ARS(p.precio_venta)}
                      </td>

                      {/* Stock */}
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

                      {/* Unidad */}
                      <td className="px-5 py-4 text-slate-500 capitalize">{p.unidad}</td>

                      {/* Estado */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          p.activo
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${p.activo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      {/* Acciones */}
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

      {/* Modal (solo si puede editar) */}
      {modalAbierto && puedeEditar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) cerrarModal() }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-semibold text-slate-900">
                {productoEditando ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button
                onClick={cerrarModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="overflow-y-auto">
              <div className="px-6 py-5 space-y-4">

                {/* Nombre */}
                <div>
                  <label className={label}>Nombre *</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    placeholder="Ej: Lapicera azul"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className={input}
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className={label}>Descripción</label>
                  <input
                    type="text"
                    placeholder="Descripción breve (opcional)"
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    className={input}
                  />
                </div>

                {/* Categoría + Unidad */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={label}>Categoría</label>
                    <select
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
                    <label className={label}>Unidad de medida *</label>
                    <select
                      required
                      value={form.unidad}
                      onChange={(e) =>
                        setForm({ ...form, unidad: e.target.value as FormValues['unidad'] })
                      }
                      className={input}
                    >
                      {UNIDADES.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Precio costo + Precio venta */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={label}>Precio costo *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={form.precio_costo}
                      onChange={(e) => setForm({ ...form, precio_costo: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>Precio venta *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={form.precio_venta}
                      onChange={(e) => setForm({ ...form, precio_venta: e.target.value })}
                      className={input}
                    />
                  </div>
                </div>

                {/* Stock actual + Stock mínimo */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={label}>Stock actual *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={form.stock_actual}
                      onChange={(e) => setForm({ ...form, stock_actual: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>Stock mínimo *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={form.stock_minimo}
                      onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })}
                      className={input}
                    />
                  </div>
                </div>

                {/* Código de barras */}
                <div>
                  <label className={label}>Código de barras</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={form.codigo_barras}
                    onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })}
                    className={input}
                  />
                </div>

                {/* Permitir venta sin stock */}
                <div
                  className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-colors cursor-pointer ${
                    form.permitir_venta_sin_stock
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-200 bg-slate-50'
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
                  {/* Toggle switch */}
                  <div className={`relative shrink-0 ml-4 w-11 h-6 rounded-full transition-colors ${
                    form.permitir_venta_sin_stock ? 'bg-blue-500' : 'bg-slate-300'
                  }`}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.permitir_venta_sin_stock ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}
              </div>

              {/* Footer con botones */}
              <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl shrink-0">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
                >
                  {guardando
                    ? 'Guardando...'
                    : productoEditando
                    ? 'Guardar cambios'
                    : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal importar productos */}
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
