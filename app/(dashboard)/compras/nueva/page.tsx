import { createClient } from '@/lib/supabase/server'
import NuevaCompraCliente from '@/components/compras/nueva-compra-cliente'

export const metadata = { title: 'Nueva Compra — Libra' }

export default async function NuevaCompraPage() {
  const supabase = createClient()

  const [{ data: productosRaw }, { data: proveedoresRaw }] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, precio_costo, stock_actual, unidad, codigo_barras, categorias(nombre)')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
  ])

  return (
    <NuevaCompraCliente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productos={(productosRaw as any) ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      proveedores={(proveedoresRaw as any) ?? []}
    />
  )
}
