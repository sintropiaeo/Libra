import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { puedeEditarProductos } from '@/lib/permisos'
import type { Perfil } from '@/lib/permisos'
import EtiquetasCliente from '@/components/productos/etiquetas-cliente'

export const metadata = { title: 'Imprimir etiquetas — Libra' }

export default async function EtiquetasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('perfiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!puedeEditarProductos(data as Perfil | null)) redirect('/productos')

  return <EtiquetasCliente />
}
