'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Plus, Minus, X, Trash2, CheckCircle,
  AlertTriangle, ShoppingBag, Package, Building2, Clock,
  PackagePlus, ArrowRight, RefreshCw,
} from 'lucide-react'
import { crearCompra, crearProductoRapido } from '@/app/(dashboard)/compras/actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Producto = {
  id: string
  nombre: string
  precio_costo: number
  stock_actual: number
  unidad: string
  codigo_barras: string | null
  categorias: { nombre: string } | null
}

type Proveedor = {
  id: string
  nombre: string
}

type CartItem = {
  producto_id: string
  nombre: string
  precio_unitario: number   // puede diferir del precio_costo original
  unidad: string
  cantidad: number
}

type CambioPrecio = {
  producto_id: string
  nombre: string
  precioOriginal: number
  precioNuevo: number
  actualizar: boolean
}

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(v)

const UNIDADES = ['unidad', 'pack', 'resma', 'metro']

// ─── Componente ───────────────────────────────────────────────────────────────

export default function NuevaCompraCliente({
  productos,
  proveedores,
}: {
  productos: Producto[]
  proveedores: Proveedor[]
}) {
  const router = useRouter()
  const searchRef = useRef<HTMLInputElement>(null)

  // Productos disponibles (incluye los creados inline)
  const [productosLocales, setProductosLocales] = useState<Producto[]>(productos)

  // Mapa inmutable de precios originales — se actualiza solo cuando se crea un producto nuevo
  const preciosOriginalesRef = useRef<Map<string, number>>(
    new Map(productos.map((p) => [p.id, p.precio_costo]))
  )

  // ─── Estado del carrito ────────────────────────────────────────────────────
  const [busqueda,    setBusqueda]    = useState('')
  const [cart,        setCart]        = useState<CartItem[]>([])
  const [preciosStr,  setPreciosStr]  = useState<Record<string, string>>({}) // inputs controlados
  const [proveedorId, setProveedorId] = useState<string>('')
  const [notas,       setNotas]       = useState('')
  const [procesando,  setProcesando]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [compraExitosa, setCompraExitosa] = useState<{ compraId: string; total: number } | null>(null)

  // ─── Modal: crear producto nuevo ──────────────────────────────────────────
  const [modalProducto, setModalProducto] = useState(false)
  const [formProducto, setFormProducto]   = useState({
    nombre: '', unidad: 'unidad', precio_costo: '', stock_minimo: '5',
  })
  const [creandoProducto,  setCreandoProducto]  = useState(false)
  const [errorProducto,    setErrorProducto]    = useState<string | null>(null)

  // ─── Modal: confirmar cambios de precio ───────────────────────────────────
  const [modalPrecios,  setModalPrecios]  = useState(false)
  const [cambiosPrecios, setCambiosPrecios] = useState<CambioPrecio[]>([])

  useEffect(() => { searchRef.current?.focus() }, [])

  // ─── Filtrado ──────────────────────────────────────────────────────────────

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return productosLocales.slice(0, 40)
    return productosLocales
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.codigo_barras && p.codigo_barras.includes(busqueda.trim()))
      )
      .slice(0, 40)
  }, [productosLocales, busqueda])

  // ─── Carrito ───────────────────────────────────────────────────────────────

  function agregarAlCarrito(p: Producto) {
    setCart((prev) => {
      const existing = prev.find((i) => i.producto_id === p.id)
      if (existing) {
        return prev.map((i) =>
          i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      }
      // Registrar precio original si no existe (por productos creados inline)
      if (!preciosOriginalesRef.current.has(p.id)) {
        preciosOriginalesRef.current.set(p.id, p.precio_costo)
      }
      setPreciosStr((prev) => ({ ...prev, [p.id]: String(p.precio_costo) }))
      return [
        ...prev,
        {
          producto_id:     p.id,
          nombre:          p.nombre,
          precio_unitario: p.precio_costo,
          unidad:          p.unidad,
          cantidad:        1,
        },
      ]
    })
    setBusqueda('')
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  function incrementar(id: string) {
    setCart((prev) =>
      prev.map((i) => i.producto_id === id ? { ...i, cantidad: i.cantidad + 1 } : i)
    )
  }

  function decrementar(id: string) {
    setCart((prev) => {
      const item = prev.find((i) => i.producto_id === id)
      if (!item) return prev
      if (item.cantidad <= 1) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: _removed, ...rest } = preciosStr
        setPreciosStr(rest)
        return prev.filter((i) => i.producto_id !== id)
      }
      return prev.map((i) => i.producto_id === id ? { ...i, cantidad: i.cantidad - 1 } : i)
    })
  }

  function setCantidad(id: string, v: number) {
    if (isNaN(v) || v < 1) return
    setCart((prev) =>
      prev.map((i) => i.producto_id === id ? { ...i, cantidad: v } : i)
    )
  }

  function handlePrecioChange(id: string, raw: string) {
    setPreciosStr((prev) => ({ ...prev, [id]: raw }))
    const v = parseFloat(raw.replace(',', '.'))
    if (!isNaN(v) && v >= 0) {
      setCart((prev) =>
        prev.map((i) => i.producto_id === id ? { ...i, precio_unitario: v } : i)
      )
    }
  }

  function eliminar(id: string) {
    setCart((prev) => prev.filter((i) => i.producto_id !== id))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setPreciosStr((prev) => { const { [id]: _removed, ...rest } = prev; return rest })
  }

  function vaciar() {
    setCart([])
    setPreciosStr({})
    setError(null)
  }

  const total         = cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0)
  const cantidadItems = cart.reduce((s, i) => s + i.cantidad, 0)

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && productosFiltrados.length > 0) {
      e.preventDefault()
      agregarAlCarrito(productosFiltrados[0])
    }
  }

  // ─── Crear producto inline ─────────────────────────────────────────────────

  function abrirModalProducto() {
    setFormProducto({ nombre: busqueda.trim(), unidad: 'unidad', precio_costo: '', stock_minimo: '5' })
    setErrorProducto(null)
    setModalProducto(true)
  }

  async function handleCrearProducto(e: React.FormEvent) {
    e.preventDefault()
    if (!formProducto.nombre.trim()) { setErrorProducto('El nombre es obligatorio.'); return }
    setCreandoProducto(true)
    setErrorProducto(null)

    const fd = new FormData()
    fd.set('nombre',       formProducto.nombre.trim())
    fd.set('unidad',       formProducto.unidad)
    fd.set('precio_costo', formProducto.precio_costo || '0')
    fd.set('stock_minimo', formProducto.stock_minimo || '5')

    const result = await crearProductoRapido(fd)
    setCreandoProducto(false)

    if (result.error) { setErrorProducto(result.error); return }

    const nuevo = result.producto!

    // Agregarlo a la lista local y al mapa de precios originales
    setProductosLocales((prev) => [...prev, nuevo])
    preciosOriginalesRef.current.set(nuevo.id, nuevo.precio_costo)

    // Agregarlo al carrito directamente
    setPreciosStr((prev) => ({ ...prev, [nuevo.id]: String(nuevo.precio_costo) }))
    setCart((prev) => [
      ...prev,
      {
        producto_id:     nuevo.id,
        nombre:          nuevo.nombre,
        precio_unitario: nuevo.precio_costo,
        unidad:          nuevo.unidad,
        cantidad:        1,
      },
    ])

    setModalProducto(false)
    setBusqueda('')
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  // ─── Detectar cambios de precio y confirmar ────────────────────────────────

  function handleConfirmarClick() {
    if (cart.length === 0 || procesando) return

    // Comparar precio_unitario de cada ítem con el precio_costo original
    const cambios: CambioPrecio[] = cart
      .filter((item) => {
        const original = preciosOriginalesRef.current.get(item.producto_id)
        return original !== undefined && Math.abs(original - item.precio_unitario) > 0.001
      })
      .map((item) => ({
        producto_id:    item.producto_id,
        nombre:         item.nombre,
        precioOriginal: preciosOriginalesRef.current.get(item.producto_id)!,
        precioNuevo:    item.precio_unitario,
        actualizar:     true, // por defecto, proponer actualizar
      }))

    if (cambios.length > 0) {
      setCambiosPrecios(cambios)
      setModalPrecios(true)
    } else {
      ejecutarCompra([])
    }
  }

  async function ejecutarCompra(actualizarPrecios: { producto_id: string; precio_costo: number }[]) {
    setModalPrecios(false)
    setProcesando(true)
    setError(null)

    const result = await crearCompra({
      proveedor_id: proveedorId || null,
      items: cart.map((i) => ({
        producto_id:     i.producto_id,
        cantidad:        i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
      notas,
      actualizarPrecios,
    })

    if (result.error) {
      setError(result.error)
      setProcesando(false)
      return
    }

    setCompraExitosa({ compraId: result.compraId!, total })
    setCart([])
    setPreciosStr({})
    setProcesando(false)
  }

  function confirmarCambiosPrecios() {
    const aActualizar = cambiosPrecios
      .filter((c) => c.actualizar)
      .map((c) => ({ producto_id: c.producto_id, precio_costo: c.precioNuevo }))
    ejecutarCompra(aActualizar)
  }

  function nuevaCompra() {
    setCompraExitosa(null)
    setProveedorId('')
    setNotas('')
    setBusqueda('')
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <ShoppingBag className="w-5 h-5 text-blue-600" />
          <h1 className="font-bold text-slate-900">Nueva Compra</h1>
        </div>
        <Link
          href="/compras"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <Clock className="w-4 h-4" />
          Ver historial
        </Link>
      </div>

      {/* Área principal */}
      <div className="flex flex-1 overflow-hidden bg-slate-50">

        {/* ── Panel izquierdo ── */}
        <div className="flex flex-col flex-1 overflow-hidden bg-white border-r border-slate-200">

          {/* Buscador */}
          <div className="p-4 border-b border-slate-100 bg-white">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Buscar producto o código de barras..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition"
                />
              </div>
              {/* Botón crear producto */}
              <button
                onClick={abrirModalProducto}
                title="Crear producto nuevo"
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 text-sm font-medium rounded-xl transition-colors shrink-0 border border-slate-200 hover:border-blue-600"
              >
                <PackagePlus className="w-4 h-4" />
                <span className="hidden sm:inline">Nuevo producto</span>
              </button>
            </div>
            {busqueda && (
              <p className="text-xs text-slate-400 mt-2 ml-1">
                {productosFiltrados.length} resultado{productosFiltrados.length !== 1 && 's'} · Enter para agregar el primero
              </p>
            )}
          </div>

          {/* Lista de productos */}
          <div className="flex-1 overflow-y-auto">
            {productosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Package className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm mb-3">No se encontraron productos</p>
                <button
                  onClick={abrirModalProducto}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  <PackagePlus className="w-4 h-4" />
                  Crear &quot;{busqueda || 'nuevo producto'}&quot;
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {productosFiltrados.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => agregarAlCarrito(p)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50 active:bg-blue-100 transition-colors group text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{p.nombre}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {p.categorias?.nombre ?? '—'} · {p.unidad}
                          {p.codigo_barras && (
                            <span className="ml-2 text-slate-300">#{p.codigo_barras}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-slate-700">{ARS(p.precio_costo)}</p>
                        <p className="text-xs text-slate-400">
                          Stock: {p.stock_actual} {p.unidad}
                        </p>
                      </div>
                      <span className="shrink-0 w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="w-4 h-4" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Panel derecho ── */}
        <div className="w-[440px] shrink-0 flex flex-col bg-white shadow-xl">

          {compraExitosa ? (
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">¡Compra registrada!</h2>
              <p className="text-sm text-slate-500 mb-3">El stock fue actualizado automáticamente</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1 mb-1">
                {ARS(compraExitosa.total)}
              </p>
              <p className="text-xs text-slate-400 font-mono mb-8">
                #{compraExitosa.compraId.slice(-8).toUpperCase()}
              </p>
              <button
                onClick={nuevaCompra}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors text-base"
              >
                Nueva compra
              </button>
              <Link
                href={`/compras/${compraExitosa.compraId}`}
                className="mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => router.refresh()}
              >
                Ver detalle →
              </Link>
            </div>
          ) : (
            <>
              {/* Header carrito */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-800 text-sm">Detalle de compra</span>
                  {cantidadItems > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {cantidadItems}
                    </span>
                  )}
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={vaciar}
                    title="Vaciar"
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Ítems */}
              <div className="flex-1 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <ShoppingBag className="w-10 h-10 text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400">
                      Buscá un producto y presioná{' '}
                      <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-mono text-xs">Enter</kbd>{' '}
                      o hacé clic para agregarlo
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 px-4 py-1">
                    {cart.map((item) => {
                      const original = preciosOriginalesRef.current.get(item.producto_id)
                      const precioCambio = original !== undefined && Math.abs(original - item.precio_unitario) > 0.001
                      return (
                        <li key={item.producto_id} className="py-3">
                          {/* Nombre */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-medium text-slate-800 text-sm leading-tight">
                              {item.nombre}
                            </p>
                            <button
                              onClick={() => eliminar(item.producto_id)}
                              className="text-slate-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          {/* Controles */}
                          <div className="flex items-center gap-2">
                            {/* Cantidad */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => decrementar(item.producto_id)}
                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                              >
                                <Minus className="w-3 h-3 text-slate-600" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={item.cantidad}
                                onChange={(e) =>
                                  setCantidad(item.producto_id, parseInt(e.target.value))
                                }
                                className="w-11 text-center text-sm font-bold border border-slate-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => incrementar(item.producto_id)}
                                className="w-7 h-7 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Precio unitario editable (controlado) */}
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              <span className="text-xs text-slate-400 shrink-0">$</span>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={preciosStr[item.producto_id] ?? item.precio_unitario}
                                onChange={(e) => handlePrecioChange(item.producto_id, e.target.value)}
                                className={`w-full text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                  precioCambio
                                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                                    : 'border-slate-200'
                                }`}
                                title="Precio de costo (editable)"
                              />
                            </div>

                            {/* Subtotal */}
                            <p className="text-sm font-bold text-slate-800 w-20 text-right shrink-0">
                              {ARS(item.precio_unitario * item.cantidad)}
                            </p>
                          </div>
                          {/* Aviso precio cambió respecto al catálogo */}
                          {precioCambio && (
                            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Precio de catálogo: {ARS(original!)} — se preguntará si actualizar
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 shrink-0">

                {/* Total */}
                <div className="px-5 py-3.5 flex items-center justify-between bg-slate-50 border-b border-slate-200">
                  <span className="text-slate-600 font-medium text-sm">Total</span>
                  <span className="text-2xl font-bold text-slate-900">{ARS(total)}</span>
                </div>

                {/* Proveedor + Notas */}
                <div className="px-5 py-4 space-y-3 border-b border-slate-200">
                  <div>
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wide block mb-1.5">
                      Proveedor
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <select
                        value={proveedorId}
                        onChange={(e) => setProveedorId(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                      >
                        <option value="">Sin proveedor</option>
                        {proveedores.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wide block mb-1.5">
                      Notas (opcional)
                    </label>
                    <input
                      type="text"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Remito, factura, observaciones..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {error && (
                  <div className="mx-5 mt-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2.5 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="p-4">
                  <button
                    onClick={handleConfirmarClick}
                    disabled={cart.length === 0 || procesando}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-2xl transition-colors shadow-sm"
                  >
                    {procesando
                      ? 'Registrando...'
                      : cart.length === 0
                      ? 'Agregá productos'
                      : `Confirmar compra · ${ARS(total)}`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ Modal: Crear producto nuevo ═══════════════════════════════════════ */}
      {modalProducto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModalProducto(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-slate-900">Crear producto nuevo</h2>
            </div>

            <form onSubmit={handleCrearProducto}>
              <div className="px-6 py-5 space-y-4">
                <p className="text-xs text-slate-500">
                  El producto se crea con stock 0. Al confirmar la compra, el stock sube automáticamente.
                </p>

                {/* Nombre */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formProducto.nombre}
                    onChange={(e) => setFormProducto({ ...formProducto, nombre: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre del producto"
                    autoFocus
                  />
                </div>

                {/* Unidad + Precio */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Unidad</label>
                    <select
                      value={formProducto.unidad}
                      onChange={(e) => setFormProducto({ ...formProducto, unidad: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Precio de costo</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={formProducto.precio_costo}
                      onChange={(e) => setFormProducto({ ...formProducto, precio_costo: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Stock mínimo */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Stock mínimo</label>
                  <input
                    type="number"
                    min={0}
                    value={formProducto.stock_minimo}
                    onChange={(e) => setFormProducto({ ...formProducto, stock_minimo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Podés editar precio de venta y más datos desde la sección Productos</p>
                </div>

                {errorProducto && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {errorProducto}
                  </p>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalProducto(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creandoProducto}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60"
                >
                  {creandoProducto ? (
                    <>Creando...</>
                  ) : (
                    <>
                      Crear y agregar
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Modal: Cambios de precio ══════════════════════════════════════════ */}
      {modalPrecios && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-slate-900">Cambios en precios de costo</h2>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 mb-4">
                Los siguientes productos tienen un precio de compra diferente al registrado en el catálogo.
                Seleccioná cuáles querés actualizar:
              </p>

              <ul className="space-y-2 mb-5">
                {cambiosPrecios.map((c) => (
                  <li key={c.producto_id}>
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 cursor-pointer transition-colors has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50">
                      <input
                        type="checkbox"
                        checked={c.actualizar}
                        onChange={(e) =>
                          setCambiosPrecios((prev) =>
                            prev.map((x) =>
                              x.producto_id === c.producto_id
                                ? { ...x, actualizar: e.target.checked }
                                : x
                            )
                          )
                        }
                        className="w-4 h-4 accent-blue-600 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{c.nombre}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Catálogo: <span className="font-mono">{ARS(c.precioOriginal)}</span>
                          <span className="mx-1.5 text-slate-300">→</span>
                          <span className="font-mono font-semibold text-slate-800">{ARS(c.precioNuevo)}</span>
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          c.precioNuevo > c.precioOriginal
                            ? 'text-red-500'
                            : 'text-emerald-600'
                        }`}
                      >
                        {c.precioNuevo > c.precioOriginal ? '▲' : '▼'}{' '}
                        {Math.round(Math.abs((c.precioNuevo - c.precioOriginal) / c.precioOriginal) * 100)}%
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => ejecutarCompra([])}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  No actualizar nada
                </button>
                <button
                  onClick={confirmarCambiosPrecios}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                >
                  {cambiosPrecios.some((c) => c.actualizar)
                    ? `Actualizar ${cambiosPrecios.filter((c) => c.actualizar).length} precio${cambiosPrecios.filter((c) => c.actualizar).length > 1 ? 's' : ''} y confirmar`
                    : 'Confirmar sin actualizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
