'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ItemCompra = {
  producto_id: string
  cantidad: number
  precio_unitario: number
}

// ─── Crear compra ─────────────────────────────────────────────────────────────

export async function crearCompra(payload: {
  proveedor_id: string | null
  items: ItemCompra[]
  notas?: string
  actualizarPrecios?: { producto_id: string; precio_costo: number }[]
}): Promise<{ error?: string; compraId?: string }> {
  const supabase = createClient()

  if (!payload.items.length) {
    return { error: 'Agregá al menos un producto.' }
  }

  const total = payload.items.reduce(
    (sum, item) => sum + item.precio_unitario * item.cantidad,
    0
  )

  // 1. Crear la compra
  const { data: compra, error: compraError } = await supabase
    .from('compras_proveedor')
    .insert({
      proveedor_id: payload.proveedor_id || null,
      total,
      notas: payload.notas?.trim() || null,
    })
    .select('id')
    .single()

  if (compraError || !compra) {
    return { error: compraError?.message ?? 'Error al registrar la compra.' }
  }

  // 2. Insertar ítems — el trigger de DB sube el stock automáticamente
  const { error: itemsError } = await supabase.from('compra_items').insert(
    payload.items.map((item) => ({
      compra_id:       compra.id,
      producto_id:     item.producto_id,
      cantidad:        item.cantidad,
      precio_unitario: item.precio_unitario,
      // subtotal es GENERATED — no se incluye
    }))
  )

  if (itemsError) {
    // Rollback: eliminar la compra (CASCADE + trigger revierten el stock)
    await supabase.from('compras_proveedor').delete().eq('id', compra.id)
    return { error: itemsError.message }
  }

  // 3. Actualizar precio_costo en productos si el usuario lo pidió
  if (payload.actualizarPrecios?.length) {
    await Promise.all(
      payload.actualizarPrecios.map(({ producto_id, precio_costo }) =>
        supabase.from('productos').update({ precio_costo }).eq('id', producto_id)
      )
    )
  }

  revalidatePath('/compras')
  revalidatePath('/productos')
  revalidatePath('/dashboard')
  return { compraId: compra.id }
}

// ─── Crear producto rápido (desde el formulario de compra) ────────────────────

type ProductoRapido = {
  id: string
  nombre: string
  precio_costo: number
  stock_actual: number
  unidad: string
  codigo_barras: null
  categorias: null
}

export async function crearProductoRapido(
  formData: FormData
): Promise<{ error?: string; producto?: ProductoRapido }> {
  const supabase = createClient()

  const nombre     = (formData.get('nombre') as string)?.trim()
  const unidad     = (formData.get('unidad') as string) || 'unidad'
  const precio_costo  = Number(formData.get('precio_costo') || 0)
  const stock_minimo  = Number(formData.get('stock_minimo') || 5)

  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const { data, error } = await supabase
    .from('productos')
    .insert({
      nombre,
      unidad,
      precio_costo,
      precio_venta: 0,
      stock_actual: 0,
      stock_minimo,
      activo: true,
    })
    .select('id, nombre, precio_costo, stock_actual, unidad')
    .single()

  if (error || !data) {
    return { error: error?.message ?? 'Error al crear el producto.' }
  }

  revalidatePath('/productos')

  return {
    producto: {
      id:           data.id,
      nombre:       data.nombre,
      precio_costo: Number(data.precio_costo),
      stock_actual: data.stock_actual,
      unidad:       data.unidad,
      codigo_barras: null,
      categorias:   null,
    },
  }
}
