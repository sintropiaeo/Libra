'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Demo pública desactivada 2026-09-01 — se detectó posible uso indebido y
// además contribuía a la carga compartida de la base (ver memoria project_libra_pending).
// Reactivar poniendo esto en true (además de restaurar el botón en login-form.tsx).
const DEMO_HABILITADA = false

export async function signIn(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: 'Email o contraseña incorrectos.' }
  }

  redirect('/dashboard')
}

export async function signInDemo(): Promise<{ error: string | null }> {
  if (!DEMO_HABILITADA) {
    return { error: 'La demo no está disponible por el momento.' }
  }

  const email    = process.env.DEMO_EMAIL
  const password = process.env.DEMO_PASSWORD

  if (!email || !password) {
    return { error: 'Demo no disponible en este momento.' }
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'No se pudo acceder a la demo. Intentá de nuevo.' }
  }

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
