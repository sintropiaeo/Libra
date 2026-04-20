'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function abrirCaja(
  montoInicial: number
): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Verificar que no haya una caja ya abierta
  const { data: yaAbierta } = await supabase
    .from('arqueos_caja')
    .select('id')
    .eq('estado', 'abierta')
    .limit(1)
    .maybeSingle()

  if (yaAbierta) return { error: 'Ya hay una caja abierta' }

  // Obtener nombre del usuario
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre')
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase.from('arqueos_caja').insert({
    usuario_id:     user.id,
    usuario_nombre: perfil?.nombre ?? user.email!.split('@')[0],
    monto_inicial:  montoInicial,
    estado:         'abierta',
  })

  if (error) return { error: error.message }
  revalidatePath('/ventas/nueva')
  return {}
}

export async function cerrarCaja(payload: {
  arqueoId:            string
  montoFinalReal:      number
  montoFinalEsperado:  number
  observaciones?:      string
}): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { arqueoId, montoFinalReal, montoFinalEsperado, observaciones } = payload
  const diferencia = montoFinalReal - montoFinalEsperado

  const { error } = await supabase
    .from('arqueos_caja')
    .update({
      fecha_cierre:         new Date().toISOString(),
      monto_final_esperado: montoFinalEsperado,
      monto_final_real:     montoFinalReal,
      diferencia,
      observaciones:        observaciones?.trim() || null,
      estado:               'cerrada',
    })
    .eq('id', arqueoId)

  if (error) return { error: error.message }
  revalidatePath('/ventas/nueva')
  return {}
}
