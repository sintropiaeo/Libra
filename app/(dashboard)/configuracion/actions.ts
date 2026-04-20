'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PermisosEmpleado } from '@/lib/permisos'
import { PERMISOS_DEFAULT } from '@/lib/permisos'

// ─── Helper: verificar que el usuario en sesión es admin ─────────────────

async function verificarAdmin(): Promise<string | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('user_id', user.id)
    .single()

  return data?.rol === 'admin' ? user.id : null
}

// ─── Empleados ────────────────────────────────────────────────────────────

export async function crearEmpleado(formData: FormData): Promise<{ error?: string }> {
  const adminId = await verificarAdmin()
  if (!adminId) return { error: 'Sin permisos' }

  const nombre   = (formData.get('nombre')   as string | null)?.trim()
  const email    = (formData.get('email')    as string | null)?.trim()
  const password = (formData.get('password') as string | null)?.trim()

  if (!nombre || !email || !password) return { error: 'Completá todos los campos' }
  if (password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres' }

  const supabase = createAdminClient()

  // Crear usuario en auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError) return { error: authError.message }

  // Crear perfil
  const { error: perfilError } = await supabase.from('perfiles').insert({
    user_id: authData.user.id,
    nombre,
    email,
    rol:      'empleado',
    permisos: PERMISOS_DEFAULT,
    activo:   true,
  })

  if (perfilError) {
    // Rollback: eliminar el usuario creado
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { error: perfilError.message }
  }

  revalidatePath('/configuracion')
  return {}
}

export async function actualizarPermisosEmpleado(
  perfilId: string,
  permisos: PermisosEmpleado
): Promise<{ error?: string }> {
  const adminId = await verificarAdmin()
  if (!adminId) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('perfiles')
    .update({ permisos })
    .eq('id', perfilId)

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  return {}
}

export async function toggleActivoEmpleado(
  perfilId: string,
  activo: boolean
): Promise<{ error?: string }> {
  const adminId = await verificarAdmin()
  if (!adminId) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('perfiles')
    .update({ activo })
    .eq('id', perfilId)

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  return {}
}

// ─── Negocio ──────────────────────────────────────────────────────────────

export async function guardarNegocio(formData: FormData): Promise<{ error?: string }> {
  const adminId = await verificarAdmin()
  if (!adminId) return { error: 'Sin permisos' }

  const supabase = createAdminClient()

  // Manejar logo
  let logo_url: string | undefined
  const logoFile = formData.get('logo') as File | null

  if (logoFile && logoFile.size > 0) {
    // Crear bucket si no existe
    await supabase.storage
      .createBucket('logos', { public: true })
      .catch(() => {})

    const ext    = logoFile.name.split('.').pop() ?? 'jpg'
    const buffer = Buffer.from(await logoFile.arrayBuffer())

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('logos')
      .upload(`logo-${Date.now()}.${ext}`, buffer, {
        contentType: logoFile.type,
        upsert:      false,
      })

    if (!uploadError && uploadData) {
      const {
        data: { publicUrl },
      } = supabase.storage.from('logos').getPublicUrl(uploadData.path)
      logo_url = publicUrl
    }
  }

  const updates: Record<string, string> = {
    nombre:    (formData.get('nombre')    as string) ?? '',
    direccion: (formData.get('direccion') as string) ?? '',
    telefono:  (formData.get('telefono')  as string) ?? '',
  }
  if (logo_url) updates.logo_url = logo_url

  // negocio_config es un singleton — actualizamos la primera fila
  const { data: existing } = await supabase
    .from('negocio_config')
    .select('id')
    .limit(1)
    .single()

  let error
  if (existing) {
    ;({ error } = await supabase
      .from('negocio_config')
      .update(updates)
      .eq('id', existing.id))
  } else {
    ;({ error } = await supabase.from('negocio_config').insert(updates))
  }

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  return {}
}

// ─── Métodos de pago ─────────────────────────────────────────────────────

export async function guardarMetodosPago(
  metodos: string[]
): Promise<{ error?: string }> {
  const adminId = await verificarAdmin()
  if (!adminId) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('negocio_config')
    .select('id')
    .limit(1)
    .single()

  let error
  if (existing) {
    ;({ error } = await supabase
      .from('negocio_config')
      .update({ metodos_pago: metodos })
      .eq('id', existing.id))
  } else {
    ;({ error } = await supabase
      .from('negocio_config')
      .insert({ metodos_pago: metodos }))
  }

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  revalidatePath('/ventas/nueva')
  return {}
}

// ─── Categorías ───────────────────────────────────────────────────────────

export async function crearCategoria(nombre: string): Promise<{ error?: string }> {
  const adminId = await verificarAdmin()
  if (!adminId) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('categorias').insert({ nombre: nombre.trim() })
  if (error) return { error: error.message }

  revalidatePath('/configuracion')
  revalidatePath('/productos')
  return {}
}

export async function actualizarCategoria(
  id: string,
  nombre: string
): Promise<{ error?: string }> {
  const adminId = await verificarAdmin()
  if (!adminId) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('categorias')
    .update({ nombre: nombre.trim() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  revalidatePath('/productos')
  return {}
}

export async function eliminarCategoria(id: string): Promise<{ error?: string }> {
  const adminId = await verificarAdmin()
  if (!adminId) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('categorias').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/configuracion')
  revalidatePath('/productos')
  return {}
}

export async function guardarDispositivos(payload: {
  imprimir_ticket_auto: boolean
  tamano_ticket:        string
  sonido_escaneo:       boolean
}): Promise<{ error?: string }> {
  const adminId = await verificarAdmin()
  if (!adminId) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('negocio_config')
    .select('id')
    .limit(1)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('negocio_config').update(payload).eq('id', existing.id)
    : await supabase.from('negocio_config').insert(payload)

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  revalidatePath('/ventas/nueva')
  return {}
}
