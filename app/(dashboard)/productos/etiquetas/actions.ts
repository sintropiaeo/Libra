'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { puedeEditarProductos } from '@/lib/permisos'
import type { Perfil } from '@/lib/permisos'

export type ProductoEtiqueta = {
  tipo:           'producto' | 'presentacion'
  id:             string          // id de la fila seleccionada (producto o presentación)
  producto_id:    string          // id del producto BASE (para guardar nombre_etiqueta)
  nombre:         string          // nombre REAL del producto base (nunca se muestra crudo si hay nombre_etiqueta)
  nombre_etiqueta: string | null  // nombre corto opcional para la etiqueta
  precio_venta:   number
  codigo_barras:  string | null
  codigo_interno: string | null
  presentacion_nombre:        string | null
  presentacion_cantidad_base: number | null
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

  const PRES_SELECT =
    'id, nombre, cantidad_base, precio_venta, codigo_barras, productos!inner ( id, nombre, nombre_etiqueta, activo )'

  const [prodRes, presPorNombreRes, presPorCodigoRes] = await Promise.all([
    supabase
      .from('productos')
      .select('id, nombre, nombre_etiqueta, precio_venta, codigo_barras, codigo_interno')
      .or(`nombre.ilike.%${trimmed}%,codigo_barras.ilike.%${trimmed}%,codigo_interno.ilike.%${trimmed}%`)
      .eq('activo', true)
      .order('nombre')
      .limit(40),
    // Presentaciones cuyo producto padre matchea por nombre
    supabase
      .from('producto_presentaciones')
      .select(PRES_SELECT)
      .eq('activo', true)
      .eq('productos.activo', true)
      .ilike('productos.nombre', `%${trimmed}%`)
      .limit(40),
    // Presentaciones que matchean por su propio nombre o código
    supabase
      .from('producto_presentaciones')
      .select(PRES_SELECT)
      .eq('activo', true)
      .eq('productos.activo', true)
      .or(`nombre.ilike.%${trimmed}%,codigo_barras.ilike.%${trimmed}%`)
      .limit(40),
  ])

  const productos: ProductoEtiqueta[] = (prodRes.data ?? []).map((p) => ({
    tipo:                       'producto' as const,
    id:                         p.id,
    producto_id:                p.id,
    nombre:                     p.nombre,
    nombre_etiqueta:            p.nombre_etiqueta ?? null,
    precio_venta:               Number(p.precio_venta),
    codigo_barras:              p.codigo_barras,
    codigo_interno:             p.codigo_interno,
    presentacion_nombre:        null,
    presentacion_cantidad_base: null,
  }))

  // Dedup de presentaciones por id (pueden venir en ambas consultas)
  const presMap = new Map<string, ProductoEtiqueta>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of [...(presPorNombreRes.data ?? []), ...(presPorCodigoRes.data ?? [])] as any[]) {
    if (presMap.has(row.id)) continue
    const prod = row.productos ?? {}
    presMap.set(row.id, {
      tipo:                       'presentacion',
      id:                         row.id,
      producto_id:                prod.id,
      nombre:                     prod.nombre ?? '',
      nombre_etiqueta:            prod.nombre_etiqueta ?? null,
      precio_venta:               Number(row.precio_venta),
      codigo_barras:              row.codigo_barras,
      codigo_interno:             null,
      presentacion_nombre:        row.nombre,
      presentacion_cantidad_base: row.cantidad_base,
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

// Guarda el nombre corto de etiqueta como predeterminado del producto.
// negocio_id se verifica server-side (nunca se confía en el cliente).
export async function guardarNombreEtiqueta(
  productoId: string,
  nombreEtiqueta: string
): Promise<{ error?: string }> {
  const ctx = await verificarEditor()
  if (!ctx) return { error: 'Sin permisos.' }
  const { supabase, negocioId } = ctx

  const valor = nombreEtiqueta.trim()
  const { error } = await supabase
    .from('productos')
    .update({ nombre_etiqueta: valor || null })
    .eq('id', productoId)
    .eq('negocio_id', negocioId)

  if (error) return { error: error.message }
  revalidatePath('/productos')
  return {}
}
