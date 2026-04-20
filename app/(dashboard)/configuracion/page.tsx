import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfigCliente from '@/components/configuracion/config-cliente'
import type { Perfil, NegocioConfig } from '@/lib/permisos'

export const metadata = { title: 'Configuración — Libra' }

export default async function ConfiguracionPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Solo admins pueden ver esta página
  const { data: perfilData } = await supabase
    .from('perfiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const perfil = perfilData as Perfil | null
  if (perfil?.rol !== 'admin') redirect('/dashboard')

  // Cargar todos los datos necesarios en paralelo
  const [empleadosRes, negocioRes, categoriasRes] = await Promise.all([
    supabase
      .from('perfiles')
      .select('*')
      .order('created_at', { ascending: true }),
    supabase.from('negocio_config').select('*').limit(1).single(),
    supabase.from('categorias').select('*').order('nombre', { ascending: true }),
  ])

  return (
    <ConfigCliente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      empleados={(empleadosRes.data ?? []) as any}
      negocio={(negocioRes.data ?? null) as NegocioConfig | null}
      categorias={categoriasRes.data ?? []}
      adminId={perfil.id}
    />
  )
}
