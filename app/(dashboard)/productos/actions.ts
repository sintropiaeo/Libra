'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ActionResult = { error?: string; success?: boolean }

export async function crearProducto(formData: FormData): Promise<ActionResult> {
  const supabase = createClient()

  const { error } = await supabase.from('productos').insert({
    nombre:                   (formData.get('nombre') as string).trim(),
    descripcion:              (formData.get('descripcion') as string)?.trim() || null,
    categoria_id:             (formData.get('categoria_id') as string) || null,
    precio_costo:             Number(formData.get('precio_costo')),
    precio_venta:             Number(formData.get('precio_venta')),
    stock_actual:             Number(formData.get('stock_actual')),
    stock_minimo:             Number(formData.get('stock_minimo')),
    codigo_barras:            (formData.get('codigo_barras') as string)?.trim() || null,
    unidad:                   formData.get('unidad') as string,
    permitir_venta_sin_stock: formData.get('permitir_venta_sin_stock') === 'true',
  })

  if (error) return { error: error.message }
  revalidatePath('/productos')
  return { success: true }
}

export async function actualizarProducto(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient()

  const { error } = await supabase
    .from('productos')
    .update({
      nombre:                   (formData.get('nombre') as string).trim(),
      descripcion:              (formData.get('descripcion') as string)?.trim() || null,
      categoria_id:             (formData.get('categoria_id') as string) || null,
      precio_costo:             Number(formData.get('precio_costo')),
      precio_venta:             Number(formData.get('precio_venta')),
      stock_actual:             Number(formData.get('stock_actual')),
      stock_minimo:             Number(formData.get('stock_minimo')),
      codigo_barras:            (formData.get('codigo_barras') as string)?.trim() || null,
      unidad:                   formData.get('unidad') as string,
      permitir_venta_sin_stock: formData.get('permitir_venta_sin_stock') === 'true',
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/productos')
  return { success: true }
}

export async function toggleActivoProducto(
  id: string,
  activo: boolean
): Promise<ActionResult> {
  const supabase = createClient()
  const { error } = await supabase
    .from('productos')
    .update({ activo })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/productos')
  return { success: true }
}

// ─── Importación masiva ───────────────────────────────────────────────────────

export type ProductoImport = {
  nombre: string
  descripcion?: string | null
  precio_costo?: number
  precio_venta?: number
  stock_actual?: number
  stock_minimo?: number
  codigo_barras?: string | null
  unidad?: string
  categoria_nombre?: string | null
}

export type ImportLoteResult = {
  insertados: number
  actualizados: number
  saltados: number
  error?: string
}

export async function importarLoteProductos(
  batch: ProductoImport[],
  onDuplicate: 'actualizar' | 'saltar'
): Promise<ImportLoteResult> {
  const supabase = createClient()

  // Resolver categorías únicas en este lote
  const setNombres = new Set(batch.map((p) => p.categoria_nombre).filter(Boolean) as string[])
  const nombresCategoria = Array.from(setNombres)
  const categoriaMap: Record<string, string> = {}
  if (nombresCategoria.length > 0) {
    const { data: cats } = await supabase
      .from('categorias')
      .select('id, nombre')
      .in('nombre', nombresCategoria)
    for (const c of cats ?? []) categoriaMap[c.nombre] = c.id
  }

  // Detectar duplicados por código de barras
  const codigosEnBatch = batch
    .map((p) => p.codigo_barras)
    .filter((c): c is string => !!c)

  const existingMap: Record<string, string> = {}  // codigo_barras → id
  if (codigosEnBatch.length > 0) {
    const { data: existing } = await supabase
      .from('productos')
      .select('id, codigo_barras')
      .in('codigo_barras', codigosEnBatch)
    for (const p of existing ?? []) {
      if (p.codigo_barras) existingMap[p.codigo_barras] = p.id
    }
  }

  let insertados  = 0
  let actualizados = 0
  let saltados    = 0

  const toInsert: object[] = []
  const toUpdate: { id: string; data: object }[] = []

  for (const p of batch) {
    const row = {
      nombre:                   p.nombre.trim(),
      descripcion:              p.descripcion?.trim()   || null,
      categoria_id:             (p.categoria_nombre && categoriaMap[p.categoria_nombre]) || null,
      precio_costo:             p.precio_costo  ?? 0,
      precio_venta:             p.precio_venta  ?? 0,
      stock_actual:             p.stock_actual  ?? 0,
      stock_minimo:             p.stock_minimo  ?? 5,
      codigo_barras:            p.codigo_barras?.trim() || null,
      unidad:                   p.unidad        || 'unidad',
      activo:                   true,
      permitir_venta_sin_stock: false,
    }

    const existingId = p.codigo_barras ? existingMap[p.codigo_barras] : undefined

    if (existingId) {
      if (onDuplicate === 'actualizar') {
        toUpdate.push({ id: existingId, data: row })
      } else {
        saltados++
      }
    } else {
      toInsert.push(row)
    }
  }

  // Insertar nuevos
  if (toInsert.length > 0) {
    const { error } = await supabase.from('productos').insert(toInsert)
    if (error) return { insertados, actualizados, saltados, error: error.message }
    insertados += toInsert.length
  }

  // Actualizar duplicados
  for (const { id, data } of toUpdate) {
    const { error } = await supabase.from('productos').update(data).eq('id', id)
    if (!error) actualizados++
  }

  if (insertados + actualizados + saltados === batch.length) {
    revalidatePath('/productos')
  }

  return { insertados, actualizados, saltados }
}
