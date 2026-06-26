import type { ConfiguracionTicket } from './permisos'

// ─── Tipos compartidos comprobantes ──────────────────────────────────────────

export type TipoComprobante = 'ticket' | 'factura_x'

export type DatosCliente = {
  razon_social: string
  cuit_dni?:    string | null
  direccion?:   string | null
}

export type TicketItem = {
  nombre:          string
  cantidad:        number
  precio_unitario: number
  unidad:          string
}

export type PrintData = {
  numeroVenta:       number
  items:             TicketItem[]
  total:             number
  metodoPago:        string
  vendedor?:         string
  tipoComprobante?:  TipoComprobante
  numeroComprobante?: string
  datosCliente?:     DatosCliente | null
}

export type PrintOptions = {
  configTicket:  ConfiguracionTicket | null
  tamanoTicket:  '58mm' | '80mm'
  negocioNombre: string
}

// ─── Generador HTML ───────────────────────────────────────────────────────────

export function generarHTMLTicket(data: PrintData, options: PrintOptions): string {
  const cfg   = options.configTicket
  const ancho = (cfg?.ancho_papel ?? options.tamanoTicket) as string
  const width = ancho === '58mm' ? '54mm' : '76mm'
  const copias = cfg?.copias_a_imprimir ?? 1
  const esFX   = data.tipoComprobante === 'factura_x'

  const fecha = new Date().toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const numStr = data.numeroVenta ? `#${String(data.numeroVenta).padStart(3, '0')}` : ''
  const metodoLabel: Record<string, string> = {
    efectivo: 'Efectivo', transferencia: 'Transferencia',
    debito: 'Débito', credito: 'Crédito',
  }

  const itemsHTML = data.items
    .map(i => {
      const sub = i.precio_unitario * i.cantidad
      return `<div class="item"><div class="item-n">${i.nombre}</div><div class="row item-d"><span>${i.cantidad}× $${i.precio_unitario.toLocaleString('es-AR')}/${i.unidad}</span><span>$${sub.toLocaleString('es-AR')}</span></div></div>`
    })
    .join('')

  const nombreComercio = cfg?.nombre_comercio || options.negocioNombre || 'Mi Negocio'

  const cabecera = [
    esFX ? '<div class="c b">COMPROBANTE NO FISCAL</div>' : '',
    esFX ? '<div class="c b big">FACTURA X</div>' : '',
    cfg?.mostrar_logo && cfg?.logo_url
      ? `<img src="${cfg.logo_url}" style="display:block;max-width:80px;max-height:60px;margin:0 auto 4px;object-fit:contain">`
      : '',
    `<div class="c b big">${nombreComercio}</div>`,
    cfg?.mostrar_cuit && cfg?.cuit
      ? `<div class="c">CUIT: ${cfg.cuit}</div><div class="c">${cfg.condicion_iva}</div>`
      : '',
    cfg?.mostrar_direccion && cfg?.direccion
      ? `<div class="c">${cfg.direccion}</div>`
      : '',
    cfg?.mostrar_telefono && cfg?.telefono
      ? `<div class="c">Tel: ${cfg.telefono}</div>`
      : '',
  ].filter(Boolean).join('')

  const datosClienteHTML = esFX && data.datosCliente
    ? [
        '<hr class="sep">',
        `<div><b>Señor/es:</b> ${data.datosCliente.razon_social}</div>`,
        data.datosCliente.cuit_dni   ? `<div>CUIT/DNI: ${data.datosCliente.cuit_dni}</div>`   : '',
        data.datosCliente.direccion  ? `<div>Domicilio: ${data.datosCliente.direccion}</div>`  : '',
      ].filter(Boolean).join('')
    : ''

  const compLabel = esFX && data.numeroComprobante
    ? `<div>Nro: <b>${data.numeroComprobante}</b></div>`
    : ''

  const pie = [
    cfg?.mostrar_vendedor && data.vendedor ? `<div>Vendedor: ${data.vendedor}</div>` : '',
    esFX
      ? '<hr class="sep"><div class="c">Documento no válido como factura</div>'
      : cfg?.mensaje_pie
        ? `<hr class="sep"><div class="c">${cfg.mensaje_pie}</div>`
        : '<hr class="sep"><div class="c">¡Gracias!</div>',
  ].filter(Boolean).join('')

  const ticketBody = `
${cabecera}
<hr class="sep">
<div class="fecha">${fecha}</div>${numStr ? `<div class="fecha">Venta <b>${numStr}</b></div>` : ''}
${compLabel}
${datosClienteHTML}
<hr class="sep">
<div class="row col-header"><span>Producto</span><span>Precio</span></div>
<hr class="sep-d">
${itemsHTML}
<hr class="sep">
<div class="row total-row"><span>TOTAL</span><span>$${data.total.toLocaleString('es-AR')}</span></div>
<hr class="sep-d">
<div class="fecha">Método: ${metodoLabel[data.metodoPago] ?? data.metodoPago}</div>
${pie}`

  const copiasHTML = Array.from({ length: copias })
    .map(() => `<div class="copia">${ticketBody}</div>`)
    .join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;font-size:12px;width:${width};padding:6px}
.c{text-align:center}
.b{font-weight:bold}
.big{font-size:18px;font-weight:800}
.fecha{font-size:12px;font-weight:500}
.col-header{font-size:13px;font-weight:700}
.sep{border:none;border-top:1.5px solid #000;margin:5px 0}
.sep-d{border:none;border-top:1px dashed #666;margin:4px 0}
.row{display:flex;justify-content:space-between;gap:4px}
.row span:first-child{flex:1}
.item{margin-bottom:7px}
.item-n{font-size:14px;font-weight:700}
.item-d{font-size:13px;font-weight:600}
.total-row{font-size:18px;font-weight:800}
.copia{page-break-after:always}.copia:last-child{page-break-after:auto}
@media print{@page{size:${ancho} auto;margin:4mm}}
</style></head><body>${copiasHTML}</body></html>`
}
