'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Search, Plus, Minus, X, Trash2, CheckCircle,
  AlertTriangle, ShoppingCart, Banknote, Smartphone,
  CreditCard, Clock, Package, Printer, Calculator,
} from 'lucide-react'
import { crearVenta } from '@/app/(dashboard)/ventas/nueva/actions'
import ArqueoTab, { type ArqueoCaja, type VentaTurno } from './arqueo-tab'

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
type ActiveTab  = 'productos' | 'servicios' | 'arqueo'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TODOS_METODOS: { value: MetodoPago; label: string; icon: React.ElementType }[] = [
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

export default function PosCliente({
  productos,
  metodosActivos = ['efectivo', 'transferencia', 'debito', 'credito'],
  arqueoAbierto   = null,
  ventasTurnoInicial = [],
  historialArqueos   = [],
}: {
  productos:           Producto[]
  metodosActivos?:     string[]
  arqueoAbierto?:      ArqueoCaja | null
  ventasTurnoInicial?: VentaTurno[]
  historialArqueos?:   ArqueoCaja[]
}) {
  const searchRef = useRef<HTMLInputElement>(null)

  // ─── Estado ────────────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState<ActiveTab>('productos')
  const [busqueda,       setBusqueda]       = useState('')
  const [cart,           setCart]           = useState<CartItem[]>([])
  const [metodoPago,     setMetodoPago]     = useState<MetodoPago>(
    (metodosActivos[0] ?? 'efectivo') as MetodoPago
  )
  const [procesando,     setProcesando]     = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [ventaExitosa,   setVentaExitosa]   = useState<{ ventaId: string; total: number } | null>(null)
  const [cantServicio,   setCantServicio]   = useState<Record<string, number>>({})
  // Ventas del turno: arranca con las del servidor, se actualiza en tiempo real con cada cobro
  const [ventasTurno,    setVentasTurno]    = useState<VentaTurno[]>(ventasTurnoInicial)

  const cajaAbierta = arqueoAbierto !== null

  // Auto-foco en búsqueda cuando está en tab productos
  useEffect(() => {
    if (activeTab === 'productos') searchRef.current?.focus()
  }, [activeTab])

  // ─── Separar productos de servicios ───────────────────────────────────────
  const servicios = useMemo(
    () => productos.filter((p) =>
      p.categorias?.nombre?.toLowerCase().startsWith('servicio')
    ),
    [productos]
  )

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

  // ─── Carrito ───────────────────────────────────────────────────────────────

  function agregarAlCarrito(p: Producto, cantidad = 1) {
    setCart((prev) => {
      const existing = prev.find((i) => i.producto_id === p.id)
      if (existing) {
        return prev.map((i) =>
          i.producto_id === p.id ? { ...i, cantidad: i.cantidad + cantidad } : i
        )
      }
      return [
        ...prev,
        {
          producto_id:     p.id,
          nombre:          p.nombre,
          precio_unitario: p.precio_venta,
          unidad:          p.unidad,
          cantidad,
        },
      ]
    })
    setBusqueda('')
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  function incrementar(id: string) {
    setCart((prev) =>
      prev.map((i) => (i.producto_id === id ? { ...i, cantidad: i.cantidad + 1 } : i))
    )
  }

  function decrementar(id: string) {
    setCart((prev) => {
      const item = prev.find((i) => i.producto_id === id)
      if (!item) return prev
      if (item.cantidad <= 1) return prev.filter((i) => i.producto_id !== id)
      return prev.map((i) => (i.producto_id === id ? { ...i, cantidad: i.cantidad - 1 } : i))
    })
  }

  function setCantidad(id: string, v: number) {
    if (isNaN(v) || v < 1) return
    setCart((prev) =>
      prev.map((i) => (i.producto_id === id ? { ...i, cantidad: v } : i))
    )
  }

  function eliminar(id: string) {
    setCart((prev) => prev.filter((i) => i.producto_id !== id))
  }

  function vaciarCarrito() {
    setCart([])
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

  // ─── Servicios ─────────────────────────────────────────────────────────────

  function getCantS(id: string) { return cantServicio[id] ?? 1 }
  function setCantS(id: string, v: number) {
    if (!isNaN(v) && v >= 1) setCantServicio((prev) => ({ ...prev, [id]: v }))
  }
  function incS(id: string) {
    setCantServicio((prev) => ({ ...prev, [id]: (prev[id] ?? 1) + 1 }))
  }
  function decS(id: string) {
    setCantServicio((prev) => ({ ...prev, [id]: Math.max(1, (prev[id] ?? 1) - 1) }))
  }
  function agregarServicio(p: Producto) {
    agregarAlCarrito(p, getCantS(p.id))
    setCantServicio((prev) => ({ ...prev, [p.id]: 1 }))
  }

  // ─── Cobrar ────────────────────────────────────────────────────────────────

  async function handleCobrar() {
    if (cart.length === 0 || procesando) return
    setProcesando(true)
    setError(null)

    const result = await crearVenta({
      items: cart.map((i) => ({
        producto_id:     i.producto_id,
        cantidad:        i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
      metodo_pago: metodoPago,
    })

    if (result.error) {
      setError(result.error)
      setProcesando(false)
      return
    }

    // Actualizar ventas del turno en tiempo real
    setVentasTurno((prev) => [...prev, { total, metodo_pago: metodoPago }])
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

  // ─── Render ────────────────────────────────────────────────────────────────

  const tabClass = (tab: ActiveTab) =>
    `flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`

  return (
    <div className="h-screen flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <ShoppingCart className="w-5 h-5 text-blue-600" />
          <h1 className="font-bold text-slate-900">Punto de Venta</h1>
          {/* Indicador de caja */}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            cajaAbierta
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-600'
          }`}>
            {cajaAbierta ? 'Caja abierta' : 'Caja cerrada'}
          </span>
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

        {/* ── Panel izquierdo ── */}
        <div className="flex flex-col flex-1 overflow-hidden bg-white border-r border-slate-200">

          {/* Tabs */}
          <div className="flex shrink-0 border-b border-slate-200 bg-white">
            <button onClick={() => setActiveTab('productos')} className={tabClass('productos')}>
              <Package className="w-4 h-4" />
              Productos
            </button>
            <button onClick={() => setActiveTab('servicios')} className={tabClass('servicios')}>
              <Printer className="w-4 h-4" />
              Servicios
              {servicios.length > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === 'servicios' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {servicios.length}
                </span>
              )}
            </button>
            <button onClick={() => setActiveTab('arqueo')} className={tabClass('arqueo')}>
              <Calculator className="w-4 h-4" />
              Arqueo
              {!cajaAbierta && (
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              )}
            </button>
          </div>

          {/* Contenido según tab */}
          {activeTab === 'productos' && (
            <>
              <div className="p-4 border-b border-slate-100 bg-white shrink-0">
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
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 truncate">{p.nombre}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {p.categorias?.nombre ?? '—'} · {p.unidad}
                              {p.codigo_barras && (
                                <span className="ml-2 text-slate-300">#{p.codigo_barras}</span>
                              )}
                            </p>
                          </div>
                          {p.stock_actual <= 0 && (
                            <span className="shrink-0 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium border border-amber-200">
                              Sin stock
                            </span>
                          )}
                          <span className="shrink-0 font-bold text-blue-600 text-base">
                            {ARS(p.precio_venta)}
                          </span>
                          <span className="shrink-0 w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="w-4 h-4" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {activeTab === 'servicios' && (
            <div className="flex-1 overflow-y-auto">
              {servicios.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <Printer className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm font-medium mb-1">No hay servicios configurados</p>
                  <p className="text-xs text-slate-400 mb-4">
                    Creá productos en la categoría <strong>Servicios</strong> para que aparezcan acá
                  </p>
                  <Link href="/productos" className="text-sm text-blue-600 hover:underline font-medium">
                    Ir a Productos →
                  </Link>
                </div>
              ) : (
                <ul className="p-3 space-y-2">
                  {servicios.map((p) => (
                    <ServicioCard
                      key={p.id}
                      producto={p}
                      cantidad={getCantS(p.id)}
                      onInc={() => incS(p.id)}
                      onDec={() => decS(p.id)}
                      onCantidadChange={(v) => setCantS(p.id, v)}
                      onAgregar={() => agregarServicio(p)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'arqueo' && (
            <ArqueoTab
              arqueoAbierto={arqueoAbierto}
              ventasTurno={ventasTurno}
              historial={historialArqueos}
            />
          )}
        </div>

        {/* ── Panel derecho: carrito ── */}
        <div className="w-[420px] shrink-0 flex flex-col bg-white shadow-xl">

          {ventaExitosa ? (
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
              {/* Header carrito */}
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

              {/* Ítems del carrito */}
              <div className="flex-1 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <ShoppingCart className="w-10 h-10 text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400">
                      {activeTab === 'productos' ? (
                        <>
                          Buscá un producto y presioná{' '}
                          <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-mono text-xs">Enter</kbd>
                          <br />o hacé clic para agregarlo
                        </>
                      ) : activeTab === 'servicios' ? (
                        <>Ingresá la cantidad y presioná<br /><strong>Agregar</strong> en el servicio</>
                      ) : (
                        <>Abrí la caja para empezar<br />a registrar ventas</>
                      )}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 px-4 py-1">
                    {cart.map((item) => (
                      <li key={item.producto_id} className="py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 text-sm truncate">{item.nombre}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {ARS(item.precio_unitario)} / {item.unidad}
                          </p>
                        </div>
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
                            onChange={(e) => setCantidad(item.producto_id, parseInt(e.target.value))}
                            className="w-11 text-center text-sm font-bold border border-slate-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => incrementar(item.producto_id)}
                            className="w-7 h-7 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-sm font-bold text-slate-800 w-20 text-right shrink-0">
                          {ARS(item.precio_unitario * item.cantidad)}
                        </p>
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

              {/* Footer carrito */}
              <div className="border-t border-slate-200 shrink-0">
                <div className="px-5 py-4 flex items-center justify-between bg-slate-50 border-b border-slate-200">
                  <span className="text-slate-600 font-medium text-sm">Total</span>
                  <span className="text-2xl font-bold text-slate-900">{ARS(total)}</span>
                </div>

                <div className="px-5 py-4 border-b border-slate-200">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2.5">
                    Método de pago
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {TODOS_METODOS.filter(m => metodosActivos.includes(m.value)).map(({ value, label, icon: Icon }) => (
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

                {/* Aviso de caja cerrada */}
                {!cajaAbierta && (
                  <div className="mx-4 mt-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-3 rounded-xl">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                    <div>
                      <p className="font-semibold">Debe abrir caja para poder vender</p>
                      <button
                        onClick={() => setActiveTab('arqueo')}
                        className="mt-1 text-amber-700 underline underline-offset-2 font-medium"
                      >
                        Ir a Arqueo de Caja →
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mx-5 mt-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2.5 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="p-4">
                  <button
                    onClick={handleCobrar}
                    disabled={cart.length === 0 || procesando || !cajaAbierta}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xl py-5 rounded-2xl transition-colors shadow-sm"
                  >
                    {!cajaAbierta
                      ? 'Abrí la caja primero'
                      : procesando
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

// ─── Tarjeta de servicio ──────────────────────────────────────────────────────

function ServicioCard({
  producto, cantidad, onInc, onDec, onCantidadChange, onAgregar,
}: {
  producto:         Producto
  cantidad:         number
  onInc:            () => void
  onDec:            () => void
  onCantidadChange: (v: number) => void
  onAgregar:        () => void
}) {
  const subtotal = producto.precio_venta * cantidad

  return (
    <li className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm leading-tight">{producto.nombre}</p>
        <p className="text-sm text-blue-600 font-bold mt-0.5">
          {ARS(producto.precio_venta)}
          <span className="text-slate-400 font-normal"> / {producto.unidad}</span>
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onDec}
          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
        >
          <Minus className="w-3.5 h-3.5 text-slate-600" />
        </button>
        <input
          type="number"
          min={1}
          value={cantidad}
          onChange={(e) => onCantidadChange(parseInt(e.target.value) || 1)}
          onKeyDown={(e) => e.key === 'Enter' && onAgregar()}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          className="w-16 text-center text-lg font-bold border border-slate-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={onInc}
          className="w-8 h-8 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="text-right shrink-0 w-24">
        <p className="text-xs text-slate-400 leading-none mb-0.5">Total</p>
        <p className="text-base font-bold text-slate-800">{ARS(subtotal)}</p>
      </div>
      <button
        onClick={onAgregar}
        className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
      >
        <Plus className="w-4 h-4" />
        Agregar
      </button>
    </li>
  )
}
