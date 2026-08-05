// Helper compartido para armar el texto que va debajo del código de barras en
// las etiquetas. Es la ÚNICA fuente de verdad de ese texto: usarlo en todos los
// lugares donde se arma la etiqueta (server y cliente).
//
// - NUNCA toca `nombre` (se usa para matchear el Excel del proveedor en la
//   importación). Si el producto tiene `nombre_etiqueta`, se usa ese como base;
//   si no, cae al `nombre` completo.
// - Para una presentación agrega el sufijo (nombre de la presentación, ej.
//   "Caja x100"; si no hubiera, cae a `x{cantidad_base}`).

export type EtiquetaProducto = {
  nombre:          string
  nombre_etiqueta?: string | null
}

export type EtiquetaPresentacion = {
  nombre?:        string | null
  cantidad_base?: number | null
}

export function getTextoEtiqueta(
  producto: EtiquetaProducto,
  presentacion?: EtiquetaPresentacion | null
): string {
  const base = producto.nombre_etiqueta?.trim() || producto.nombre
  if (!presentacion) return base
  const sufijo =
    presentacion.nombre?.trim() ||
    (presentacion.cantidad_base != null ? `x${presentacion.cantidad_base}` : '')
  return `${base} ${sufijo}`.trim()
}

// Cantidad de caracteres que entran cómodos en 2 líneas al tamaño base de la
// etiqueta de 50mm. Por encima de esto, en vez de truncar con "…" se reduce el
// tamaño de fuente (ver fontSizeEtiqueta), y solo como último recurso el CSS
// recorta a 2 líneas.
export const LIMITE_ETIQUETA = 40

// Reduce el tamaño de fuente para textos largos, hasta un mínimo legible.
// base/min en pt. Devuelve pt (número).
export function fontSizeEtiqueta(texto: string, base: number, min: number): number {
  const extra = texto.trim().length - LIMITE_ETIQUETA
  if (extra <= 0) return base
  // -0.5pt por cada 8 caracteres de más, con piso en `min`.
  const reducido = base - Math.ceil(extra / 8) * 0.5
  return Math.max(min, Math.round(reducido * 2) / 2)
}
