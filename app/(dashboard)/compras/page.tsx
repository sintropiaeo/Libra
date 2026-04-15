import { createClient } from '@/lib/supabase/server'
import HistorialComprasCliente from '@/components/compras/historial-cliente'

export const metadata = { title: 'Compras — Libra' }

export default async function ComprasPage() {
  const supabase = createClient()

  const [{ data: comprasRaw }, { data: proveedoresRaw }] = await Promise.all([
    supabase
      .from('compras_proveedor')
      .select('id, fecha, total, notas, proveedores(id, nombre)')
      .order('fecha', { ascending: false })
      .limit(500),
    supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
  ])

  return (
    <HistorialComprasCliente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialCompras={(comprasRaw as any) ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      proveedores={(proveedoresRaw as any) ?? []}
    />
  )
}
