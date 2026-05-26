import { createClient } from '@/lib/supabase/server'
import ProductosCliente from '@/components/productos/productos-cliente'
import type { Perfil } from '@/lib/permisos'
import { puedeEditarProductos } from '@/lib/permisos'

export const metadata = { title: 'Productos — Libra' }

const PAGE_SIZE = 50

type SortField = 'nombre' | 'updated_at'
type SortDir   = 'asc' | 'desc'

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: { q?: string; cat?: string; p?: string; sort?: string; dir?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const q       = searchParams.q?.trim()   ?? ''
  const cat     = searchParams.cat?.trim() ?? ''
  const page    = Math.max(1, Number(searchParams.p ?? '1'))
  const sort    = (searchParams.sort === 'updated_at' ? 'updated_at' : 'nombre') as SortField
  const dir     = (searchParams.dir  === 'asc'        ? 'asc'        : sort === 'updated_at' ? 'desc' : 'asc') as SortDir
  const from    = (page - 1) * PAGE_SIZE
  const to      = from + PAGE_SIZE - 1

  let query = supabase
    .from('productos')
    .select(`
      id, nombre, descripcion,
      categoria_id, precio_costo, precio_venta,
      stock_actual, stock_minimo,
      codigo_barras, codigo_interno, unidad, activo, permitir_venta_sin_stock,
      updated_at,
      categorias ( nombre )
    `, { count: 'exact' })
    .order(sort, { ascending: dir === 'asc' })
    .range(from, to)

  if (q)   query = query.or(`nombre.ilike.%${q}%,codigo_barras.eq.${q},codigo_interno.ilike.%${q}%`)
  if (cat) query = query.eq('categoria_id', cat)

  const [{ data: productosRaw, count }, { data: categorias }, { data: perfilData }] = await Promise.all([
    query,
    supabase.from('categorias').select('id, nombre').order('nombre'),
    supabase.from('perfiles').select('*').eq('user_id', user!.id).single(),
  ])

  return (
    <ProductosCliente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productos={(productosRaw as any) ?? []}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      categorias={categorias ?? []}
      puedeEditar={puedeEditarProductos(perfilData as Perfil | null)}
      q={q}
      cat={cat}
      sort={sort}
      dir={dir}
    />
  )
}
