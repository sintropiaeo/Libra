'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { puedeEditarProductos } from '@/lib/permisos'
import type { Perfil } from '@/lib/permisos'
import { redondearPrecio } from '@/lib/utils'
import { clasificarFilas, type FilaPrecio, type ProductoPrecio, type ResultadoAnalisis } from '@/lib/precios-match'

async function verificarEditor() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('perfiles').select('*').eq('user_id', user.id).single()
  const perfil = data as Perfil | null
  if (!puedeEditarProductos(perfil)) return null
  return { supabase, negocioId: perfil!.negocio_id }
}

// Trae TODOS los productos activos del negocio (paginado), scopeado server-side.
// La RLS de productos es USING(true), así que el filtro por negocio_id es
// obligatorio acá (no lo hace la base).
async function traerProductosDelNegocio(
  supabase: ReturnType<typeof createClient>,
  negocioId: string
): Promise<{ productos?: ProductoPrecio[]; error?: string }> {
  const productos: ProductoPrecio[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, codigo_barras, codigo_interno, precio_venta, precio_costo')
      .eq('negocio_id', negocioId)
      .eq('activo', true)
      .range(from, from + size - 1)
    if (error) return { error: error.message }
    if (!data || data.length === 0) break
    for (const d of data) {
      productos.push({
        id:             d.id,
        nombre:         d.nombre,
        codigo_barras:  d.codigo_barras,
        codigo_interno: d.codigo_interno,
        precio_venta:   Number(d.precio_venta),
        precio_costo:   Number(d.precio_costo),
      })
    }
    if (data.length < size) break
  }
  return { productos }
}

// Devuelve el catálogo del negocio (scopeado server-side) para hacer el match
// en el navegador. Evita mandar decenas de miles de filas del Excel al server
// (límite de 1MB de los server actions).
export type CatalogoResponse = { error: string } | { productos: ProductoPrecio[] }

export async function traerCatalogoPrecios(): Promise<CatalogoResponse> {
  const ctx = await verificarEditor()
  if (!ctx) return { error: 'Sin permisos.' }
  const { supabase, negocioId } = ctx
  const { productos, error } = await traerProductosDelNegocio(supabase, negocioId)
  if (error) return { error }
  return { productos: productos! }
}

export type AnalisisResponse =
  | { error: string }
  | (ResultadoAnalisis & { totalProductos: number; totalFilas: number })

// DRY-RUN: clasifica las filas del Excel contra el catálogo del negocio.
// No escribe absolutamente nada en la base.
export async function analizarActualizacionPrecios(
  filas: FilaPrecio[]
): Promise<AnalisisResponse> {
  const ctx = await verificarEditor()
  if (!ctx) return { error: 'Sin permisos.' }
  const { supabase, negocioId } = ctx

  if (!Array.isArray(filas) || filas.length === 0) {
    return { error: 'No hay filas para analizar.' }
  }

  const { productos, error } = await traerProductosDelNegocio(supabase, negocioId)
  if (error) return { error }

  const resultado = clasificarFilas(filas, productos!)
  return { ...resultado, totalProductos: productos!.length, totalFilas: filas.length }
}

// ─── Aplicar (escritura) ──────────────────────────────────────────────────────

// El cliente manda el id del producto + los precios CRUDOS del Excel. El server
// recalcula (nunca confía en números del cliente): venta = max(redondeo, actual)
// y costo directo, y actualiza SOLO precio_venta/precio_costo del negocio.
export type CambioPrecio = {
  producto_id:        string
  precio_venta_excel: number   // 0 = no actualizar venta
  precio_costo_excel: number   // 0 = no actualizar costo
}

export type AplicarResponse =
  | { error: string }
  | { actualizados: number; sinCambios: number; noEncontrados: number; errores: { producto_id: string; error: string }[] }

const CHUNK = 25

export async function aplicarActualizacionPrecios(
  cambios: CambioPrecio[]
): Promise<AplicarResponse> {
  const ctx = await verificarEditor()
  if (!ctx) return { error: 'Sin permisos.' }
  const { supabase, negocioId } = ctx

  if (!Array.isArray(cambios) || cambios.length === 0) {
    return { error: 'No hay cambios para aplicar.' }
  }

  // Dedup por producto_id (último gana)
  const porId = new Map<string, CambioPrecio>()
  for (const c of cambios) if (c?.producto_id) porId.set(c.producto_id, c)
  const ids = Array.from(porId.keys())

  // Traer precios actuales de los productos objetivo, scopeados por negocio
  // (fuente de verdad; y confirma pertenencia). Chunk por límite de URL en .in().
  const actuales = new Map<string, { venta: number; costo: number }>()
  for (let i = 0; i < ids.length; i += 500) {
    const slice = ids.slice(i, i + 500)
    const { data, error } = await supabase
      .from('productos')
      .select('id, precio_venta, precio_costo')
      .eq('negocio_id', negocioId)
      .in('id', slice)
    if (error) return { error: error.message }
    for (const p of data ?? []) actuales.set(p.id, { venta: Number(p.precio_venta), costo: Number(p.precio_costo) })
  }

  // Armar los updates recalculando server-side; saltar los que no cambian
  type Tarea = { id: string; update: { precio_venta?: number; precio_costo?: number } }
  const tareas: Tarea[] = []
  let sinCambios    = 0
  let noEncontrados = 0

  for (const id of ids) {
    const actual = actuales.get(id)
    if (!actual) { noEncontrados++; continue }   // no pertenece al negocio o no existe
    const c = porId.get(id)!
    const update: { precio_venta?: number; precio_costo?: number } = {}

    if (c.precio_venta_excel > 0) {
      const nueva = Math.max(redondearPrecio(c.precio_venta_excel), actual.venta)
      if (nueva !== actual.venta) update.precio_venta = nueva
    }
    if (c.precio_costo_excel > 0 && c.precio_costo_excel !== actual.costo) {
      update.precio_costo = c.precio_costo_excel
    }

    if (Object.keys(update).length === 0) sinCambios++
    else tareas.push({ id, update })
  }

  // Ejecutar en tandas paralelas (updated_at lo pone el trigger)
  let actualizados = 0
  const errores: { producto_id: string; error: string }[] = []
  for (let i = 0; i < tareas.length; i += CHUNK) {
    const slice = tareas.slice(i, i + CHUNK)
    const results = await Promise.all(
      slice.map((t) =>
        supabase.from('productos').update(t.update).eq('id', t.id).eq('negocio_id', negocioId)
          .then(({ error }) => ({ id: t.id, error }))
      )
    )
    for (const r of results) {
      if (r.error) errores.push({ producto_id: r.id, error: r.error.message })
      else actualizados++
    }
  }

  revalidatePath('/productos')
  return { actualizados, sinCambios, noEncontrados, errores }
}
