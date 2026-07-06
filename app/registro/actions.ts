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

  // Crear usuario en auth (auto-confirmado, sin necesitar verificar email)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return { error: authError?.message ?? 'Error al crear el usuario.' }
  }

  // Multi-tenant: cada registro crea SIEMPRE un negocio nuevo con su propio UUID
  const { data: nuevoNegocio, error: negocioError } = await admin
    .from('negocios').insert({ nombre: nombreNegocio }).select('id').single()

  if (negocioError || !nuevoNegocio) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: 'Error al crear el negocio.' }
  }
  const negocioId = nuevoNegocio.id

  // Crear perfil admin vinculado al negocio recién creado
  const { error: perfilError } = await admin.from('perfiles').insert({
    user_id:    authData.user.id,
    nombre,
    email,
    rol:        'admin',
    permisos:   {},
    activo:     true,
    negocio_id: negocioId,
  })

  if (perfilError) {
    // Limpieza: borrar el negocio huérfano y el usuario de auth
    await admin.from('negocios').delete().eq('id', negocioId)
    await admin.auth.admin.deleteUser(authData.user.id)
    return { error: perfilError.message }
  }

  // Crear negocio_config del negocio nuevo (no bloqueante)
  await admin.from('negocio_config').insert({ nombre: nombreNegocio, negocio_id: negocioId })

  // Iniciar sesión automáticamente
  const supabase = createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    redirect('/login')
  }

  redirect('/dashboard')
}
