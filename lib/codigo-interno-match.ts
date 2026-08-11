// Clasificador para el flujo "Cargar código interno": usa el SKU del proveedor
// (columna codigo_interno del Excel) para RELLENAR el codigo_interno de productos
// que hoy lo tienen vacío. Reusa el matcher compartido de precios-match.
//
// Alcance acordado:
// - SOLO rellena vacíos: nunca pisa un codigo_interno existente.
// - Match confiable = 2/3 (barras + nombre coinciden) con el interno vacío en
//   Libra. Como el interno de Libra está vacío y el del Excel no, nunca llega a
//   3/3, así que el match fuerte es exactamente ese caso.
// - Ambiguo (varios candidatos con el mismo puntaje) va a un costado: por la
//   restricción UNIQUE(negocio_id, codigo_interno) el código solo puede ir a UNO,
//   así que no se resuelve en masa.

import {
  construirIndices,
  matchearFila,
  normalizarCodigo,
  type ProductoPrecio,
} from './precios-match'

export type FilaCodigo = {
  nombre:         string
  codigo_barras:  string | null
  codigo_interno: string | null   // el SKU del proveedor a cargar
}

export type MatchCodigo = {
  fila:          FilaCodigo
  producto:      ProductoPrecio    // producto de Libra a rellenar
  codigoNuevo:   string            // codigo_interno del Excel (normalizado)
  coincidencias: number
  candidatos:    number
}

export type ResultadoCodigo = {
  paraRellenar: MatchCodigo[]      // match único y confiable, interno vacío -> se puede rellenar
  ambiguos:     MatchCodigo[]      // igual pero varios candidatos -> revisión aparte, no se toca
  omitidos:     number             // sin SKU en el Excel, sin match confiable, o el producto ya tiene código
}

export function clasificarCodigoInterno(
  filas: FilaCodigo[],
  productos: ProductoPrecio[]
): ResultadoCodigo {
  const idx = construirIndices(productos)
  const res: ResultadoCodigo = { paraRellenar: [], ambiguos: [], omitidos: 0 }

  for (const fila of filas) {
    const codigoNuevo = normalizarCodigo(fila.codigo_interno)
    if (!codigoNuevo) { res.omitidos++; continue }               // el Excel no trae SKU

    const m = matchearFila(fila, idx)
    if (!m.producto || m.coincidencias < 2) { res.omitidos++; continue }  // sin match confiable (barras+nombre)

    // Solo rellenar vacíos: si ya tiene código interno, no se toca.
    if (normalizarCodigo(m.producto.codigo_interno) !== '') { res.omitidos++; continue }

    const item: MatchCodigo = {
      fila, producto: m.producto, codigoNuevo,
      coincidencias: m.coincidencias, candidatos: m.candidatos,
    }
    if (m.ambiguo) res.ambiguos.push(item)
    else           res.paraRellenar.push(item)
  }

  return res
}
