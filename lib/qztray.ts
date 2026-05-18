// QZ Tray — impresión silenciosa vía ESC/POS RAW (nativo para impresoras térmicas).
// Si QZ Tray no está corriendo, el POS cae en window.print() automáticamente.
//
// Primera vez: QZ Tray muestra popup "Allow / Block" — hacer clic en Allow.
// (Con "Remember this decision" tildado puede quedar grisado en modo sin certificado;
//  hacer clic en Allow SIN tildarlo es suficiente — QZ lo recuerda por sesión.)

import type { ConfiguracionTicket } from '@/lib/permisos'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QzLib = any

let _qz: QzLib = null

async function cargarQZ(): Promise<QzLib | null> {
  if (typeof window === 'undefined') return null
  if (_qz) return _qz
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('qz-tray') as any
    _qz = mod.default ?? mod
    // Modo sin certificado — QZ Tray pedirá permiso la primera vez
    _qz.security.setCertificatePromise((resolve: (s: string) => void) => resolve(''))
    _qz.security.setSignatureAlgorithm('SHA512')
    _qz.security.setSignaturePromise(
      () => (resolve: (s: string) => void) => resolve('')
    )
    return _qz
  } catch {
    return null
  }
}

export async function conectarQZ(): Promise<boolean> {
  const qz = await cargarQZ()
  if (!qz) return false
  if (qz.websocket.isActive()) return true
  try {
    await qz.websocket.connect({ retries: 2, delay: 1 })
    return true
  } catch {
    return false
  }
}

// ─── ESC/POS builder ─────────────────────────────────────────────────────────

// Mapa CP850 para caracteres españoles (byte = posición en el papel)
const CP850: Record<string, number> = {
  'á': 0xA0, 'Á': 0xB5,
  'é': 0x82, 'É': 0x90,
  'í': 0xA1, 'Í': 0xD6,
  'ó': 0xA2, 'Ó': 0xE0,
  'ú': 0xA3, 'Ú': 0xEA,
  'ñ': 0xA4, 'Ñ': 0xA5,
  'ü': 0x81, 'Ü': 0x9A,
  '¡': 0xAD, '¿': 0xA8,
}

function enc(s: string): number[] {
  return Array.from(s).map(c => CP850[c] ?? (c.charCodeAt(0) & 0xFF))
}

export type PrintData = {
  numeroVenta:  number
  items:        Array<{ nombre: string; cantidad: number; precio_unitario: number }>
  total:        number
  metodoPago:   string
  vendedor?:    string
}

function buildEscPos(
  cfg:    ConfiguracionTicket | null,
  nombre: string,
  ancho:  '58mm' | '80mm',
  data:   PrintData
): number[] {
  const COLS  = (cfg?.ancho_papel ?? ancho) === '58mm' ? 32 : 48
  const bytes: number[] = []

  const push  = (...b: number[]) => bytes.push(...b)
  const lf    = () => push(0x0A)
  const text  = (s: string) => push(...enc(s))
  const line  = (s = '') => { text(s); lf() }
  const sep   = () => line('-'.repeat(COLS))

  const alignLeft   = () => push(0x1B, 0x61, 0x00)
  const alignCenter = () => push(0x1B, 0x61, 0x01)
  const bold        = (on: boolean) => push(0x1B, 0x45, on ? 1 : 0)
  const dblSize     = (on: boolean) => push(0x1D, 0x21, on ? 0x11 : 0x00)

  function rowLR(left: string, right: string) {
    const available = COLS - right.length
    const l = left.length > available - 1 ? left.substring(0, available - 2) + '~' : left
    const spaces = COLS - l.length - right.length
    text(l)
    push(...Array(Math.max(1, spaces)).fill(0x20))
    text(right)
    lf()
  }

  // ── Init + código de página PC850 (soporta español)
  push(0x1B, 0x40)       // ESC @ inicializar
  push(0x1B, 0x74, 0x02) // ESC t 2 → CP850

  // ── Cabecera
  const nombreComercio = cfg?.nombre_comercio || nombre || 'Mi Negocio'
  alignCenter()
  dblSize(true); bold(true); line(nombreComercio)
  dblSize(false); bold(false)

  if (cfg?.mostrar_cuit && cfg.cuit) {
    line(`CUIT: ${cfg.cuit}`)
    line(cfg.condicion_iva)
  }
  if (cfg?.mostrar_direccion && cfg.direccion) line(cfg.direccion)
  if (cfg?.mostrar_telefono && cfg.telefono)   line(`Tel: ${cfg.telefono}`)

  // ── Datos de la venta
  alignLeft(); sep()

  const fecha  = new Date().toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const numStr = data.numeroVenta ? `#${String(data.numeroVenta).padStart(3, '0')}` : ''
  line(fecha)
  if (numStr) line(`Venta ${numStr}`)
  sep()

  // ── Items
  for (const item of data.items) {
    const sub      = item.precio_unitario * item.cantidad
    const qtyStr   = `${item.cantidad}x `
    const priceStr = `$${sub.toLocaleString('es-AR')}`
    const nameMax  = COLS - qtyStr.length - priceStr.length - 1
    const itemNombre = item.nombre.length > nameMax
      ? item.nombre.substring(0, nameMax - 1) + '~'
      : item.nombre
    rowLR(`${qtyStr}${itemNombre}`, priceStr)
  }

  sep()

  // ── Total
  bold(true)
  rowLR('TOTAL', `$${data.total.toLocaleString('es-AR')}`)
  bold(false)

  sep()

  const METODO: Record<string, string> = {
    efectivo: 'Efectivo', transferencia: 'Transferencia',
    debito: 'Debito', credito: 'Credito',
  }
  line(`Metodo: ${METODO[data.metodoPago] ?? data.metodoPago}`)

  if (cfg?.mostrar_vendedor && data.vendedor) {
    line(`Vendedor: ${data.vendedor}`)
  }

  if (cfg?.mensaje_pie) {
    sep()
    alignCenter()
    line(cfg.mensaje_pie)
    alignLeft()
  }

  // ── Avanzar papel y cortar
  push(0x1B, 0x64, 0x04)       // ESC d 4 → avanzar 4 líneas
  push(0x1D, 0x56, 0x42, 0x00) // GS V 66 0 → corte parcial

  return bytes
}

// ─── Función pública ──────────────────────────────────────────────────────────

export async function imprimirConQZ(
  cfg:    ConfiguracionTicket | null,
  nombre: string,
  ancho:  '58mm' | '80mm',
  data:   PrintData
): Promise<{ ok: boolean; error?: string }> {
  const qz = await cargarQZ()
  if (!qz) return { ok: false, error: 'Librería QZ Tray no disponible' }

  try {
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect({ retries: 1, delay: 0.5 })
    }

    const printer    = await qz.printers.getDefault()
    const ticketBytes = buildEscPos(cfg, nombre, ancho, data)
    const copias     = cfg?.copias_a_imprimir ?? 1

    // Repetir bytes N veces (cada copia incluye corte de papel)
    const allBytes: number[] = []
    for (let i = 0; i < copias; i++) allBytes.push(...ticketBytes)

    // Base64 es la única forma segura de enviar bytes binarios por el WebSocket de QZ Tray
    const raw64 = btoa(allBytes.map(b => String.fromCharCode(b)).join(''))

    const config = qz.configs.create(printer)
    await qz.print(config, [{ type: 'raw', format: 'base64', data: raw64 }])
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al imprimir' }
  }
}
