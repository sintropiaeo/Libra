'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { tieneAcceso } from '@/lib/permisos'
import type { Perfil } from '@/lib/permisos'

type ActionResult = { error?: string; success?: boolean }

async function verificarAccesoProveedores() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('perfiles').select('*').eq('user_id', user.id).single()
  if (!tieneAcceso(data as Perfil | null, 'proveedores')) return null
  return supabase
}

export async function crearProveedor(formData: FormData): Promise<ActionResult> {
  const supabase = await verificarAccesoProveedores()
  if (!supabase) return { error: 'Sin permisos.' }

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
  const supabase = await verificarAccesoProveedores()
  if (!supabase) return { error: 'Sin permisos.' }

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
  const supabase = await verificarAccesoProveedores()
  if (!supabase) return { error: 'Sin permisos.' }
  const { error } = await supabase
    .from('proveedores')
    .update({ activo })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/proveedores')
  return { success: true }
}
