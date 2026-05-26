'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { tieneAcceso } from '@/lib/permisos'
import type { Perfil } from '@/lib/permisos'

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
  categorias: { nombre: string } | null
}

export async function buscarProductosPOS(q: string): Promise<ProductoPOS[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const trimmed = q.trim()
  if (!trimmed) return []

  const { data } = await supabase
    .from('productos')
    .select(`
      id, nombre, descripcion,
      precio_venta, stock_actual, stock_minimo,
      codigo_barras, codigo_interno, unidad, permitir_venta_sin_stock,
      categorias ( nombre )
    `)
    .eq('activo', true)
    .or(`nombre.ilike.%${trimmed}%,codigo_barras.eq.${trimmed},codigo_interno.ilike.%${trimmed}%`)
    .order('nombre')
    .limit(40)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any) ?? []
}

type ItemVenta = {
  producto_id: string
  cantidad: number
  precio_unitario: number
}

type MetodoPago = 'efectivo' | 'transferencia' | 'debito' | 'credito'

export async function crearVenta(payload: {
  items: ItemVenta[]
  metodo_pago: MetodoPago
  notas?: string
}): Promise<{ error?: string; ventaId?: string; numeroVenta?: number }> {
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

  // Calcular total en el servidor (no confiar en el cliente)
  const total = payload.items.reduce(
    (sum, item) => sum + item.precio_unitario * item.cantidad,
    0
  )

  // 1. Crear la venta
  const { data: venta, error: ventaError } = await supabase
    .from('ventas')
    .insert({
      total,
      metodo_pago: payload.metodo_pago,
      notas: payload.notas?.trim() || null,
    })
    .select('id, numero_venta')
    .single()

  if (ventaError || !venta) {
    return { error: ventaError?.message ?? 'Error al registrar la venta.' }
  }

  // 2. Crear los ítems (los triggers de DB actualizan el stock automáticamente)
  const { error: itemsError } = await supabase.from('venta_items').insert(
    payload.items.map((item) => ({
      venta_id:        venta.id,
      producto_id:     item.producto_id,
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
  return { ventaId: venta.id, numeroVenta: venta.numero_venta }
}
