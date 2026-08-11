'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { puedeEditarProductos } from '@/lib/permisos'
import type { Perfil } from '@/lib/permisos'

async function verificarEditor() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('perfiles').select('*').eq('user_id', user.id).single()
  const perfil = data as Perfil | null
  if (!puedeEditarProductos(perfil)) return null
  return { supabase, negocioId: perfil!.negocio_id }
}

export type CambioCodigo = { producto_id: string; codigo_interno: string }

export type AplicarCodigoResponse =
  | { error: string }
  | {
      rellenados: number
      omitidos:   number   // el UPDATE no matcheó (ya tenía código / no es del negocio)
      conflictos: { producto_id: string; codigo: string }[]   // el código ya existe en otro producto
      errores:    { producto_id: string; error: string }[]
    }

const CHUNK = 25

// Rellena SOLO codigo_interno donde está en NULL (guarda .is null: nunca pisa uno
// existente). Scopeado por negocio_id. Maneja el UNIQUE(negocio_id, codigo_interno)
// como conflicto (el código ya está en otro producto).
export async function aplicarCodigoInterno(
  cambios: CambioCodigo[]
): Promise<AplicarCodigoResponse> {
  const ctx = await verificarEditor()
  if (!ctx) return { error: 'Sin permisos.' }
  const { supabase, negocioId } = ctx

  // Dedup por producto_id (primero gana); ignora vacíos
  const porId = new Map<string, string>()
  for (const c of cambios) {
    const cod = c?.codigo_interno?.trim()
    if (c?.producto_id && cod && !porId.has(c.producto_id)) porId.set(c.producto_id, cod)
  }
  const tareas = Array.from(porId.entries()).map(([id, codigo]) => ({ id, codigo }))
  if (tareas.length === 0) return { error: 'No hay códigos para cargar.' }

  let rellenados = 0
  let omitidos   = 0
  const conflictos: { producto_id: string; codigo: string }[] = []
  const errores:    { producto_id: string; error: string }[]  = []

  for (let i = 0; i < tareas.length; i += CHUNK) {
    const slice = tareas.slice(i, i + CHUNK)
    const results = await Promise.all(
      slice.map((t) =>
        supabase
          .from('productos')
          .update({ codigo_interno: t.codigo })
          .eq('id', t.id)
          .eq('negocio_id', negocioId)
          .is('codigo_interno', null)   // solo rellenar vacíos, nunca pisar
          .select('id')
          .then(({ data, error }) => ({ id: t.id, codigo: t.codigo, data, error }))
      )
    )
    for (const r of results) {
      if (r.error) {
        if (r.error.code === '23505') conflictos.push({ producto_id: r.id, codigo: r.codigo })
        else                          errores.push({ producto_id: r.id, error: r.error.message })
      } else if (!r.data || r.data.length === 0) {
        omitidos++   // el guard .is null lo saltó (ya tenía código) o no es del negocio
      } else {
        rellenados++
      }
    }
  }

  revalidatePath('/productos')
  return { rellenados, omitidos, conflictos, errores }
}
