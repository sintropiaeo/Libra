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

  const { data: configData, error: configError } = await supabase
    .from('configuracion_ticket')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (configError) {
    console.error('[TicketsPage] Error al cargar configuracion_ticket:', configError)
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Tickets de Venta</h1>
        <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-6 max-w-lg">
          <p className="font-semibold text-red-800 mb-1">No se pudo cargar la configuración</p>
          <p className="text-sm text-red-600">
            La tabla de configuración de tickets no existe todavía en la base de datos.
            Ejecutá la migración <code className="font-mono bg-red-100 px-1 rounded">migration_configuracion_ticket.sql</code> en el SQL Editor de Supabase y recargá esta página.
          </p>
        </div>
      </div>
    )
  }

  return (
    <TicketsCliente config={(configData as ConfiguracionTicket | null)} />
  )
}
