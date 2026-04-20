import { createClient } from '@/lib/supabase/server'
import ProductosCliente from '@/components/productos/productos-cliente'
import type { Perfil } from '@/lib/permisos'
import { puedeEditarProductos } from '@/lib/permisos'

export const metadata = { title: 'Productos — Libra' }

export default async function ProductosPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: productosRaw }, { data: categorias }, { data: perfilData }] = await Promise.all([
    supabase
      .from('productos')
      .select(`
        id, nombre, descripcion,
        categoria_id, precio_costo, precio_venta,
        stock_actual, stock_minimo,
        codigo_barras, unidad, activo, permitir_venta_sin_stock,
        categorias ( nombre )
      `)
      .order('nombre'),
    supabase
      .from('categorias')
      .select('id, nombre')
      .order('nombre'),
    supabase
      .from('perfiles')
      .select('*')
      .eq('user_id', user!.id)
      .single(),
  ])

  return (
    <ProductosCliente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialProductos={(productosRaw as any) ?? []}
      categorias={categorias ?? []}
      puedeEditar={puedeEditarProductos(perfilData as Perfil | null)}
    />
  )
}
