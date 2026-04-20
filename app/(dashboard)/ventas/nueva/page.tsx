import { createClient } from '@/lib/supabase/server'
import PosCliente from '@/components/pos/pos-cliente'

export const metadata = { title: 'Punto de Venta — Libra' }

export default async function NuevaVentaPage() {
  const supabase = createClient()

  const [productosRes, configRes] = await Promise.all([
    supabase
      .from('productos')
      .select(`
        id, nombre, descripcion,
        precio_venta, stock_actual, stock_minimo,
        codigo_barras, unidad, activo,
        categorias ( nombre )
      `)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('negocio_config')
      .select('metodos_pago')
      .limit(1)
      .single(),
  ])

  const metodosActivos: string[] =
    configRes.data?.metodos_pago ?? ['efectivo', 'transferencia', 'debito', 'credito']

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <PosCliente productos={(productosRes.data as any) ?? []} metodosActivos={metodosActivos} />
  )
}
