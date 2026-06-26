'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { puedeEditarProductos } from '@/lib/permisos'
import type { Perfil } from '@/lib/permisos'

export type ProductoEtiqueta = {
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

  const { data } = await supabase
    .from('productos')
    .select('id, nombre, precio_venta, codigo_barras, codigo_interno')
    .or(`nombre.ilike.%${trimmed}%,codigo_barras.ilike.%${trimmed}%,codigo_interno.ilike.%${trimmed}%`)
    .eq('activo', true)
    .order('nombre')
    .limit(40)

  return (data ?? []) as ProductoEtiqueta[]
}

export async function guardarCodigoGenerado(
  id: string,
  codigo: string
): Promise<{ error?: string }> {
  const ctx = await verificarEditor()
  if (!ctx) return { error: 'Sin permisos.' }
  const { supabase } = ctx

  const { error } = await supabase
    .from('productos')
    .update({ codigo_barras: codigo })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/productos')
  return {}
}
