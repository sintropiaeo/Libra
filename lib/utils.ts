export function redondearPrecio(precio: number): number {
  return Math.ceil(precio / 100) * 100
}
