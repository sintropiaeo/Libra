import { createClient } from '@/lib/supabase/server'
import LoginForm from './login-form'

export const metadata = { title: 'Ingresar — Libra' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const supabase = createClient()

  // Mostrar registro solo si no hay ningún admin todavía
  const { count } = await supabase
    .from('perfiles')
    .select('*', { count: 'exact', head: true })
    .in('rol', ['admin', 'super_admin'])

  const mostrarRegistro = (count ?? 0) === 0

  return (
    <LoginForm
      mostrarRegistro={mostrarRegistro}
      errorParam={searchParams.error}
    />
  )
}
