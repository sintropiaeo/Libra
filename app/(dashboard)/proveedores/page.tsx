import { createClient } from '@/lib/supabase/server'
import ProveedoresCliente from '@/components/proveedores/proveedores-cliente'

export const metadata = { title: 'Proveedores — Libra' }

export default async function ProveedoresPage() {
  const supabase = createClient()

  const { data: proveedoresRaw } = await supabase
    .from('proveedores')
    .select('id, nombre, telefono, email, direccion, notas, activo, created_at')
    .order('nombre')

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <ProveedoresCliente initialProveedores={(proveedoresRaw as any) ?? []} />
  )
}
