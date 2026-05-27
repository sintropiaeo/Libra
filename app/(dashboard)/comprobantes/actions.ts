'use server'

import { createClient } from '@/lib/supabase/server'

export async function obtenerVentaDetalle(ventaId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('ventas')
    .select(`
      id, numero_venta, fecha, total, metodo_pago,
      tipo_comprobante, numero_comprobante, datos_cliente,
      venta_items (
        cantidad, precio_unitario,
        productos ( nombre, unidad )
      )
    `)
    .eq('id', ventaId)
    .single()

  return data
}
