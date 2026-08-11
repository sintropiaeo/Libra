// Lógica pura de matching y cálculo de precios para el flujo "Actualizar precios".
// Sin dependencias de Supabase: recibe las filas del Excel + los productos del
// negocio (ya scopeados server-side) y clasifica. NO escribe nada.
//
// Reglas acordadas:
// - Match por 3 campos: codigo_barras, codigo_interno, nombre. Se cuenta cuántos
//   coinciden contra el mejor candidato.
//   - 3/3 (y único) -> actualizar automáticamente.
//   - 2/3           -> revisión manual (checkbox, sin marcar por default).
//   - 0-1/3         -> sin match (informativo).
// - "Ambos vacíos = concuerdan": si un campo está vacío en la fila y en el
//   producto, cuenta como coincidencia. Vacío en un solo lado = no coincide.
// - precio_venta: Math.max(redondearPrecio(ventaExcel), ventaActual) — nunca baja.
//   Solo si la fila trae venta (> 0).
// - precio_costo: se pisa directo con el valor del Excel (puede bajar).
//   Solo si la fila trae costo (> 0).

import { redondearPrecio } from './utils'

export type FilaPrecio = {
  nombre:         string
  codigo_barras:  string | null
  codigo_interno: string | null
  precio_venta:   number
  precio_costo:   number
}

export type ProductoPrecio = {
  id:             string
  nombre:         string
  codigo_barras:  string | null
  codigo_interno: string | null
  precio_venta:   number
  precio_costo:   number
}

export type CampoMatch = 'codigo_barras' | 'codigo_interno' | 'nombre'

export type MatchFila = {
  fila:            FilaPrecio
  producto:        ProductoPrecio | null
  coincidencias:   number                         // 0..3 contra el mejor candidato
  camposCoinciden: Record<CampoMatch, boolean>
  campoQueFallo:   CampoMatch | null              // solo relevante en 2/3
  ambiguo:         boolean                         // varios candidatos con el mismo puntaje máximo
  candidatos:      number                          // cantidad de candidatos evaluados
  ventaAnterior:   number | null
  ventaNueva:      number | null                   // null = no se actualiza venta
  costoAnterior:   number | null
  costoNueva:      number | null                   // null = no se actualiza costo
}

export type ResultadoAnalisis = {
  actualizados: MatchFila[]   // 3/3 único
  parciales:    MatchFila[]   // 2/3 (o 3/3 ambiguo, por seguridad)
  sinMatch:     MatchFila[]   // 0-1/3
}

// ─── Normalización ──────────────────────────────────────────────────────────

export function normalizarNombre(s?: string | null): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // saca tildes/diacríticos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizarCodigo(s?: string | null): string {
  return (s ?? '').trim()
}

// Coincidencia de un campo con la regla "ambos vacíos = concuerdan".
function coincide(a: string, b: string): boolean {
  if (a === '' && b === '') return true
  if (a === '' || b === '') return false
  return a === b
}

// ─── Clasificación ──────────────────────────────────────────────────────────

const CAMPOS: CampoMatch[] = ['codigo_barras', 'codigo_interno', 'nombre']

// ─── Matcher compartido (usado por precios y por código interno) ──────────────

export type Indices = {
  porBarras:  Map<string, ProductoPrecio[]>
  porInterno: Map<string, ProductoPrecio[]>
  porNombre:  Map<string, ProductoPrecio[]>
  norm:       Map<string, { b: string; i: string; n: string }>
}

// Índices por valor NO vacío (los candidatos siempre comparten al menos un valor
// real; los "ambos vacíos" se cuentan después, sobre esos candidatos).
export function construirIndices(productos: ProductoPrecio[]): Indices {
  const porBarras  = new Map<string, ProductoPrecio[]>()
  const porInterno = new Map<string, ProductoPrecio[]>()
  const porNombre  = new Map<string, ProductoPrecio[]>()
  const norm       = new Map<string, { b: string; i: string; n: string }>()

  const push = (m: Map<string, ProductoPrecio[]>, k: string, p: ProductoPrecio) => {
    const arr = m.get(k); if (arr) arr.push(p); else m.set(k, [p])
  }

  for (const p of productos) {
    const b = normalizarCodigo(p.codigo_barras)
    const i = normalizarCodigo(p.codigo_interno)
    const n = normalizarNombre(p.nombre)
    norm.set(p.id, { b, i, n })
    if (b) push(porBarras, b, p)
    if (i) push(porInterno, i, p)
    if (n) push(porNombre, n, p)
  }
  return { porBarras, porInterno, porNombre, norm }
}

export type MatchResult = {
  producto:        ProductoPrecio | null
  coincidencias:   number
  camposCoinciden: Record<CampoMatch, boolean>
  campoQueFallo:   CampoMatch | null
  ambiguo:         boolean
  candidatos:      number
}

// Encuentra el mejor candidato para una fila (por los 3 campos, con la regla
// "ambos vacíos = concuerdan"). No aplica lógica de precios ni de códigos.
export function matchearFila(
  fila: { nombre: string; codigo_barras: string | null; codigo_interno: string | null },
  idx: Indices
): MatchResult {
  const fb = normalizarCodigo(fila.codigo_barras)
  const fi = normalizarCodigo(fila.codigo_interno)
  const fn = normalizarNombre(fila.nombre)

  const cand = new Map<string, ProductoPrecio>()
  if (fb) for (const p of idx.porBarras.get(fb)  ?? []) cand.set(p.id, p)
  if (fi) for (const p of idx.porInterno.get(fi) ?? []) cand.set(p.id, p)
  if (fn) for (const p of idx.porNombre.get(fn)  ?? []) cand.set(p.id, p)

  let best: ProductoPrecio | null = null
  let bestCount = -1
  let bestCampos: Record<CampoMatch, boolean> = { codigo_barras: false, codigo_interno: false, nombre: false }
  let empatesEnMax = 0

  for (const p of Array.from(cand.values())) {
    const np = idx.norm.get(p.id)!
    const campos: Record<CampoMatch, boolean> = {
      codigo_barras:  coincide(fb, np.b),
      codigo_interno: coincide(fi, np.i),
      nombre:         coincide(fn, np.n),
    }
    const count = (campos.codigo_barras ? 1 : 0) + (campos.codigo_interno ? 1 : 0) + (campos.nombre ? 1 : 0)
    if (count > bestCount) {
      bestCount = count; best = p; bestCampos = campos; empatesEnMax = 1
    } else if (count === bestCount) {
      empatesEnMax++
    }
  }

  const coincidencias = bestCount < 0 ? 0 : bestCount
  const campoQueFallo = coincidencias === 2 ? (CAMPOS.find((c) => !bestCampos[c]) ?? null) : null
  return {
    producto: best, coincidencias, camposCoinciden: bestCampos,
    campoQueFallo, ambiguo: empatesEnMax > 1, candidatos: cand.size,
  }
}

export function clasificarFilas(
  filas: FilaPrecio[],
  productos: ProductoPrecio[]
): ResultadoAnalisis {
  const idx = construirIndices(productos)
  const res: ResultadoAnalisis = { actualizados: [], parciales: [], sinMatch: [] }

  for (const fila of filas) {
    const m = matchearFila(fila, idx)

    // Sin match suficiente: 0-1/3 (o sin candidatos)
    if (!m.producto || m.coincidencias <= 1) {
      res.sinMatch.push({
        fila, producto: null, coincidencias: m.coincidencias,
        camposCoinciden: { codigo_barras: false, codigo_interno: false, nombre: false },
        campoQueFallo: null, ambiguo: m.ambiguo, candidatos: m.candidatos,
        ventaAnterior: null, ventaNueva: null, costoAnterior: null, costoNueva: null,
      })
      continue
    }

    // Precios propuestos (dry-run)
    const ventaAnterior = m.producto.precio_venta
    const costoAnterior = m.producto.precio_costo
    const ventaNueva = fila.precio_venta > 0 ? Math.max(redondearPrecio(fila.precio_venta), ventaAnterior) : null
    const costoNueva = fila.precio_costo > 0 ? fila.precio_costo : null

    const match: MatchFila = {
      fila, producto: m.producto, coincidencias: m.coincidencias, camposCoinciden: m.camposCoinciden,
      campoQueFallo: m.campoQueFallo, ambiguo: m.ambiguo, candidatos: m.candidatos,
      ventaAnterior, ventaNueva, costoAnterior, costoNueva,
    }

    if (m.coincidencias === 3 && !m.ambiguo) res.actualizados.push(match)
    else                                     res.parciales.push(match)
  }

  return res
}
