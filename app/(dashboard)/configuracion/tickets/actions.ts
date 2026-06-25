'use server'

import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath }    from 'next/cache'
import type { ConfiguracionTicket } from '@/lib/permisos'

async function verificarAdminConfig(): Promise<{ ok: boolean; negocioId: string | null }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, negocioId: null }
  const { data } = await supabase.from('perfiles').select('rol, negocio_id').eq('user_id', user.id).single()
  const ok = data?.rol === 'admin' || data?.rol === 'super_admin'
  return { ok, negocioId: data?.negocio_id ?? null }
}

export async function guardarConfigTicket(
  payload: Omit<ConfiguracionTicket, 'id'>
): Promise<{ error?: string }> {
  const { ok, negocioId } = await verificarAdminConfig()
  if (!ok || !negocioId) return { error: 'Sin permisos' }

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('configuracion_ticket')
    .select('id')
    .eq('negocio_id', negocioId)
    .limit(1)
    .maybeSingle()

  const { error } = existing
    ? await supabase.from('configuracion_ticket').update(payload).eq('id', existing.id)
    : await supabase.from('configuracion_ticket').insert({ ...payload, negocio_id: negocioId })

  if (error) return { error: error.message }
  revalidatePath('/configuracion/tickets')
  revalidatePath('/ventas/nueva')
  return {}
}
