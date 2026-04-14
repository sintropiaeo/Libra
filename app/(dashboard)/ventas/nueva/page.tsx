import { createClient } from '@/lib/supabase/server'
import PosCliente from '@/components/pos/pos-cliente'

export const metadata = { title: 'Punto de Venta — Libra' }

export default async function NuevaVentaPage() {
  const supabase = createClient()

  const { data: productosRaw } = await supabase
    .from('productos')
    .select(`
      id, nombre, descripcion,
      precio_venta, stock_actual, stock_minimo,
      codigo_barras, unidad, activo,
      categorias ( nombre )
    `)
    .eq('activo', true)
    .order('nombre')

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <PosCliente productos={(productosRaw as any) ?? []} />
  )
}
