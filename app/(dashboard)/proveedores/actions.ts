'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ActionResult = { error?: string; success?: boolean }

export async function crearProveedor(formData: FormData): Promise<ActionResult> {
  const supabase = createClient()

  const { error } = await supabase.from('proveedores').insert({
    nombre:    (formData.get('nombre') as string).trim(),
    telefono:  (formData.get('telefono') as string)?.trim() || null,
    email:     (formData.get('email') as string)?.trim() || null,
    direccion: (formData.get('direccion') as string)?.trim() || null,
    notas:     (formData.get('notas') as string)?.trim() || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/proveedores')
  return { success: true }
}

export async function actualizarProveedor(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient()

  const { error } = await supabase
    .from('proveedores')
    .update({
      nombre:    (formData.get('nombre') as string).trim(),
      telefono:  (formData.get('telefono') as string)?.trim() || null,
      email:     (formData.get('email') as string)?.trim() || null,
      direccion: (formData.get('direccion') as string)?.trim() || null,
      notas:     (formData.get('notas') as string)?.trim() || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/proveedores')
  return { success: true }
}

export async function toggleActivoProveedor(
  id: string,
  activo: boolean
): Promise<ActionResult> {
  const supabase = createClient()
  const { error } = await supabase
    .from('proveedores')
    .update({ activo })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/proveedores')
  return { success: true }
}
