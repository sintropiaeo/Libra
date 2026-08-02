import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NuevaCompraCliente from '@/components/compras/nueva-compra-cliente'
import type { Perfil } from '@/lib/permisos'
import { puedeRegistrarCompras } from '@/lib/permisos'

export const metadata = { title: 'Nueva Compra — Libra' }

export default async function NuevaCompraPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfilData } = await supabase
    .from('perfiles').select('*').eq('user_id', user.id).single()
  if (!puedeRegistrarCompras(perfilData as Perfil | null)) redirect('/compras')

  const [{ data: productosRaw }, { data: proveedoresRaw }] = await Promise.all([
    supabase
      .from('productos')
      .select(`
        id, nombre, precio_costo, stock_actual, unidad, codigo_barras, categorias(nombre),
        producto_presentaciones ( id, nombre, cantidad_base, codigo_barras, activo )
      `)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('proveedores')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
  ])

  // Normaliza producto_presentaciones -> presentaciones (solo activas, ordenadas por cantidad_base)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productos = ((productosRaw as any[]) ?? []).map((p) => {
    const presentaciones = (p.producto_presentaciones ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((x: any) => x.activo)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((x: any) => ({
        id: x.id, nombre: x.nombre, cantidad_base: x.cantidad_base, codigo_barras: x.codigo_barras,
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.cantidad_base - b.cantidad_base)
    const { producto_presentaciones, ...rest } = p
    void producto_presentaciones
    return { ...rest, presentaciones }
  })

  return (
    <NuevaCompraCliente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productos={productos as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      proveedores={(proveedoresRaw as any) ?? []}
    />
  )
}
