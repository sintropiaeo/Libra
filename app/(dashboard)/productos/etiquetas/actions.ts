'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { puedeEditarProductos } from '@/lib/permisos'
import type { Perfil } from '@/lib/permisos'

export type ProductoEtiqueta = {
  tipo:           'producto' | 'presentacion'
  id:             string
  nombre:         string
  precio_venta:   number
  codigo_barras:  string | null
  codigo_interno: string | null
}

async function verificarEditor() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('perfiles').select('*').eq('user_id', user.id).single()
  const perfil = data as Perfil | null
  if (!puedeEditarProductos(perfil)) return null
  return { supabase, negocioId: perfil!.negocio_id }
}

export async function buscarProductosParaEtiquetas(
  q: string
): Promise<ProductoEtiqueta[]> {
  const ctx = await verificarEditor()
  if (!ctx) return []
  const { supabase } = ctx

  const trimmed = q.trim()
  if (!trimmed) return []

  const [prodRes, presPorNombreRes, presPorCodigoRes] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, precio_venta, codigo_barras, codigo_interno')
      .or(`nombre.ilike.%${trimmed}%,codigo_barras.ilike.%${trimmed}%,codigo_interno.ilike.%${trimmed}%`)
      .eq('activo', true)
      .order('nombre')
      .limit(40),
    // Presentaciones cuyo producto padre matchea por nombre
    supabase
      .from('producto_presentaciones')
      .select('id, nombre, precio_venta, codigo_barras, productos!inner ( nombre, activo )')
      .eq('activo', true)
      .eq('productos.activo', true)
      .ilike('productos.nombre', `%${trimmed}%`)
      .limit(40),
    // Presentaciones que matchean por su propio nombre o código
    supabase
      .from('producto_presentaciones')
      .select('id, nombre, precio_venta, codigo_barras, productos!inner ( nombre, activo )')
      .eq('activo', true)
      .eq('productos.activo', true)
      .or(`nombre.ilike.%${trimmed}%,codigo_barras.ilike.%${trimmed}%`)
      .limit(40),
  ])

  const productos: ProductoEtiqueta[] = (prodRes.data ?? []).map((p) => ({
    tipo: 'producto' as const, ...p,
  }))

  // Dedup de presentaciones por id (pueden venir en ambas consultas)
  const presMap = new Map<string, ProductoEtiqueta>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of [...(presPorNombreRes.data ?? []), ...(presPorCodigoRes.data ?? [])] as any[]) {
    if (presMap.has(row.id)) continue
    const prodNombre = row.productos?.nombre ?? ''
    presMap.set(row.id, {
      tipo:           'presentacion',
      id:             row.id,
      nombre:         `${prodNombre} · ${row.nombre}`,
      precio_venta:   Number(row.precio_venta),
      codigo_barras:  row.codigo_barras,
      codigo_interno: null,
    })
  }

  return [...productos, ...Array.from(presMap.values())]
}

export async function guardarCodigoGenerado(
  id: string,
  codigo: string,
  tipo: 'producto' | 'presentacion' = 'producto'
): Promise<{ error?: string }> {
  const ctx = await verificarEditor()
  if (!ctx) return { error: 'Sin permisos.' }
  const { supabase, negocioId } = ctx

  if (tipo === 'presentacion') {
    // Guarda el código generado en la presentación, solo si todavía no tenía uno
    // (aditivo: nunca pisa un código existente).
    const { error } = await supabase
      .from('producto_presentaciones')
      .update({ codigo_barras: codigo })
      .eq('id', id)
      .eq('negocio_id', negocioId)
      .is('codigo_barras', null)
    if (error) {
      if (error.code === '23505')
        return { error: 'Ese código ya existe en otra presentación o producto de este negocio.' }
      return { error: error.message }
    }
    revalidatePath('/productos')
    return {}
  }

  const { error } = await supabase
    .from('productos')
    .update({ codigo_interno: codigo })
    .eq('id', id)
    .eq('negocio_id', negocioId)

  if (error) return { error: error.message }
  revalidatePath('/productos')
  return {}
}
