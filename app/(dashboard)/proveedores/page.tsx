import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProveedoresCliente from '@/components/proveedores/proveedores-cliente'
import type { Perfil } from '@/lib/permisos'
import { tieneAcceso } from '@/lib/permisos'

export const metadata = { title: 'Proveedores — Libra' }

export default async function ProveedoresPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfilData } = await supabase
    .from('perfiles').select('*').eq('user_id', user.id).single()
  if (!tieneAcceso(perfilData as Perfil | null, 'proveedores')) redirect('/ventas/nueva')

  const { data: proveedoresRaw } = await supabase
    .from('proveedores')
    .select('id, nombre, telefono, email, direccion, notas, activo, created_at')
    .order('nombre')

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ProveedoresCliente initialProveedores={(proveedoresRaw as any) ?? []} />
  )
}
