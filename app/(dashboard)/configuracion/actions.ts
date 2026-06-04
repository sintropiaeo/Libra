'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PermisosEmpleado } from '@/lib/permisos'
import { PERMISOS_DEFAULT } from '@/lib/permisos'

// ─── Helper: verificar que el usuario en sesión es admin ─────────────────

async function verificarAdmin(): Promise<{ userId: string; negocioId: string } | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('perfiles')
    .select('rol, negocio_id')
    .eq('user_id', user.id)
    .single()

  if (!data || !['admin', 'super_admin'].includes(data.rol)) return null
  return { userId: user.id, negocioId: data.negocio_id }
}

// ─── Empleados ────────────────────────────────────────────────────────────

export async function crearEmpleado(formData: FormData): Promise<{ error?: string }> {
  const admin = await verificarAdmin()
  if (!admin) return { error: 'Sin permisos' }

  const nombre   = (formData.get('nombre')   as string | null)?.trim()
  const email    = (formData.get('email')    as string | null)?.trim()
  const password = (formData.get('password') as string | null)?.trim()
  const rol      = (formData.get('rol')      as string | null)?.trim() ?? 'cajero'

  if (!nombre || !email || !password) return { error: 'Completá todos los campos' }
  if (password.length < 6) return { error: 'La contraseña debe tener al menos 6 caracteres' }
  if (!['admin', 'cajero'].includes(rol)) return { error: 'Rol inválido' }

  const supabase = createAdminClient()

  // Crear usuario en auth con metadata para middleware
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { rol, negocio_id: admin.negocioId },
  })
  if (authError) return { error: authError.message }

  // Crear perfil vinculado al negocio del admin que lo crea
  const { error: perfilError } = await supabase.from('perfiles').insert({
    user_id:    authData.user.id,
    nombre,
    email,
    rol,
    permisos:   rol === 'cajero' ? PERMISOS_DEFAULT : {},
    activo:     true,
    negocio_id: admin.negocioId,
  })

  if (perfilError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return { error: perfilError.message }
  }

  revalidatePath('/configuracion')
  return {}
}

export async function actualizarRolEmpleado(
  perfilId: string,
  rol: 'admin' | 'cajero'
): Promise<{ error?: string }> {
  const admin = await verificarAdmin()
  if (!admin) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('perfiles')
    .update({ rol })
    .eq('id', perfilId)
    .eq('negocio_id', admin.negocioId)

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  return {}
}

export async function actualizarPermisosEmpleado(
  perfilId: string,
  permisos: PermisosEmpleado
): Promise<{ error?: string }> {
  const admin = await verificarAdmin()
  if (!admin) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('perfiles')
    .update({ permisos })
    .eq('id', perfilId)
    .eq('negocio_id', admin.negocioId)

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  return {}
}

export async function toggleActivoEmpleado(
  perfilId: string,
  activo: boolean
): Promise<{ error?: string }> {
  const admin = await verificarAdmin()
  if (!admin) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('perfiles')
    .update({ activo })
    .eq('id', perfilId)
    .eq('negocio_id', admin.negocioId)

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  return {}
}

// ─── Negocio ──────────────────────────────────────────────────────────────

export async function guardarNegocio(formData: FormData): Promise<{ error?: string }> {
  const admin = await verificarAdmin()
  if (!admin) return { error: 'Sin permisos' }

  const supabase = createAdminClient()

  // Manejar logo
  let logo_url: string | undefined
  const logoFile = formData.get('logo') as File | null

  if (logoFile && logoFile.size > 0) {
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

  const { data: existing } = await supabase
    .from('negocio_config')
    .select('id')
    .eq('negocio_id', admin.negocioId)
    .limit(1)
    .maybeSingle()

  let error
  if (existing) {
    ;({ error } = await supabase
      .from('negocio_config')
      .update(updates)
      .eq('id', existing.id))
  } else {
    ;({ error } = await supabase
      .from('negocio_config')
      .insert({ ...updates, negocio_id: admin.negocioId }))
  }

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  return {}
}

// ─── Métodos de pago ─────────────────────────────────────────────────────

export async function guardarMetodosPago(
  metodos: string[]
): Promise<{ error?: string }> {
  const admin = await verificarAdmin()
  if (!admin) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('negocio_config')
    .select('id')
    .eq('negocio_id', admin.negocioId)
    .limit(1)
    .maybeSingle()

  let error
  if (existing) {
    ;({ error } = await supabase
      .from('negocio_config')
      .update({ metodos_pago: metodos })
      .eq('id', existing.id))
  } else {
    ;({ error } = await supabase
      .from('negocio_config')
      .insert({ metodos_pago: metodos, negocio_id: admin.negocioId }))
  }

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  revalidatePath('/ventas/nueva')
  return {}
}

// ─── Categorías ───────────────────────────────────────────────────────────

export async function crearCategoria(nombre: string): Promise<{ error?: string }> {
  const admin = await verificarAdmin()
  if (!admin) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('categorias')
    .insert({ nombre: nombre.trim(), negocio_id: admin.negocioId })
  if (error) return { error: error.message }

  revalidatePath('/configuracion')
  revalidatePath('/productos')
  return {}
}

export async function actualizarCategoria(
  id: string,
  nombre: string
): Promise<{ error?: string }> {
  const admin = await verificarAdmin()
  if (!admin) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('categorias')
    .update({ nombre: nombre.trim() })
    .eq('id', id)
    .eq('negocio_id', admin.negocioId)

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  revalidatePath('/productos')
  return {}
}

export async function eliminarCategoria(id: string): Promise<{ error?: string }> {
  const admin = await verificarAdmin()
  if (!admin) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('categorias')
    .delete()
    .eq('id', id)
    .eq('negocio_id', admin.negocioId)
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
  const admin = await verificarAdmin()
  if (!admin) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('negocio_config')
    .select('id')
    .eq('negocio_id', admin.negocioId)
    .limit(1)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('negocio_config').update(payload).eq('id', existing.id)
    : await supabase.from('negocio_config').insert({ ...payload, negocio_id: admin.negocioId })

  if (error) return { error: error.message }
  revalidatePath('/configuracion')
  revalidatePath('/ventas/nueva')
  return {}
}
