'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Search, Plus, Minus, X, Trash2, CheckCircle,
  AlertTriangle, ShoppingCart, Banknote, Smartphone,
  CreditCard, Clock, Package,
} from 'lucide-react'
import { crearVenta } from '@/app/(dashboard)/ventas/nueva/actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Producto = {
  id: string
  nombre: string
  descripcion: string | null
  precio_venta: number
  stock_actual: number
  stock_minimo: number
  codigo_barras: string | null
  unidad: string
  categorias: { nombre: string } | null
}

type CartItem = {
  producto_id: string
  nombre: string
  precio_unitario: number
  unidad: string
  cantidad: number
}

type MetodoPago = 'efectivo' | 'transferencia' | 'debito' | 'credito'

// ─── Constantes ───────────────────────────────────────────────────────────────

const METODOS: { value: MetodoPago; label: string; icon: React.ElementType }[] = [
  { value: 'efectivo',      label: 'Efectivo',      icon: Banknote   },
  { value: 'transferencia', label: 'Transferencia', icon: Smartphone },
  { value: 'debito',        label: 'Débito',        icon: CreditCard },
  { value: 'credito',       label: 'Crédito',       icon: CreditCard },
]

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(v)

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PosCliente({ productos }: { productos: Producto[] }) {
  const searchRef = useRef<HTMLInputElement>(null)

  const [busqueda,     setBusqueda]     = useState('')
  const [cart,         setCart]         = useState<CartItem[]>([])
  const [metodoPago,   setMetodoPago]   = useState<MetodoPago>('efectivo')
  const [procesando,   setProcesando]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [ventaExitosa, setVentaExitosa] = useState<{ ventaId: string; total: number } | null>(null)

  // Auto-foco al montar (listo para escanear/tipear de inmediato)
  useEffect(() => { searchRef.current?.focus() }, [])

  // ─── Filtrado de productos ────────────────────────────────────────────────

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return productos.slice(0, 40)
    return productos
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.codigo_barras && p.codigo_barras.includes(busqueda.trim()))
      )
      .slice(0, 40)
  }, [productos, busqueda])

  // ─── Carrito ──────────────────────────────────────────────────────────────

  function agregarAlCarrito(p: Producto) {
    setCart((prev) => {
      const existing = prev.find((i) => i.producto_id === p.id)
      if (existing) {
        return prev.map((i) =>
          i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      }
      return [
        ...prev,
        {
          producto_id:    p.id,
          nombre:         p.nombre,
          precio_unitario: p.precio_venta,
          unidad:         p.unidad,
          cantidad:       1,
        },
      ]
    })
    setBusqueda('')
    // Re-foco para el próximo escaneo
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
      if (item.cantidad <= 1) return prev.filter((i) => i.producto_id !== id)
      return prev.map((i) => i.producto_id === id ? { ...i, cantidad: i.cantidad - 1 } : i)
    })
  }

  function setCantidad(id: string, v: number) {
    if (isNaN(v) || v < 1) return
    setCart((prev) =>
      prev.map((i) => i.producto_id === id ? { ...i, cantidad: v } : i)
    )
  }

  function eliminar(id: string) {
    setCart((prev) => prev.filter((i) => i.producto_id !== id))
  }

  function vaciarCarrito() {
    setCart([])
    setError(null)
  }

  // Totales
  const total         = cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0)
  const cantidadItems = cart.reduce((s, i) => s + i.cantidad, 0)

  // ─── Teclado: Enter agrega el primer resultado (compatibilidad con lectores de barras) ──

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && productosFiltrados.length > 0) {
      e.preventDefault()
      agregarAlCarrito(productosFiltrados[0])
    }
  }

  // ─── Cobrar ───────────────────────────────────────────────────────────────

  async function handleCobrar() {
    if (cart.length === 0 || procesando) return
    setProcesando(true)
    setError(null)

    const result = await crearVenta({
      items: cart.map((i) => ({
        producto_id:    i.producto_id,
        cantidad:       i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
      metodo_pago: metodoPago,
    })

    if (result.error) {
      setError(result.error)
      setProcesando(false)
      return
    }

    setVentaExitosa({ ventaId: result.ventaId!, total })
    setCart([])
    setProcesando(false)
  }

  function nuevaVenta() {
    setVentaExitosa(null)
    setMetodoPago('efectivo')
    setBusqueda('')
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <ShoppingCart className="w-5 h-5 text-blue-600" />
          <h1 className="font-bold text-slate-900">Punto de Venta</h1>
        </div>
        <Link
          href="/ventas"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <Clock className="w-4 h-4" />
          Ver historial
        </Link>
      </div>

      {/* Área principal */}
      <div className="flex flex-1 overflow-hidden bg-slate-50">

        {/* ── Panel izquierdo: búsqueda + resultados ── */}
        <div className="flex flex-col flex-1 overflow-hidden bg-white border-r border-slate-200">

          {/* Buscador */}
          <div className="p-4 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar producto o escanear código de barras... (Enter para agregar)"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition"
              />
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
                <p className="text-slate-500 text-sm">No se encontraron productos</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {productosFiltrados.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => agregarAlCarrito(p)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50 active:bg-blue-100 transition-colors group text-left"
                    >
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{p.nombre}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {p.categorias?.nombre ?? '—'} · {p.unidad}
                          {p.codigo_barras && (
                            <span className="ml-2 text-slate-300">#{p.codigo_barras}</span>
                          )}
                        </p>
                      </div>
                      {/* Stock bajo */}
                      {p.stock_actual <= 0 && (
                        <span className="shrink-0 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium border border-amber-200">
                          Sin stock
                        </span>
                      )}
                      {/* Precio */}
                      <span className="shrink-0 font-bold text-blue-600 text-base">
                        {ARS(p.precio_venta)}
                      </span>
                      {/* + botón (visible en hover) */}
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

        {/* ── Panel derecho: carrito ── */}
        <div className="w-[420px] shrink-0 flex flex-col bg-white shadow-xl">

          {ventaExitosa ? (
            /* ── Estado: venta exitosa ── */
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">¡Venta registrada!</h2>
              <p className="text-3xl font-bold text-emerald-600 mt-3 mb-1">
                {ARS(ventaExitosa.total)}
              </p>
              <p className="text-xs text-slate-400 font-mono mb-8">
                #{ventaExitosa.ventaId.slice(-8).toUpperCase()}
              </p>
              <button
                onClick={nuevaVenta}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors text-base"
              >
                Nueva venta
              </button>
              <Link
                href="/ventas"
                className="mt-3 text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                Ver historial →
              </Link>
            </div>
          ) : (
            <>
              {/* ── Carrito: header ── */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-800 text-sm">Venta actual</span>
                  {cantidadItems > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {cantidadItems}
                    </span>
                  )}
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={vaciarCarrito}
                    title="Vaciar carrito"
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* ── Carrito: ítems ── */}
              <div className="flex-1 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <ShoppingCart className="w-10 h-10 text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400">
                      Buscá un producto y presioná <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-mono text-xs">Enter</kbd><br />
                      o hacé clic para agregarlo
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 px-4 py-1">
                    {cart.map((item) => (
                      <li key={item.producto_id} className="py-3 flex items-center gap-3">
                        {/* Nombre + precio unitario */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 text-sm truncate">{item.nombre}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {ARS(item.precio_unitario)} / {item.unidad}
                          </p>
                        </div>
                        {/* Controles de cantidad */}
                        <div className="flex items-center gap-1 shrink-0">
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
                        {/* Subtotal */}
                        <p className="text-sm font-bold text-slate-800 w-20 text-right shrink-0">
                          {ARS(item.precio_unitario * item.cantidad)}
                        </p>
                        {/* Quitar */}
                        <button
                          onClick={() => eliminar(item.producto_id)}
                          className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* ── Carrito: footer ── */}
              <div className="border-t border-slate-200 shrink-0">

                {/* Total */}
                <div className="px-5 py-4 flex items-center justify-between bg-slate-50 border-b border-slate-200">
                  <span className="text-slate-600 font-medium text-sm">Total</span>
                  <span className="text-2xl font-bold text-slate-900">{ARS(total)}</span>
                </div>

                {/* Método de pago */}
                <div className="px-5 py-4 border-b border-slate-200">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2.5">
                    Método de pago
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {METODOS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setMetodoPago(value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          metodoPago === value
                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 bg-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="mx-5 mt-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2.5 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                {/* Botón Cobrar */}
                <div className="p-4">
                  <button
                    onClick={handleCobrar}
                    disabled={cart.length === 0 || procesando}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xl py-5 rounded-2xl transition-colors shadow-sm"
                  >
                    {procesando
                      ? 'Procesando...'
                      : cart.length === 0
                      ? 'Carrito vacío'
                      : `Cobrar ${ARS(total)}`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
