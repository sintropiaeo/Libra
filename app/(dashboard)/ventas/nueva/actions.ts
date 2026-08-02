'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { tieneAcceso, esAdmin } from '@/lib/permisos'
import type { Perfil } from '@/lib/permisos'
import { redondearPrecio } from '@/lib/utils'
import type { TipoComprobante, DatosCliente } from '@/lib/ticket'

export type PresentacionPOS = {
  id: string
  nombre: string
  cantidad_base: number
  precio_venta: number
  codigo_barras: string | null
}

export type ProductoPOS = {
  id: string
  nombre: string
  descripcion: string | null
  precio_venta: number
  stock_actual: number
  stock_minimo: number
  codigo_barras: string | null
  codigo_interno: string | null
  unidad: string
  permitir_venta_sin_stock: boolean
  es_favorito: boolean
  tipo?: 'producto' | 'servicio'
  orden_favorito?: number | null
  categorias: { nombre: string } | null
  presentaciones?: PresentacionPOS[]           // presentaciones activas del producto
  match_presentacion?: PresentacionPOS | null  // seteado si el código escaneado matcheó esta presentación
}

const CAMPOS_PRODUCTO_POS = `
  id, nombre, descripcion,
  precio_venta, stock_actual, stock_minimo,
  codigo_barras, codigo_interno, unidad, permitir_venta_sin_stock,
  es_favorito, categorias ( nombre ),
  producto_presentaciones ( id, nombre, cantidad_base, precio_venta, codigo_barras, activo )
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProductoPOS(row: any): ProductoPOS {
  const presentaciones: PresentacionPOS[] = (row.producto_presentaciones ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((x: any) => x.activo)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((x: any) => ({
      id: x.id, nombre: x.nombre, cantidad_base: x.cantidad_base,
      precio_venta: Number(x.precio_venta), codigo_barras: x.codigo_barras,
    }))
    .sort((a: PresentacionPOS, b: PresentacionPOS) => a.cantidad_base - b.cantidad_base)
  const { producto_presentaciones, ...rest } = row
  void producto_presentaciones
  return { ...rest, presentaciones }
}

export async function buscarProductosPOS(q: string): Promise<ProductoPOS[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const trimmed = q.trim()
  if (!trimmed) return []

  // 1. Match exacto por código de barras de una PRESENTACIÓN activa
  const { data: presRows } = await supabase
    .from('producto_presentaciones')
    .select(`id, nombre, cantidad_base, precio_venta, codigo_barras, productos!inner ( ${CAMPOS_PRODUCTO_POS} )`)
    .eq('codigo_barras', trimmed)
    .eq('activo', true)
    .limit(5)

  const resultadosPres: ProductoPOS[] = (presRows ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = mapProductoPOS((row as any).productos)
    return {
      ...base,
      match_presentacion: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        id: (row as any).id, nombre: (row as any).nombre, cantidad_base: (row as any).cantidad_base,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        precio_venta: Number((row as any).precio_venta), codigo_barras: (row as any).codigo_barras,
      },
    }
  })

  // 2. Búsqueda normal de productos (nombre / código de barras / código interno)
  const { data } = await supabase
    .from('productos')
    .select(CAMPOS_PRODUCTO_POS)
    .eq('activo', true)
    .or(`nombre.ilike.%${trimmed}%,codigo_barras.eq.${trimmed},codigo_interno.ilike.%${trimmed}%`)
    .order('nombre')
    .limit(40)

  const resultadosProd: ProductoPOS[] = (data ?? []).map(mapProductoPOS)

  // Las presentaciones matcheadas por código van primero (para el escaneo)
  return [...resultadosPres, ...resultadosProd]
}

type ItemVenta = {
  producto_id: string
  cantidad: number
  precio_unitario: number
  presentacion_id?: string | null
}

type MetodoPago = 'efectivo' | 'transferencia' | 'debito' | 'credito'

export async function crearVenta(payload: {
  items:             ItemVenta[]
  metodo_pago:       MetodoPago
  notas?:            string
  tipo_comprobante?: TipoComprobante
  datos_cliente?:    DatosCliente
}): Promise<{ error?: string; ventaId?: string; numeroVenta?: number; numeroComprobante?: string }> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }
  const { data: perfilData } = await supabase.from('perfiles').select('*').eq('user_id', user.id).single()
  if (!tieneAcceso(perfilData as Perfil | null, 'ventas')) return { error: 'Sin permisos.' }

  if (!payload.items.length) {
    return { error: 'El carrito está vacío.' }
  }

  // Verificar caja abierta
  const { data: cajaAbierta } = await supabase
    .from('arqueos_caja')
    .select('id')
    .eq('estado', 'abierta')
    .limit(1)
    .maybeSingle()

  if (!cajaAbierta) {
    return { error: 'Debe abrir la caja antes de registrar una venta.' }
  }

  // Resolver el precio real desde el catálogo del negocio del usuario.
  // Nunca confiar en el precio_unitario que manda el cliente (evita fraude de caja).
  const negocioId = (perfilData as Perfil).negocio_id
  const productoIds = Array.from(new Set(payload.items.map((item) => item.producto_id)))

  const { data: productosDB, error: prodError } = await supabase
    .from('productos')
    .select('id, precio_venta')
    .eq('negocio_id', negocioId)
    .in('id', productoIds)

  if (prodError) return { error: prodError.message }

  const precioMap = new Map<string, number>()
  for (const p of productosDB ?? []) precioMap.set(p.id, Number(p.precio_venta))

  // Rechazar si algún producto no existe para este negocio
  for (const item of payload.items) {
    if (!precioMap.has(item.producto_id)) {
      return { error: 'Uno de los productos no existe o no pertenece a este negocio.' }
    }
  }

  // Resolver presentaciones (precio y validación de pertenencia)
  const presentacionIds = Array.from(new Set(
    payload.items.map((i) => i.presentacion_id).filter((x): x is string => !!x)
  ))
  const presMap = new Map<string, { producto_id: string; precio_venta: number; activo: boolean }>()
  if (presentacionIds.length > 0) {
    const { data: presDB, error: presError } = await supabase
      .from('producto_presentaciones')
      .select('id, producto_id, precio_venta, activo')
      .eq('negocio_id', negocioId)
      .in('id', presentacionIds)
    if (presError) return { error: presError.message }
    for (const p of presDB ?? []) {
      presMap.set(p.id, { producto_id: p.producto_id, precio_venta: Number(p.precio_venta), activo: p.activo })
    }
  }

  // Validar cada presentación: existe, activa, y pertenece al producto del ítem (regla 5)
  for (const item of payload.items) {
    if (!item.presentacion_id) continue
    const pr = presMap.get(item.presentacion_id)
    if (!pr)               return { error: 'Una presentación no existe o no pertenece a este negocio.' }
    if (!pr.activo)        return { error: 'Una presentación seleccionada está inactiva.' }
    if (pr.producto_id !== item.producto_id) {
      return { error: 'Una presentación no corresponde a su producto.' }
    }
  }

  // Admin: puede fijar un precio manual para ESTA venta.
  // Cajero/otros: siempre el precio del catálogo (anti-fraude, ignora el cliente).
  // El "catálogo" es el precio de la presentación si hay presentacion_id, si no el del producto.
  const admin = esAdmin(perfilData as Perfil | null)
  const itemsConPrecio = payload.items.map((item) => {
    const precioCatalogo = item.presentacion_id
      ? presMap.get(item.presentacion_id)!.precio_venta
      : precioMap.get(item.producto_id)!
    const precio =
      admin && Number.isFinite(item.precio_unitario) && item.precio_unitario >= 0
        ? redondearPrecio(item.precio_unitario)
        : precioCatalogo
    return {
      producto_id:     item.producto_id,
      presentacion_id: item.presentacion_id ?? null,
      cantidad:        item.cantidad,
      precio_unitario: precio,
    }
  })

  // Calcular total en el servidor con los precios reales
  const total = itemsConPrecio.reduce(
    (sum, item) => sum + item.precio_unitario * item.cantidad,
    0
  )

  // Generar número de comprobante si no es ticket simple
  let numeroComprobante: string | null = null
  const tipoComp = payload.tipo_comprobante ?? 'ticket'
  if (tipoComp !== 'ticket') {
    const letraMap: Record<string, string> = { factura_x: 'X' }
    const letra = letraMap[tipoComp] ?? tipoComp.toUpperCase()
    const { data: numData, error: numError } = await supabase
      .rpc('siguiente_numero_comprobante', { p_tipo: tipoComp })
    if (numError || numData == null) {
      return { error: `Error al generar número de comprobante: ${numError?.message ?? 'desconocido'}` }
    }
    numeroComprobante = `${letra}-0001-${String(numData).padStart(8, '0')}`
  }

  // 1. Crear la venta
  const { data: venta, error: ventaError } = await supabase
    .from('ventas')
    .insert({
      total,
      metodo_pago:        payload.metodo_pago,
      notas:              payload.notas?.trim() || null,
      tipo_comprobante:   tipoComp,
      numero_comprobante: numeroComprobante,
      datos_cliente:      payload.datos_cliente ?? null,
    })
    .select('id, numero_venta')
    .single()

  if (ventaError || !venta) {
    return { error: ventaError?.message ?? 'Error al registrar la venta.' }
  }

  // 2. Crear los ítems (los triggers de DB actualizan el stock automáticamente)
  const { error: itemsError } = await supabase.from('venta_items').insert(
    itemsConPrecio.map((item) => ({
      venta_id:        venta.id,
      producto_id:     item.producto_id,
      presentacion_id: item.presentacion_id,
      cantidad:        item.cantidad,
      precio_unitario: item.precio_unitario,
      // subtotal es columna GENERATED — no se incluye
    }))
  )

  if (itemsError) {
    // Rollback: eliminar la venta (CASCADE elimina los ítems parciales y el trigger revierte stock)
    await supabase.from('ventas').delete().eq('id', venta.id)
    return { error: itemsError.message }
  }

  revalidatePath('/ventas')
  revalidatePath('/dashboard')
  revalidatePath('/comprobantes')
  return { ventaId: venta.id, numeroVenta: venta.numero_venta, numeroComprobante: numeroComprobante ?? undefined }
}

export async function actualizarPrecioProducto(
  productoId: string,
  precio: number
): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { data: perfilData } = await supabase.from('perfiles').select('*').eq('user_id', user.id).single()
  const perfil = perfilData as Perfil | null

  // Verificación de rol admin en el servidor (no confiar en el front)
  if (!esAdmin(perfil)) return { error: 'Solo un administrador puede modificar el precio del producto.' }
  if (!Number.isFinite(precio) || precio < 0) return { error: 'Precio inválido.' }

  // Edición manual del admin: SÍ puede bajar el precio (a diferencia del import).
  const nuevoPrecio = redondearPrecio(precio)
  const { error } = await supabase
    .from('productos')
    .update({ precio_venta: nuevoPrecio })
    .eq('id', productoId)
    .eq('negocio_id', perfil!.negocio_id)

  if (error) return { error: error.message }
  revalidatePath('/productos')
  revalidatePath('/ventas/nueva')
  return {}
}

export async function guardarOrdenFavoritos(ids: string[]): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { data: perfilData } = await supabase.from('perfiles').select('*').eq('user_id', user.id).single()
  const perfil = perfilData as Perfil | null

  // Solo admin puede reordenar (verificación en servidor, no confiar en el front)
  if (!esAdmin(perfil)) return { error: 'Solo un administrador puede reordenar favoritos.' }

  // Guardar el orden = índice en la lista, scopeado al negocio
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from('productos')
      .update({ orden_favorito: i })
      .eq('id', ids[i])
      .eq('negocio_id', perfil!.negocio_id)
    if (error) return { error: error.message }
  }

  revalidatePath('/ventas/nueva')
  return {}
}

export async function convertirVentaAFacturaX(
  ventaId: string,
  datosCliente: DatosCliente,
): Promise<{ error?: string; numeroComprobante?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { data: numData, error: numError } = await supabase
    .rpc('siguiente_numero_comprobante', { p_tipo: 'factura_x' })
  if (numError || numData == null) {
    return { error: `Error al generar número de comprobante: ${numError?.message ?? 'desconocido'}` }
  }
  const numeroComprobante = `X-0001-${String(numData).padStart(8, '0')}`

  const { error: updateError } = await supabase
    .from('ventas')
    .update({
      tipo_comprobante:   'factura_x',
      numero_comprobante: numeroComprobante,
      datos_cliente:      datosCliente,
    })
    .eq('id', ventaId)

  if (updateError) return { error: updateError.message }

  revalidatePath('/comprobantes')
  return { numeroComprobante }
}
