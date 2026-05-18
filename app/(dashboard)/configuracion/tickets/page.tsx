import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import TicketsCliente   from '@/components/configuracion/tickets-cliente'
import type { Perfil, ConfiguracionTicket } from '@/lib/permisos'

export const metadata = { title: 'Tickets de Venta — Libra' }

export default async function TicketsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfilData } = await supabase
    .from('perfiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const perfil = perfilData as Perfil | null
  if (perfil?.rol !== 'admin' && perfil?.rol !== 'super_admin') redirect('/dashboard')

  const { data: configData } = await supabase
    .from('configuracion_ticket')
    .select('*')
    .limit(1)
    .maybeSingle()

  return (
    <TicketsCliente config={(configData as ConfiguracionTicket | null)} />
  )
}
