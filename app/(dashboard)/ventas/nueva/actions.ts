'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
