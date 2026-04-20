import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReportesCliente from '@/components/reportes/reportes-cliente'
import type { Perfil } from '@/lib/permisos'
import { tieneAcceso } from '@/lib/permisos'

export const metadata = { title: 'Reportes — Libra' }

export default async function ReportesPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfilData } = await supabase
    .from('perfiles').select('*').eq('user_id', user.id).single()
  if (!tieneAcceso(perfilData as Perfil | null, 'reportes')) redirect('/ventas/nueva')

  // Traemos el último año de ventas con items y costo de productos
  const fechaDesde = new Date()
  fechaDesde.setFullYear(fechaDesde.getFullYear() - 1)
  fechaDesde.setHours(0, 0, 0, 0)

  const { data: ventasRaw } = await supabase
    .from('ventas')
    .select(`
      id, fecha, total, metodo_pago,
      venta_items (
        cantidad, precio_unitario, subtotal,
        productos ( id, nombre, precio_costo )
      )
    `)
    .gte('fecha', fechaDesde.toISOString())
    .order('fecha', { ascending: true })

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ReportesCliente ventas={(ventasRaw as any) ?? []} />
  )
}
