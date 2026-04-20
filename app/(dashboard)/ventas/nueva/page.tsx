import { createClient } from '@/lib/supabase/server'
import PosCliente from '@/components/pos/pos-cliente'
import type { ArqueoCaja, VentaTurno } from '@/components/pos/arqueo-tab'

export const metadata = { title: 'Punto de Venta — Libra' }

export default async function NuevaVentaPage() {
  const supabase = createClient()

  // Fetch productos, config y arqueo abierto en paralelo
  const [productosRes, configRes, arqueoRes] = await Promise.all([
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
    />
  )
}
