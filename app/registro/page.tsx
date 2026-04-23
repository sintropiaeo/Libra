import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RegistroForm from './registro-form'

export const metadata = { title: 'Crear cuenta — Libra' }

export default async function RegistroPage() {
  const supabase = createClient()

  // Si ya hay un admin (no super_admin), el registro está cerrado
  const { count } = await supabase
    .from('perfiles')
    .select('*', { count: 'exact', head: true })
    .eq('rol', 'admin')

  if ((count ?? 0) > 0) redirect('/login')

  return <RegistroForm />
}
