'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Plus, Minus, X, Trash2, CheckCircle,
  AlertTriangle, ShoppingBag, Package, Building2, Clock,
  PackagePlus, ArrowRight, RefreshCw, Paperclip,
} from 'lucide-react'
import { crearCompra, crearProductoRapido } from '@/app/(dashboard)/compras/actions'
import { createClient } from '@/lib/supabase/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Presentacion = {
  id: string
  nombre: string
  cantidad_base: number
  codigo_barras: string | null
}

type Producto = {
  id: string
  nombre: string
  precio_costo: number
  stock_actual: number
  unidad: string
  codigo_barras: string | null
  categorias: { nombre: string } | null
  presentaciones?: Presentacion[]
}

type Proveedor = {
  id: string
  nombre: string
}

type CartItem = {
  lineId: string                    // producto_id::presentacion_id|base
  producto_id: string
  presentacion_id: string | null
  presentacion_nombre: string | null
  cantidad_base: number             // factor de stock (1 para el producto base)
  nombre: string
  precio_unitario: number           // puede diferir del precio_costo original
  unidad: string
  cantidad: number
}

const lineKey = (productoId: string, presentacionId?: string | null) =>
  `${productoId}::${presentacionId ?? 'base'}`

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
  const [procesando,    setProcesando]    = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [compraExitosa, setCompraExitosa] = useState<{ compraId: string; total: number } | null>(null)
  const [archivoFile,   setArchivoFile]   = useState<File | null>(null)
  const archivoInputRef                   = useRef<HTMLInputElement>(null)

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

  // ─── Selector de presentación al agregar ──────────────────────────────────
  const [selectorProducto, setSelectorProducto] = useState<Producto | null>(null)

  useEffect(() => { searchRef.current?.focus() }, [])

  // ─── Filtrado ──────────────────────────────────────────────────────────────

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return productosLocales.slice(0, 40)
    const raw = busqueda.trim()
    return productosLocales
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.codigo_barras && p.codigo_barras.includes(raw)) ||
          (p.presentaciones ?? []).some(
            (pres) =>
              pres.nombre.toLowerCase().includes(q) ||
              (pres.codigo_barras && pres.codigo_barras.includes(raw))
          )
      )
      .slice(0, 40)
  }, [productosLocales, busqueda])

  // ─── Carrito ───────────────────────────────────────────────────────────────

  function agregarAlCarrito(p: Producto, presentacion: Presentacion | null = null) {
    const lid = lineKey(p.id, presentacion?.id)
    // Costo sugerido: para el base = precio_costo; para presentación = precio_costo × cantidad_base
    const costoSugerido = presentacion
      ? Math.round(p.precio_costo * presentacion.cantidad_base)
      : p.precio_costo

    setCart((prev) => {
      const existing = prev.find((i) => i.lineId === lid)
      if (existing) {
        return prev.map((i) => i.lineId === lid ? { ...i, cantidad: i.cantidad + 1 } : i)
      }
      // Registrar precio original del base si no existe (para el flujo de cambios de precio)
      if (!presentacion && !preciosOriginalesRef.current.has(p.id)) {
        preciosOriginalesRef.current.set(p.id, p.precio_costo)
      }
      setPreciosStr((prevP) => ({ ...prevP, [lid]: String(costoSugerido) }))
      return [
        ...prev,
        {
          lineId:              lid,
          producto_id:         p.id,
          presentacion_id:     presentacion?.id ?? null,
          presentacion_nombre: presentacion?.nombre ?? null,
          cantidad_base:       presentacion?.cantidad_base ?? 1,
          nombre:              p.nombre,
          precio_unitario:     costoSugerido,
          unidad:              p.unidad,
          cantidad:            1,
        },
      ]
    })
    setSelectorProducto(null)
    setBusqueda('')
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  // Al hacer clic en un producto: si tiene presentaciones, abrir selector; si no, agregar base
  function pedirAgregar(p: Producto) {
    if ((p.presentaciones?.length ?? 0) > 0) {
      setSelectorProducto(p)
    } else {
      agregarAlCarrito(p)
    }
  }

  // Al escanear/tipear + Enter: resolver por código exacto (presentación o base) antes de abrir selector
  function agregarDesdeBusqueda() {
    const code = busqueda.trim()
    if (code) {
      for (const p of productosLocales) {
        const pres = (p.presentaciones ?? []).find((x) => x.codigo_barras === code)
        if (pres) { agregarAlCarrito(p, pres); return }
        if (p.codigo_barras === code) { agregarAlCarrito(p); return }
      }
    }
    if (productosFiltrados.length > 0) pedirAgregar(productosFiltrados[0])
  }

  function incrementar(lid: string) {
    setCart((prev) =>
      prev.map((i) => i.lineId === lid ? { ...i, cantidad: i.cantidad + 1 } : i)
    )
  }

  function decrementar(lid: string) {
    setCart((prev) => {
      const item = prev.find((i) => i.lineId === lid)
      if (!item) return prev
      if (item.cantidad <= 1) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [lid]: _removed, ...rest } = preciosStr
        setPreciosStr(rest)
        return prev.filter((i) => i.lineId !== lid)
      }
      return prev.map((i) => i.lineId === lid ? { ...i, cantidad: i.cantidad - 1 } : i)
    })
  }

  function setCantidad(lid: string, v: number) {
    if (isNaN(v) || v < 1) return
    setCart((prev) =>
      prev.map((i) => i.lineId === lid ? { ...i, cantidad: v } : i)
    )
  }

  function handlePrecioChange(lid: string, raw: string) {
    setPreciosStr((prev) => ({ ...prev, [lid]: raw }))
    const v = parseFloat(raw.replace(',', '.'))
    if (!isNaN(v) && v >= 0) {
      setCart((prev) =>
        prev.map((i) => i.lineId === lid ? { ...i, precio_unitario: v } : i)
      )
    }
  }

  function eliminar(lid: string) {
    setCart((prev) => prev.filter((i) => i.lineId !== lid))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setPreciosStr((prev) => { const { [lid]: _removed, ...rest } = prev; return rest })
  }

  function vaciar() {
    setCart([])
    setPreciosStr({})
    setError(null)
  }

  const total         = cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0)
  const cantidadItems = cart.reduce((s, i) => s + i.cantidad, 0)

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      agregarDesdeBusqueda()
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

    // Agregarlo al carrito directamente (producto base, sin presentación)
    const lidNuevo = lineKey(nuevo.id)
    setPreciosStr((prev) => ({ ...prev, [lidNuevo]: String(nuevo.precio_costo) }))
    setCart((prev) => [
      ...prev,
      {
        lineId:              lidNuevo,
        producto_id:         nuevo.id,
        presentacion_id:     null,
        presentacion_nombre: null,
        cantidad_base:       1,
        nombre:              nuevo.nombre,
        precio_unitario:     nuevo.precio_costo,
        unidad:              nuevo.unidad,
        cantidad:            1,
      },
    ])

    setModalProducto(false)
    setBusqueda('')
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  // ─── Detectar cambios de precio y confirmar ────────────────────────────────

  function handleConfirmarClick() {
    if (cart.length === 0 || procesando) return

    // Comparar precio_unitario con el precio_costo original — solo líneas de producto base
    // (una presentación no tiene un costo unitario comparable con el catálogo)
    const cambios: CambioPrecio[] = cart
      .filter((item) => {
        if (item.presentacion_id) return false
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

    // Subir archivo si hay uno seleccionado
    let archivo_path: string | undefined
    let archivo_nombre: string | undefined
    if (archivoFile) {
      const supabase = createClient()
      const ext  = archivoFile.name.split('.').pop()
      const path = `compras/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('compras-archivos')
        .upload(path, archivoFile, { contentType: archivoFile.type })
      if (uploadError) {
        setError(`Error al subir archivo: ${uploadError.message}`)
        setProcesando(false)
        return
      }
      archivo_path   = path
      archivo_nombre = archivoFile.name
    }

    const result = await crearCompra({
      proveedor_id: proveedorId || null,
      items: cart.map((i) => ({
        producto_id:     i.producto_id,
        presentacion_id: i.presentacion_id,
        cantidad:        i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
      notas,
      actualizarPrecios,
      archivo_path,
      archivo_nombre,
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
    setArchivoFile(null)
    if (archivoInputRef.current) archivoInputRef.current.value = ''
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
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Buscar producto o código de barras..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-11 pr-4 py-3 text-base rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition"
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
                      onClick={() => pedirAgregar(p)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50 active:bg-blue-100 transition-colors group text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate flex items-center gap-1.5">
                          <span className="truncate">{p.nombre}</span>
                          {(p.presentaciones?.length ?? 0) > 0 && (
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-100 rounded px-1.5 py-0.5">
                              {p.presentaciones!.length} pres.
                            </span>
                          )}
                        </p>
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
                    <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
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
                      const original = item.presentacion_id ? undefined : preciosOriginalesRef.current.get(item.producto_id)
                      const precioCambio = original !== undefined && Math.abs(original - item.precio_unitario) > 0.001
                      return (
                        <li key={item.lineId} className="py-3">
                          {/* Nombre */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 text-sm leading-tight">
                                {item.nombre}
                              </p>
                              {item.presentacion_id && (
                                <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 bg-violet-100 rounded px-1.5 py-0.5">
                                  {item.presentacion_nombre}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => eliminar(item.lineId)}
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
                                onClick={() => decrementar(item.lineId)}
                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                              >
                                <Minus className="w-3 h-3 text-slate-600" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={item.cantidad}
                                onChange={(e) =>
                                  setCantidad(item.lineId, parseInt(e.target.value))
                                }
                                className="w-11 text-center text-sm font-bold text-slate-900 border border-slate-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => incrementar(item.lineId)}
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
                                value={preciosStr[item.lineId] ?? item.precio_unitario}
                                onChange={(e) => handlePrecioChange(item.lineId, e.target.value)}
                                className={`w-full text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                  precioCambio
                                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                                    : 'border-slate-200'
                                }`}
                                title={item.presentacion_id ? 'Costo de esta presentación (editable)' : 'Precio de costo (editable)'}
                              />
                            </div>

                            {/* Subtotal */}
                            <p className="text-sm font-bold text-slate-800 w-20 text-right shrink-0">
                              {ARS(item.precio_unitario * item.cantidad)}
                            </p>
                          </div>
                          {/* Presentación: cuánto suma al stock base */}
                          {item.presentacion_id && (
                            <p className="text-xs text-violet-600 mt-1.5 flex items-center gap-1">
                              <Package className="w-3 h-3 shrink-0" />
                              Suma {item.cantidad * item.cantidad_base} {item.unidad} al stock
                            </p>
                          )}
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
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <select
                        value={proveedorId}
                        onChange={(e) => setProveedorId(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm text-slate-900 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
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
                      className="w-full px-3 py-2 text-base text-slate-900 placeholder-slate-600 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wide block mb-1.5">
                      Archivo adjunto (opcional)
                    </label>
                    {archivoFile ? (
                      <div className="flex items-center gap-2 px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg">
                        <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-sm text-emerald-800 truncate flex-1">{archivoFile.name}</span>
                        <button
                          type="button"
                          onClick={() => { setArchivoFile(null); if (archivoInputRef.current) archivoInputRef.current.value = '' }}
                          className="text-emerald-500 hover:text-red-500 transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => archivoInputRef.current?.click()}
                        className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                      >
                        <Paperclip className="w-4 h-4" />
                        Adjuntar PDF, imagen o Excel (máx. 10 MB)
                      </button>
                    )}
                    <input
                      ref={archivoInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        if (f.size > 10 * 1024 * 1024) {
                          setError('El archivo no puede superar 10 MB.')
                          return
                        }
                        setArchivoFile(f)
                      }}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formProducto.nombre}
                    onChange={(e) => setFormProducto({ ...formProducto, nombre: e.target.value })}
                    className="w-full px-3 py-2 text-base text-slate-900 placeholder-slate-600 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre del producto"
                    autoFocus
                  />
                </div>

                {/* Unidad + Precio */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                    <select
                      value={formProducto.unidad}
                      onChange={(e) => setFormProducto({ ...formProducto, unidad: e.target.value })}
                      className="w-full px-3 py-2 text-base text-slate-900 placeholder-slate-600 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Precio de costo</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={formProducto.precio_costo}
                      onChange={(e) => setFormProducto({ ...formProducto, precio_costo: e.target.value })}
                      className="w-full px-3 py-2 text-base text-slate-900 placeholder-slate-600 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Stock mínimo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock mínimo</label>
                  <input
                    type="number"
                    min={0}
                    value={formProducto.stock_minimo}
                    onChange={(e) => setFormProducto({ ...formProducto, stock_minimo: e.target.value })}
                    className="w-full px-3 py-2 text-base text-slate-900 placeholder-slate-600 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* ═══ Modal: Selector de presentación ═══════════════════════════════════ */}
      {selectorProducto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectorProducto(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-violet-600" />
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-900 truncate">¿Qué comprás?</h2>
                <p className="text-xs text-slate-500 truncate">{selectorProducto.nombre}</p>
              </div>
            </div>

            <div className="px-4 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {/* Opción base */}
              <button
                onClick={() => agregarAlCarrito(selectorProducto)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">Unidad ({selectorProducto.unidad})</p>
                  <p className="text-xs text-slate-500">Suma 1 al stock por unidad</p>
                </div>
                <span className="text-sm font-bold text-slate-700 shrink-0">{ARS(selectorProducto.precio_costo)}</span>
              </button>

              {/* Presentaciones */}
              {(selectorProducto.presentaciones ?? []).map((pres) => (
                <button
                  key={pres.id}
                  onClick={() => agregarAlCarrito(selectorProducto, pres)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{pres.nombre}</p>
                    <p className="text-xs text-slate-500">
                      Suma {pres.cantidad_base} {selectorProducto.unidad} al stock
                      {pres.codigo_barras && <span className="ml-1.5 text-slate-300">#{pres.codigo_barras}</span>}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">costo a cargar</span>
                </button>
              ))}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectorProducto(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
