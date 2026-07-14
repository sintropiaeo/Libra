'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Search, Plus, Minus, X, Trash2, CheckCircle,
  AlertTriangle, ShoppingCart, Banknote, Smartphone,
  CreditCard, Clock, Package, Printer, Calculator,
  ChevronDown, ChevronRight, Star, FileText, Pencil,
} from 'lucide-react'
import { crearVenta, buscarProductosPOS, convertirVentaAFacturaX, actualizarPrecioProducto } from '@/app/(dashboard)/ventas/nueva/actions'
import type { ProductoPOS } from '@/app/(dashboard)/ventas/nueva/actions'
import { obtenerVentaDetalle } from '@/app/(dashboard)/comprobantes/actions'
import type { ConfiguracionTicket } from '@/lib/permisos'
import { generarHTMLTicket } from '@/lib/ticket'
import type { DatosCliente, PrintData } from '@/lib/ticket'
import ArqueoTab, { type ArqueoCaja, type VentaTurno } from './arqueo-tab'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { redondearPrecio } from '@/lib/utils'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Producto = ProductoPOS

type CartItem = {
  producto_id: string
  nombre: string
  precio_unitario: number
  precioOriginal: number          // precio del catálogo al agregar (para detectar edición admin)
  actualizarProducto: boolean     // checkbox: persistir el precio editado al producto
  unidad: string
  cantidad: number
}

type VentaItemHoy = {
  id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  productos: { nombre: string; unidad: string } | null
}

export type VentaHoy = {
  id: string
  numero_venta: number
  fecha: string
  total: number
  metodo_pago: string
  venta_items: VentaItemHoy[]
}

type MetodoPago = 'efectivo' | 'transferencia' | 'debito' | 'credito'
type ActiveTab  = 'ventas_hoy' | 'servicios' | 'arqueo'

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
  servicios,
  metodosActivos     = ['efectivo', 'transferencia', 'debito', 'credito'],
  esAdmin            = false,
  arqueoAbierto      = null,
  ventasTurnoInicial = [],
  historialArqueos   = [],
  ventasHoyInicial   = [],
  negocioNombre      = '',
  imprimirTicketAuto = false,
  tamanoTicket       = '80mm',
  sonidoEscaneo      = false,
  configTicket       = null,
  favoritosIniciales = [] as Producto[],
}: {
  servicios:            Producto[]
  metodosActivos?:      string[]
  esAdmin?:             boolean
  arqueoAbierto?:       ArqueoCaja | null
  ventasTurnoInicial?:  VentaTurno[]
  historialArqueos?:    ArqueoCaja[]
  ventasHoyInicial?:    VentaHoy[]
  negocioNombre?:       string
  imprimirTicketAuto?:  boolean
  tamanoTicket?:        '58mm' | '80mm'
  sonidoEscaneo?:       boolean
  configTicket?:        ConfiguracionTicket | null
  favoritosIniciales?:  Producto[]
}) {
  const searchRef       = useRef<HTMLInputElement>(null)
  const hiddenInputRef  = useRef<HTMLInputElement>(null)
  const posContainerRef = useRef<HTMLDivElement>(null)
  const activeTabRef    = useRef<ActiveTab>('ventas_hoy')
  const toastIdRef      = useRef(0)
  // ─── Estado ────────────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState<ActiveTab>('ventas_hoy')
  const [busqueda,       setBusqueda]       = useState('')
  const [cart,           setCart]           = useState<CartItem[]>([])
  const [metodoPago,     setMetodoPago]     = useState<MetodoPago>(
    (metodosActivos[0] ?? 'efectivo') as MetodoPago
  )
  const [procesando,     setProcesando]     = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [modalImpresion, setModalImpresion] = useState<{
    ventaId: string; total: number; metodoPago: string; printData: PrintData
  } | null>(null)
  const [cantServicio,   setCantServicio]   = useState<Record<string, number>>({})
  // Edición de precio en el carrito (solo admin)
  const [editandoPrecioId, setEditandoPrecioId] = useState<string | null>(null)
  // Ventas del turno: arranca con las del servidor, se actualiza en tiempo real con cada cobro
  const [ventasTurno,    setVentasTurno]    = useState<VentaTurno[]>(ventasTurnoInicial)
  // Ventas de hoy: para mostrar en el panel izquierdo
  const [ventasHoy,      setVentasHoy]      = useState<VentaHoy[]>(ventasHoyInicial)
  // Error temporal de stock (se auto-descarta)
  const [stockError,       setStockError]       = useState<string | null>(null)
  // Toasts de feedback del scanner
  const [toasts,           setToasts]           = useState<{ id: number; type: 'success' | 'error'; msg: string }[]>([])
  // Mantiene activeTabRef sincronizado sin provocar re-render
  activeTabRef.current = activeTab

  // Búsqueda dinámica server-side
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Producto[]>([])
  const [buscando,           setBuscando]           = useState(false)
  const debounceSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchVersionRef  = useRef(0)
  const lastAddedRef      = useRef<number>(0)   // cooldown: timestamp del último producto agregado

  const cajaAbierta = arqueoAbierto !== null

  // ─── Scanner de código de barras ──────────────────────────────────────────
  const lastInputTimeRef = useRef<number>(0)
  const isScannerRef     = useRef(false)

  function playBeep() {
    try {
      const ctx  = new AudioContext()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 1200
      osc.type = 'square'
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.08)
    } catch { /* AudioContext no disponible */ }
  }

  function showToast(type: 'success' | 'error', msg: string) {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, type, msg }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500)
  }

  // Ref al handler global: patrón ref-como-función-siempre-fresca (evita stale closure)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleBarcodeGlobalRef = useRef(async (_: string) => {})
  handleBarcodeGlobalRef.current = async (code: string) => {
    if (activeTabRef.current === 'arqueo') return
    console.log(`[BarcodeScanner] procesando código: "${code}"`)
    const resultados = await buscarProductosPOS(code)
    if (hiddenInputRef.current) hiddenInputRef.current.value = ''
    if (resultados.length > 0) {
      const agregado = agregarAlCarrito(resultados[0])
      if (agregado) {
        if (sonidoEscaneo) playBeep()
        showToast('success', `Agregado: ${resultados[0].nombre}`)
      } else {
        showToast('error', `"${resultados[0].nombre}" sin stock`)
      }
    } else {
      showToast('error', `Código "${code}" no encontrado`)
    }
  }

  // Callback estable que delega al ref (el hook solo se crea una vez)
  const stableOnBarcode = useCallback((code: string) => {
    handleBarcodeGlobalRef.current(code)
  }, [])

  useBarcodeScanner(stableOnBarcode, searchRef)

  const printTicket = useCallback((data: PrintData) => {
    const html = generarHTMLTicket(data, { configTicket, tamanoTicket, negocioNombre })
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;visibility:hidden;width:0;height:0;border:0'
    document.body.appendChild(iframe)
    iframe.contentDocument!.open()
    iframe.contentDocument!.write(html)
    iframe.contentDocument!.close()
    iframe.contentWindow!.focus()
    setTimeout(() => {
      iframe.contentWindow!.print()
      setTimeout(() => document.body.removeChild(iframe), 1500)
    }, 200)
  }, [configTicket, tamanoTicket, negocioNombre])

  // Auto-foco en búsqueda cuando cambia de tab
  useEffect(() => {
    if (activeTab === 'ventas_hoy') searchRef.current?.focus()
  }, [activeTab])

  // Foco inicial en input oculto (receptor del scanner cuando nada más tiene foco)
  useEffect(() => { hiddenInputRef.current?.focus() }, [])

  // Click en zona no-interactiva del POS → devolver foco al input oculto
  useEffect(() => {
    const container = posContainerRef.current
    if (!container) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('input, textarea, select, button, a, [tabindex]')) {
        hiddenInputRef.current?.focus()
      }
    }
    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [])

  // servicios viene de props (cargados desde el servidor al inicio)

  // ─── Carrito ───────────────────────────────────────────────────────────────

  function mostrarStockError(msg: string) {
    setStockError(msg)
    setTimeout(() => setStockError(null), 3000)
  }

  function agregarAlCarrito(p: Producto, cantidad = 1): boolean {
    if (p.stock_actual <= 0 && !p.permitir_venta_sin_stock) {
      mostrarStockError(`"${p.nombre}" no tiene stock disponible`)
      return false
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.producto_id === p.id)
      const newItem = {
        producto_id:        p.id,
        nombre:             p.nombre,
        precio_unitario:    p.precio_venta,
        precioOriginal:     p.precio_venta,
        actualizarProducto: false,
        unidad:             p.unidad,
        cantidad:           existing ? existing.cantidad + cantidad : cantidad,
      }
      return [newItem, ...prev.filter((i) => i.producto_id !== p.id)]
    })
    lastAddedRef.current = Date.now()
    setBusqueda('')
    setResultadosBusqueda([])
    setBuscando(false)
    if (debounceSearchRef.current) clearTimeout(debounceSearchRef.current)
    setTimeout(() => searchRef.current?.focus(), 0)
    return true
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

  // ─── Edición de precio (solo admin) ─────────────────────────────────────────

  function editarPrecio(id: string, valor: number) {
    if (!esAdmin) return
    setCart((prev) => prev.map((i) =>
      i.producto_id === id
        ? { ...i, precio_unitario: Number.isFinite(valor) && valor >= 0 ? valor : i.precio_unitario }
        : i
    ))
  }

  function confirmarPrecio(id: string) {
    setCart((prev) => prev.map((i) =>
      i.producto_id === id ? { ...i, precio_unitario: redondearPrecio(i.precio_unitario) } : i
    ))
    setEditandoPrecioId(null)
  }

  function toggleActualizarProducto(id: string) {
    setCart((prev) => prev.map((i) =>
      i.producto_id === id ? { ...i, actualizarProducto: !i.actualizarProducto } : i
    ))
  }

  const total         = cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0)
  const cantidadItems = cart.reduce((s, i) => s + i.cantidad, 0)

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const now = Date.now()
    const gap = now - lastInputTimeRef.current
    lastInputTimeRef.current = now
    if (gap > 200)                isScannerRef.current = false
    else if (gap > 0 && gap < 50) isScannerRef.current = true

    const value = e.target.value
    setBusqueda(value)

    if (debounceSearchRef.current) clearTimeout(debounceSearchRef.current)

    if (!value.trim()) {
      setResultadosBusqueda([])
      setBuscando(false)
      return
    }

    setBuscando(true)
    const version = ++searchVersionRef.current
    debounceSearchRef.current = setTimeout(async () => {
      const resultados = await buscarProductosPOS(value)
      if (version !== searchVersionRef.current) return  // resultado obsoleto
      setResultadosBusqueda(resultados)
      setBuscando(false)
    }, 300)
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setBusqueda('')
      setResultadosBusqueda([])
      setBuscando(false)
      isScannerRef.current = false
      return
    }

    if (e.key !== 'Enter' || !busqueda.trim()) return
    e.preventDefault()

    // Cooldown: el Enter del scanner que terminó de agregar el producto anterior
    // puede llegar al input si el foco se mueve justo en ese instante. Ignorarlo.
    // 120 ms alcanza para atrapar ese Enter fantasma (llega en pocos ms y React
    // limpia el input en ~16 ms) sin bloquear el escaneo rápido del siguiente producto.
    if (Date.now() - lastAddedRef.current < 120) return

    if (resultadosBusqueda.length > 0) {
      const wasScanner = isScannerRef.current
      if (wasScanner && sonidoEscaneo) playBeep()
      isScannerRef.current = false
      const agregado = agregarAlCarrito(resultadosBusqueda[0])
      if (wasScanner) {
        if (agregado) showToast('success', `Agregado: ${resultadosBusqueda[0].nombre}`)
        else          showToast('error',   `"${resultadosBusqueda[0].nombre}" sin stock`)
      }
      return
    }

    // El scanner disparó Enter antes de que llegara el debounce — buscar inmediatamente
    if (isScannerRef.current || buscando) {
      if (debounceSearchRef.current) clearTimeout(debounceSearchRef.current)
      const version = ++searchVersionRef.current
      isScannerRef.current = false
      setBuscando(true)
      const resultados = await buscarProductosPOS(busqueda)
      if (version !== searchVersionRef.current) return
      setResultadosBusqueda(resultados)
      setBuscando(false)
      if (resultados.length > 0) {
        if (sonidoEscaneo) playBeep()
        const agregado = agregarAlCarrito(resultados[0])
        if (agregado) showToast('success', `Agregado: ${resultados[0].nombre}`)
        else          showToast('error',   `"${resultados[0].nombre}" sin stock`)
      } else {
        mostrarStockError(`Código "${busqueda}" no encontrado`)
        showToast('error', `Código "${busqueda}" no encontrado`)
      }
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

  function handleCobrar() {
    if (cart.length === 0 || procesando) return
    ejecutarCobro()
  }

  async function ejecutarCobro() {
    setProcesando(true)
    setError(null)

    const result = await crearVenta({
      items: cart.map((i) => ({
        producto_id:     i.producto_id,
        cantidad:        i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
      metodo_pago:      metodoPago,
      tipo_comprobante: 'ticket',
    })

    if (result.error) {
      setError(result.error)
      setProcesando(false)
      return
    }

    // Admin: persistir al producto los precios editados que marcó con el checkbox
    if (esAdmin) {
      const aActualizar = cart.filter((i) => i.actualizarProducto && i.precio_unitario !== i.precioOriginal)
      for (const i of aActualizar) {
        await actualizarPrecioProducto(i.producto_id, i.precio_unitario)
      }
    }

    setVentasTurno((prev) => [...prev, { total, metodo_pago: metodoPago }])

    const printData: PrintData = {
      numeroVenta: result.numeroVenta ?? 0,
      items:       cart.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, precio_unitario: i.precio_unitario, unidad: i.unidad })),
      total,
      metodoPago,
      tipoComprobante: 'ticket',
    }
    const nuevaVentaHoy: VentaHoy = {
      id:           result.ventaId!,
      numero_venta: result.numeroVenta ?? 0,
      fecha:        new Date().toISOString(),
      total,
      metodo_pago:  metodoPago,
      venta_items:  cart.map(item => ({
        id:              `${item.producto_id}-${Date.now()}`,
        cantidad:        item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal:        item.cantidad * item.precio_unitario,
        productos:       { nombre: item.nombre, unidad: item.unidad },
      })),
    }
    setVentasHoy((prev) => [nuevaVentaHoy, ...prev])
    setCart([])
    setProcesando(false)

    setModalImpresion({
      ventaId:    result.ventaId!,
      total,
      metodoPago,
      printData,
    })
  }

  function nuevaVenta() {
    setModalImpresion(null)
    setMetodoPago('efectivo')
    setBusqueda('')
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  async function handleReimprimirVenta(ventaId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await obtenerVentaDetalle(ventaId) as any
    if (!raw) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (raw.venta_items ?? []).map((vi: any) => ({
      nombre:          vi.productos?.nombre ?? 'Producto',
      unidad:          vi.productos?.unidad ?? 'unidad',
      cantidad:        vi.cantidad,
      precio_unitario: vi.precio_unitario,
    }))
    const pd: PrintData = {
      numeroVenta:       raw.numero_venta ?? 0,
      items,
      total:             Number(raw.total),
      metodoPago:        raw.metodo_pago,
      tipoComprobante:   raw.tipo_comprobante ?? 'ticket',
      numeroComprobante: raw.numero_comprobante ?? undefined,
      datosCliente:      raw.datos_cliente ?? null,
    }
    printTicket(pd)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const tabClass = (tab: ActiveTab) =>
    `flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`

  return (
    <div ref={posContainerRef} className="h-screen flex flex-col overflow-hidden">

      {/* Input oculto: receptor de focus cuando el usuario no está en ningún input.
          El scanner escribe aquí; el hook global lo captura por document.keydown. */}
      <input
        ref={hiddenInputRef}
        type="text"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        className="sr-only"
      />

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

          {/* Buscador — siempre visible */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100 bg-white shrink-0 relative z-20">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar producto o código de barras..."
                value={busqueda}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                className="w-full pl-11 pr-4 py-3 text-base rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition"
              />
            </div>

            {/* Error de stock */}
            {stockError && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {stockError}
              </div>
            )}

            {/* Dropdown de resultados */}
            {busqueda.trim() && (
              <div className="absolute left-4 right-4 top-[calc(100%-4px)] bg-white border border-slate-200 rounded-xl shadow-xl max-h-80 overflow-y-auto z-30">
                {buscando ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
                    <span className="w-4 h-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin shrink-0" />
                    Buscando...
                  </div>
                ) : resultadosBusqueda.length === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
                    <Package className="w-4 h-4" />
                    Sin resultados
                  </div>
                ) : (
                  <>
                    <p className="px-4 pt-2.5 pb-1 text-xs text-slate-400 font-medium">
                      {resultadosBusqueda.length} resultado{resultadosBusqueda.length !== 1 && 's'} · Enter para agregar el primero
                    </p>
                    <ul className="pb-1.5">
                      {resultadosBusqueda.map((p) => (
                        <li key={p.id}>
                          <button
                            onMouseDown={(e) => { e.preventDefault(); agregarAlCarrito(p) }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 active:bg-blue-100 transition-colors text-left"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-800 text-sm truncate">{p.nombre}</p>
                              <p className="text-xs text-slate-500">
                                {p.categorias?.nombre ?? '—'} · {p.unidad}
                                {p.codigo_barras && <span className="ml-2 text-slate-400">#{p.codigo_barras}</span>}
                              </p>
                            </div>
                            {p.stock_actual <= 0 && (
                              <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full border ${
                                p.permitir_venta_sin_stock
                                  ? 'text-amber-600 bg-amber-50 border-amber-200'
                                  : 'text-red-600 bg-red-50 border-red-200'
                              }`}>
                                {p.permitir_venta_sin_stock ? 'Sin stock' : 'Bloqueado'}
                              </span>
                            )}
                            <span className="shrink-0 font-bold text-blue-600 text-sm">{ARS(p.precio_venta)}</span>
                            <span className="shrink-0 w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                              <Plus className="w-3.5 h-3.5" />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Panel de favoritos */}
          {favoritosIniciales.length > 0 && (
            <div className="shrink-0 bg-white border-b border-slate-100">
              <p className="px-4 pt-2.5 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                Favoritos
              </p>
              <div className="grid gap-2 px-4 pb-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                {favoritosIniciales.map((p) => (
                  <button
                    key={p.id}
                    onMouseDown={(e) => { e.preventDefault(); agregarAlCarrito(p) }}
                    title={p.nombre}
                    className="min-h-[56px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 active:scale-[0.97] text-center transition-all flex flex-col items-center justify-center gap-0.5"
                  >
                    <span className="text-sm font-medium text-slate-800 leading-tight line-clamp-2">{p.nombre}</span>
                    <span className="text-xs font-semibold text-slate-500">${p.precio_venta.toLocaleString('es-AR')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex shrink-0 border-b border-slate-200 bg-white">
            <button onClick={() => setActiveTab('ventas_hoy')} className={tabClass('ventas_hoy')}>
              <Clock className="w-4 h-4" />
              Ventas de hoy
              {ventasHoy.length > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === 'ventas_hoy' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white'
                }`}>
                  {ventasHoy.length}
                </span>
              )}
            </button>
            <button onClick={() => setActiveTab('servicios')} className={tabClass('servicios')}>
              <Printer className="w-4 h-4" />
              Servicios
              {servicios.length > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === 'servicios' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-white'
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

          {/* Ventas de hoy */}
          {activeTab === 'ventas_hoy' && (
            <VentasHoyPanel ventas={ventasHoy} onReimprimir={handleReimprimirVenta} />
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
              metodosActivos={metodosActivos}
            />
          )}
        </div>

        {/* ── Panel derecho: carrito ── */}
        <div className="w-[420px] shrink-0 flex flex-col bg-white shadow-xl">

          <>
            {/* Header carrito */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-800 text-sm">Venta actual</span>
                  {cantidadItems > 0 && (
                    <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
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
                      {activeTab === 'servicios' ? (
                        <>Ingresá la cantidad y presioná<br /><strong>Agregar</strong> en el servicio</>
                      ) : activeTab === 'arqueo' ? (
                        <>Abrí la caja para empezar<br />a registrar ventas</>
                      ) : (
                        <>Buscá un producto arriba y presioná{' '}
                          <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-mono text-xs">Enter</kbd>
                        </>
                      )}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 px-4 py-1">
                    {cart.map((item) => (
                      <li key={item.producto_id} className="py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 text-sm truncate">{item.nombre}</p>
                          {esAdmin ? (
                            editandoPrecioId === item.producto_id ? (
                              <input
                                type="number" min={0} step="1" autoFocus
                                defaultValue={item.precio_unitario}
                                onChange={(e) => editarPrecio(item.producto_id, parseFloat(e.target.value))}
                                onBlur={() => confirmarPrecio(item.producto_id)}
                                onKeyDown={(e) => { if (e.key === 'Enter') confirmarPrecio(item.producto_id) }}
                                className="w-24 text-xs border border-blue-300 rounded px-1.5 py-0.5 mt-0.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            ) : (
                              <button
                                onClick={() => setEditandoPrecioId(item.producto_id)}
                                title="Editar precio"
                                className="text-xs text-slate-600 mt-0.5 hover:text-blue-600 inline-flex items-center gap-1 transition-colors"
                              >
                                {ARS(item.precio_unitario)} / {item.unidad}
                                <Pencil className="w-3 h-3 opacity-60" />
                              </button>
                            )
                          ) : (
                            <p className="text-xs text-slate-600 mt-0.5">
                              {ARS(item.precio_unitario)} / {item.unidad}
                            </p>
                          )}
                          {esAdmin && item.precio_unitario !== item.precioOriginal && (
                            <label className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.actualizarProducto}
                                onChange={() => toggleActualizarProducto(item.producto_id)}
                                className="w-3 h-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              Actualizar precio del producto para futuras ventas
                            </label>
                          )}
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
                            className="w-11 text-center text-sm font-bold text-slate-900 border border-slate-200 rounded-lg py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
        </div>
      </div>

      {/* Modal de impresión post-venta */}
      {modalImpresion && (
        <ModalImpresion
          ventaId={modalImpresion.ventaId}
          total={modalImpresion.total}
          metodoPago={modalImpresion.metodoPago}
          printData={modalImpresion.printData}
          imprimirTicketAuto={imprimirTicketAuto}
          onImprimir={printTicket}
          onCerrar={nuevaVenta}
        />
      )}

      {/* Toasts de feedback del scanner */}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold text-white ${
              t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {t.type === 'success'
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertTriangle className="w-4 h-4 shrink-0" />
            }
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Panel ventas de hoy ─────────────────────────────────────────────────────

const METODO_BADGE: Record<string, string> = {
  efectivo:      'bg-emerald-100 text-emerald-700',
  transferencia: 'bg-blue-100 text-blue-700',
  debito:        'bg-violet-100 text-violet-700',
  credito:       'bg-amber-100 text-amber-700',
}

const METODO_LABEL: Record<string, string> = {
  efectivo:      'Efectivo',
  transferencia: 'Transferencia',
  debito:        'Débito',
  credito:       'Crédito',
}

function VentasHoyPanel({
  ventas,
  onReimprimir,
}: {
  ventas:       VentaHoy[]
  onReimprimir: (ventaId: string) => Promise<void>
}) {
  const [expandida,   setExpandida]   = useState<string | null>(null)
  const [reimpresoId, setReimpresoId] = useState<string | null>(null)

  const totalDia    = ventas.reduce((s, v) => s + v.total, 0)
  const cantidadDia = ventas.reduce((s, v) => s + v.venta_items.reduce((si, i) => si + i.cantidad, 0), 0)

  async function handleReimprimir(e: React.MouseEvent, ventaId: string) {
    e.stopPropagation()
    setReimpresoId(ventaId)
    await onReimprimir(ventaId)
    setReimpresoId(null)
  }

  if (ventas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center p-10">
        <ShoppingCart className="w-12 h-12 text-slate-200 mb-3" />
        <p className="text-sm font-medium text-slate-400">Sin ventas hoy todavía</p>
        <p className="text-xs text-slate-300 mt-1">Las ventas del día aparecerán aquí</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Resumen del día */}
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div>
          <p className="text-xs text-slate-500 font-medium">Total del día</p>
          <p className="text-lg font-bold text-slate-900">{ARS(totalDia)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 font-medium">{ventas.length} venta{ventas.length !== 1 && 's'}</p>
          <p className="text-sm font-semibold text-slate-600">{cantidadDia} ítem{cantidadDia !== 1 && 's'}</p>
        </div>
      </div>

      {/* Lista */}
      <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {ventas.map((v) => {
          const isOpen    = expandida === v.id
          const itemCount = v.venta_items.reduce((s, i) => s + i.cantidad, 0)
          const hora      = new Date(v.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
          const numStr    = v.numero_venta ? `#${String(v.numero_venta).padStart(3, '0')}` : null

          return (
            <li key={v.id}>
              <div
                onClick={() => setExpandida(isOpen ? null : v.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {numStr && (
                      <span className="text-xs font-mono font-bold text-slate-400">{numStr}</span>
                    )}
                    <span className="text-sm font-bold text-slate-900">{ARS(v.total)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${METODO_BADGE[v.metodo_pago] ?? 'bg-slate-100 text-slate-600'}`}>
                      {METODO_LABEL[v.metodo_pago] ?? v.metodo_pago}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {hora} · {itemCount} ítem{itemCount !== 1 && 's'}
                  </p>
                </div>
                <button
                  onClick={(e) => handleReimprimir(e, v.id)}
                  disabled={reimpresoId === v.id}
                  title="Reimprimir"
                  className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                >
                  {reimpresoId === v.id
                    ? <span className="w-3.5 h-3.5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin block" />
                    : <Printer className="w-3.5 h-3.5" />
                  }
                </button>
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                }
              </div>

              {isOpen && (
                <div className="px-5 pb-3 bg-slate-50 space-y-1.5">
                  {v.venta_items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-slate-600">
                      <span className="truncate flex-1 mr-2">
                        {item.productos?.nombre ?? 'Producto eliminado'}
                        <span className="text-slate-400 ml-1">× {item.cantidad}</span>
                      </span>
                      <span className="font-semibold shrink-0">{ARS(item.subtotal ?? item.precio_unitario * item.cantidad)}</span>
                    </div>
                  ))}
                  {numStr && <p className="text-xs text-slate-400 font-mono pt-1">{numStr}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Modal de impresión post-venta ───────────────────────────────────────────

function ModalImpresion({
  ventaId,
  total,
  metodoPago,
  printData,
  imprimirTicketAuto,
  onImprimir,
  onCerrar,
}: {
  ventaId:            string
  total:              number
  metodoPago:         string
  printData:          PrintData
  imprimirTicketAuto: boolean
  onImprimir:         (data: PrintData) => void
  onCerrar:           () => void
}) {
  const ticketBtnRef = useRef<HTMLButtonElement>(null)
  const [vista,        setVista]        = useState<'opciones' | 'factura_x'>('opciones')
  const [razonSocial,  setRazonSocial]  = useState('')
  const [cuitDni,      setCuitDni]      = useState('')
  const [direccion,    setDireccion]    = useState('')
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [errorConv,    setErrorConv]    = useState<string | null>(null)

  useEffect(() => {
    if (imprimirTicketAuto) ticketBtnRef.current?.focus()
  }, [imprimirTicketAuto])

  function handleTicket() {
    onImprimir(printData)
    onCerrar()
  }

  async function handleFacturaXConfirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!razonSocial.trim()) return
    setConvirtiendo(true)
    setErrorConv(null)
    const datos: DatosCliente = {
      razon_social: razonSocial.trim(),
      cuit_dni:     cuitDni.trim()   || null,
      direccion:    direccion.trim() || null,
    }
    const res = await convertirVentaAFacturaX(ventaId, datos)
    setConvirtiendo(false)
    if (res.error) {
      setErrorConv(res.error)
      return
    }
    const facturaData: PrintData = {
      ...printData,
      tipoComprobante:   'factura_x',
      numeroComprobante: res.numeroComprobante,
      datosCliente:      datos,
    }
    onImprimir(facturaData)
    onCerrar()
  }

  const numStr = printData.numeroVenta
    ? `#${String(printData.numeroVenta).padStart(3, '0')}`
    : ''

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

        {/* Header verde */}
        <div className="bg-emerald-500 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">Venta confirmada</p>
              {numStr && <p className="text-white/70 text-sm">{numStr}</p>}
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Resumen */}
        <div className="px-6 py-4 bg-slate-50 flex items-center justify-between border-b border-slate-100">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total cobrado</p>
            <p className="text-2xl font-bold text-slate-900">{ARS(total)}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${METODO_BADGE[metodoPago] ?? 'bg-slate-100 text-slate-600'}`}>
            {METODO_LABEL[metodoPago] ?? metodoPago}
          </span>
        </div>

        {vista === 'opciones' ? (
          /* ─── Vista: opciones de comprobante ─── */
          <div className="p-5 space-y-2.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide text-center">
              ¿Qué comprobante querés imprimir?
            </p>

            <button
              ref={ticketBtnRef}
              onClick={handleTicket}
              className="w-full flex items-center gap-4 px-5 py-[18px] rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            >
              <Printer className="w-6 h-6 shrink-0" />
              <div className="text-left">
                <p className="text-[15px] font-bold">Ticket interno</p>
                <p className="text-xs text-blue-200 font-normal">Comprobante simple</p>
              </div>
            </button>

            <button
              onClick={() => setVista('factura_x')}
              className="w-full flex items-center gap-4 px-5 py-[18px] rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white font-bold transition-all"
            >
              <FileText className="w-6 h-6 shrink-0" />
              <div className="text-left">
                <p className="text-[15px] font-bold">Factura X</p>
                <p className="text-xs text-violet-200 font-normal">Con datos del cliente</p>
              </div>
            </button>

            <button
              onClick={onCerrar}
              className="w-full flex items-center gap-4 px-5 py-[18px] rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] text-slate-600 font-semibold transition-all"
            >
              <X className="w-6 h-6 shrink-0" />
              <div className="text-left">
                <p className="text-[15px] font-semibold">Sin comprobante</p>
                <p className="text-xs text-slate-400 font-normal">Solo registrar la venta</p>
              </div>
            </button>
          </div>
        ) : (
          /* ─── Vista: formulario Factura X ─── */
          <form onSubmit={handleFacturaXConfirmar} className="p-5 space-y-3.5">
            <div className="flex items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() => { setVista('opciones'); setErrorConv(null) }}
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
              >
                ← Volver
              </button>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-600" />
                <h3 className="text-sm font-bold text-slate-800">Datos del cliente</h3>
              </div>
            </div>

            {errorConv && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {errorConv}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Razón Social / Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                autoFocus
                required
                value={razonSocial}
                onChange={e => setRazonSocial(e.target.value)}
                placeholder="Ej: Juan García"
                className="w-full px-4 py-3 text-base text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                CUIT / DNI <span className="text-xs text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={cuitDni}
                onChange={e => setCuitDni(e.target.value)}
                placeholder="Ej: 20-12345678-9"
                className="w-full px-4 py-3 text-base text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Dirección <span className="text-xs text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                placeholder="Ej: Av. Corrientes 1234"
                className="w-full px-4 py-3 text-base text-slate-900 placeholder-slate-400 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setVista('opciones'); setErrorConv(null) }}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!razonSocial.trim() || convirtiendo}
                className="flex-1 px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold transition-colors"
              >
                {convirtiendo ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Procesando...
                  </span>
                ) : 'Confirmar y emitir'}
              </button>
            </div>
          </form>
        )}
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
