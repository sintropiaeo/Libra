import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { tieneAcceso } from '@/lib/permisos'
import type { Perfil, ConfiguracionTicket } from '@/lib/permisos'
import ComprobantesCliente from '@/components/comprobantes/comprobantes-cliente'

export const metadata = { title: 'Comprobantes — Libra' }

export default async function ComprobantesPage({
  searchParams,
}: {
  searchParams: { tipo?: string; desde?: string; hasta?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfilData } = await supabase
    .from('perfiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!tieneAcceso(perfilData as Perfil | null, 'ventas')) redirect('/dashboard')

  const tipo  = searchParams.tipo  ?? 'factura_x'
  const desde = searchParams.desde ?? null
  const hasta = searchParams.hasta ?? null

  let query = supabase
    .from('ventas')
    .select('id, numero_venta, fecha, total, metodo_pago, tipo_comprobante, numero_comprobante, datos_cliente')
    .order('fecha', { ascending: false })
    .limit(200)

  if (tipo === 'todos') {
    query = query.neq('tipo_comprobante', 'ticket')
  } else {
    query = query.eq('tipo_comprobante', tipo)
  }

  if (desde) query = query.gte('fecha', new Date(desde).toISOString())
  if (hasta) {
    const hastaFin = new Date(hasta)
    hastaFin.setHours(23, 59, 59, 999)
    query = query.lte('fecha', hastaFin.toISOString())
  }

  const [{ data: comprobantes }, configRes, negocioRes] = await Promise.all([
    query,
    supabase.from('configuracion_ticket').select('*').limit(1).maybeSingle(),
    supabase.from('negocio_config').select('nombre, tamano_ticket').limit(1).single(),
  ])

  return (
    <ComprobantesCliente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      comprobantes={(comprobantes as any) ?? []}
      configTicket={(configRes.data as ConfiguracionTicket | null)}
      negocioNombre={negocioRes.data?.nombre ?? ''}
      tamanoTicket={(negocioRes.data?.tamano_ticket as '58mm' | '80mm') ?? '80mm'}
      tipoFiltroInicial={tipo}
      desdeFiltroInicial={desde}
      hastaFiltroInicial={hasta}
    />
  )
}
