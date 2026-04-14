'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ActionResult = { error?: string; success?: boolean }

export async function crearProducto(formData: FormData): Promise<ActionResult> {
  const supabase = createClient()

  const { error } = await supabase.from('productos').insert({
    nombre:        (formData.get('nombre') as string).trim(),
    descripcion:   (formData.get('descripcion') as string)?.trim() || null,
    categoria_id:  (formData.get('categoria_id') as string) || null,
    precio_costo:  Number(formData.get('precio_costo')),
    precio_venta:  Number(formData.get('precio_venta')),
    stock_actual:  Number(formData.get('stock_actual')),
    stock_minimo:  Number(formData.get('stock_minimo')),
    codigo_barras: (formData.get('codigo_barras') as string)?.trim() || null,
    unidad:        formData.get('unidad') as string,
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
      nombre:        (formData.get('nombre') as string).trim(),
      descripcion:   (formData.get('descripcion') as string)?.trim() || null,
      categoria_id:  (formData.get('categoria_id') as string) || null,
      precio_costo:  Number(formData.get('precio_costo')),
      precio_venta:  Number(formData.get('precio_venta')),
      stock_actual:  Number(formData.get('stock_actual')),
      stock_minimo:  Number(formData.get('stock_minimo')),
      codigo_barras: (formData.get('codigo_barras') as string)?.trim() || null,
      unidad:        formData.get('unidad') as string,
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
