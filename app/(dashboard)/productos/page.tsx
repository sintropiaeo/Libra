import { createClient } from '@/lib/supabase/server'
import ProductosCliente from '@/components/productos/productos-cliente'

export const metadata = { title: 'Productos — Libra' }

export default async function ProductosPage() {
  const supabase = createClient()

  const [{ data: productosRaw }, { data: categorias }] = await Promise.all([
    supabase
      .from('productos')
      .select(`
        id, nombre, descripcion,
        categoria_id, precio_costo, precio_venta,
        stock_actual, stock_minimo,
        codigo_barras, unidad, activo,
        categorias ( nombre )
      `)
      .order('nombre'),
    supabase
      .from('categorias')
      .select('id, nombre')
      .order('nombre'),
  ])

  return (
    <ProductosCliente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialProductos={(productosRaw as any) ?? []}
      categorias={categorias ?? []}
    />
  )
}
