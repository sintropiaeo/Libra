import { createClient } from '@/lib/supabase/server'
import PosCliente from '@/components/pos/pos-cliente'
import type { ArqueoCaja, VentaTurno } from '@/components/pos/arqueo-tab'
import type { VentaHoy } from '@/components/pos/pos-cliente'

export const metadata = { title: 'Punto de Venta — Libra' }

export default async function NuevaVentaPage() {
  const supabase = createClient()

  // Inicio del día de hoy en Argentina (UTC-3, sin DST)
  const hoyLocal    = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const hoyStartUTC = new Date(`${hoyLocal}T03:00:00.000Z`)

  // Fetch productos, config, arqueo y ventas de hoy en paralelo
  const [productosRes, configRes, arqueoRes, ventasHoyRes] = await Promise.all([
    supabase
      .from('productos')
      .select(`
        id, nombre, descripcion,
        precio_venta, stock_actual, stock_minimo,
        codigo_barras, unidad, activo,
        categorias ( nombre )
      `)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('negocio_config')
      .select('metodos_pago')
      .limit(1)
      .single(),
    supabase
      .from('arqueos_caja')
      .select('*')
      .eq('estado', 'abierta')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ventas')
      .select(`
        id, fecha, total, metodo_pago,
        venta_items (
          id, cantidad, precio_unitario, subtotal,
          productos ( nombre, unidad )
        )
      `)
      .gte('fecha', hoyStartUTC.toISOString())
      .order('fecha', { ascending: false })
      .limit(100),
  ])

  const arqueoAbierto = (arqueoRes.data ?? null) as ArqueoCaja | null
  const metodosActivos: string[] =
    configRes.data?.metodos_pago ?? ['efectivo', 'transferencia', 'debito', 'credito']

  // Ventas del turno actual (desde la apertura de caja)
  let ventasTurnoInicial: VentaTurno[] = []
  if (arqueoAbierto) {
    const { data: ventasRaw } = await supabase
      .from('ventas')
      .select('total, metodo_pago')
      .gte('fecha', arqueoAbierto.fecha_apertura)

    ventasTurnoInicial = (ventasRaw ?? []).map((v) => ({
      total:       Number(v.total),
      metodo_pago: v.metodo_pago as string,
    }))
  }

  // Historial de arqueos cerrados (últimos 20)
  const { data: historialRaw } = await supabase
    .from('arqueos_caja')
    .select('*')
    .eq('estado', 'cerrada')
    .order('fecha_cierre', { ascending: false })
    .limit(20)

  return (
    <PosCliente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productos={(productosRes.data as any) ?? []}
      metodosActivos={metodosActivos}
      arqueoAbierto={arqueoAbierto}
      ventasTurnoInicial={ventasTurnoInicial}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      historialArqueos={(historialRaw as any) ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ventasHoyInicial={(ventasHoyRes.data as any) ?? [] as VentaHoy[]}
    />
  )
}
