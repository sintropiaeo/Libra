'use server'

import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath }    from 'next/cache'
import type { ConfiguracionTicket } from '@/lib/permisos'

async function verificarAdminConfig(): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('perfiles').select('rol').eq('user_id', user.id).single()
  return data?.rol === 'admin' || data?.rol === 'super_admin'
}

export async function guardarConfigTicket(
  payload: Omit<ConfiguracionTicket, 'id'>
): Promise<{ error?: string }> {
  const ok = await verificarAdminConfig()
  if (!ok) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('configuracion_ticket')
    .select('id')
    .limit(1)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('configuracion_ticket').update(payload).eq('id', existing.id)
    : await supabase.from('configuracion_ticket').insert(payload)

  if (error) return { error: error.message }
  revalidatePath('/configuracion/tickets')
  revalidatePath('/ventas/nueva')
  return {}
}
