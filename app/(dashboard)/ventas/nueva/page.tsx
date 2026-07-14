import { createClient } from '@/lib/supabase/server'
import PosCliente from '@/components/pos/pos-cliente'
import type { ArqueoCaja, VentaTurno } from '@/components/pos/arqueo-tab'
import type { VentaHoy } from '@/components/pos/pos-cliente'
import type { ConfiguracionTicket } from '@/lib/permisos'

export const metadata = { title: 'Punto de Venta — Libra' }

export default async function NuevaVentaPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfilRol } = user
    ? await supabase.from('perfiles').select('rol').eq('user_id', user.id).single()
    : { data: null }
  const esAdminUser = perfilRol?.rol === 'admin' || perfilRol?.rol === 'super_admin'

  // Inicio del día de hoy en Argentina (UTC-3, sin DST)
  const hoyLocal    = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const hoyStartUTC = new Date(`${hoyLocal}T03:00:00.000Z`)

  // IDs de categorías "Servicios" para el panel de servicios
  const { data: catServ } = await supabase
    .from('categorias')
    .select('id')
    .ilike('nombre', 'servicio%')
  const catIds = catServ?.map((c) => c.id) ?? []

  // Fetch en paralelo: servicios, config, arqueo, ventas de hoy, config de tickets y favoritos
  const [serviciosRes, configRes, arqueoRes, ventasHoyRes, configTicketRes, favoritosRes] = await Promise.all([
    catIds.length > 0
      ? supabase
          .from('productos')
          .select(`
            id, nombre, descripcion,
            precio_venta, stock_actual, stock_minimo,
            codigo_barras, unidad, permitir_venta_sin_stock,
            es_favorito, categorias ( nombre )
          `)
          .eq('activo', true)
          .in('categoria_id', catIds)
          .order('nombre')
      : Promise.resolve({ data: [] }),
    supabase
      .from('negocio_config')
      .select('nombre, metodos_pago, imprimir_ticket_auto, tamano_ticket, sonido_escaneo')
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
        id, numero_venta, fecha, total, metodo_pago,
        venta_items (
          id, cantidad, precio_unitario, subtotal,
          productos ( nombre, unidad )
        )
      `)
      .gte('fecha', hoyStartUTC.toISOString())
      .order('fecha', { ascending: false })
      .limit(100),
    supabase
      .from('configuracion_ticket')
      .select('*')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('productos')
      .select(`
        id, nombre, descripcion,
        precio_venta, stock_actual, stock_minimo,
        codigo_barras, codigo_interno, unidad, permitir_venta_sin_stock,
        es_favorito, categorias ( nombre )
      `)
      .eq('activo', true)
      .eq('es_favorito', true)
      .order('nombre'),
  ])

  const arqueoAbierto = (arqueoRes.data ?? null) as ArqueoCaja | null
  const metodosActivos: string[] =
    configRes.data?.metodos_pago ?? ['efectivo', 'transferencia', 'debito', 'credito']
  const negocioNombre:      string          = configRes.data?.nombre               ?? ''
  const imprimirTicketAuto: boolean         = configRes.data?.imprimir_ticket_auto ?? false
  const tamanoTicket:       '58mm' | '80mm' = (configRes.data?.tamano_ticket as '58mm' | '80mm') ?? '80mm'
  const sonidoEscaneo:      boolean         = configRes.data?.sonido_escaneo       ?? false

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
      servicios={(serviciosRes.data as any) ?? []}
      metodosActivos={metodosActivos}
      esAdmin={esAdminUser}
      arqueoAbierto={arqueoAbierto}
      ventasTurnoInicial={ventasTurnoInicial}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      historialArqueos={(historialRaw as any) ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ventasHoyInicial={(ventasHoyRes.data as any) ?? [] as VentaHoy[]}
      negocioNombre={negocioNombre}
      imprimirTicketAuto={imprimirTicketAuto}
      tamanoTicket={tamanoTicket}
      sonidoEscaneo={sonidoEscaneo}
      configTicket={(configTicketRes.data as ConfiguracionTicket | null)}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      favoritosIniciales={(favoritosRes.data as any) ?? []}
    />
  )
}
