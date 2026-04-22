'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function registrar(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const nombre        = (formData.get('nombre')        as string)?.trim()
  const email         = (formData.get('email')         as string)?.trim()
  const password      =  formData.get('password')      as string
  const nombreNegocio = (formData.get('nombre_negocio') as string)?.trim()

  if (!nombre || !email || !password || !nombreNegocio) {
    return { error: 'Completá todos los campos.' }
  }
  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  const admin = createAdminClient()

  // Doble check: que no haya admin aún
  const { count } = await admin
    .from('perfiles')
    .select('*', { count: 'exact', head: true })
    .in('rol', ['admin', 'super_admin'])

  if ((count ?? 0) > 0) {
    return { error: 'Ya existe un administrador registrado. Pedile que te cree una cuenta.' }
  }

  // Crear usuario en auth (auto-confirmado, sin necesitar verificar email)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return { error: authError?.message ?? 'Error al crear el usuario.' }
  }

  // Crear perfil admin
  const { error: perfilError } = await admin.from('perfiles').insert({
    user_id:  authData.user.id,
    nombre,
    email,
    rol:      'admin',
    permisos: {},
    activo:   true,
  })

  if (perfilError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: perfilError.message }
  }

  // Crear negocio_config
  const { data: negocioExisting } = await admin
    .from('negocio_config')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (negocioExisting) {
    await admin.from('negocio_config').update({ nombre: nombreNegocio }).eq('id', negocioExisting.id)
  } else {
    await admin.from('negocio_config').insert({ nombre: nombreNegocio })
  }

  // Iniciar sesión automáticamente
  const supabase = createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    redirect('/login')
  }

  redirect('/dashboard')
}
