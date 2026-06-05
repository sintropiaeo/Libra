import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Auth ─────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const auth   = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

// ─── Tipos ────────────────────────────────────────────────────────────────

type VentaInsert = {
  id:               string
  fecha:            string
  total:            number
  metodo_pago:      string
  tipo_comprobante: string
  negocio_id:       string
}

type ItemInsert = {
  venta_id:        string
  producto_id:     string
  cantidad:        number
  precio_unitario: number
  negocio_id:      string
}

type ProductoRow = {
  id:           string
  precio_venta: number
}

// ─── Generador de ventas ficticias ────────────────────────────────────────

function generarVentasFicticias(
  productos: ProductoRow[],
  negocioId: string,
  diasAtras = 3,
): { ventas: VentaInsert[]; items: ItemInsert[] } {
  const ventas: VentaInsert[] = []
  const items:  ItemInsert[]  = []
  const metodos = ['efectivo','efectivo','efectivo','efectivo','efectivo','efectivo','transferencia','transferencia','transferencia','debito']

  for (let d = diasAtras; d >= 0; d--) {
    const dia = new Date()
    dia.setDate(dia.getDate() - d)
    dia.setHours(0, 0, 0, 0)

    const numVentas = 6 + ((d * 7 + 3) % 5)

    for (let j = 0; j < numVentas; j++) {
      const metodo   = metodos[(d * 13 + j * 7) % metodos.length]
      const fecha    = new Date(dia)
      fecha.setHours(9 + ((d * 3 + j * 2) % 10), (d + j * 5) % 60)

      const ventaId  = crypto.randomUUID()
      let   total    = 0
      const numItems = 1 + ((d + j * 3) % 4)

      for (let k = 0; k < numItems; k++) {
        const prod = productos[(d * 11 + j * 7 + k * 5) % productos.length]
        const qty  = prod.precio_venta <= 200
          ? 5  + ((d + j + k) % 16)
          : 1  + ((d * 3 + j + k) % 3)

        items.push({
          venta_id:        ventaId,
          producto_id:     prod.id,
          cantidad:        qty,
          precio_unitario: prod.precio_venta,
          negocio_id:      negocioId,
        })
        total += prod.precio_venta * qty
      }

      ventas.push({
        id:               ventaId,
        fecha:            fecha.toISOString(),
        total,
        metodo_pago:      metodo,
        tipo_comprobante: 'ticket',
        negocio_id:       negocioId,
      })
    }
  }

  return { ventas, items }
}

// ─── Handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase       = createAdminClient()
  const resetAt        = new Date().toISOString()
  const tablasCleaned: string[] = []

  try {
    // 1. Negocio demo
    const { data: negocio, error: negErr } = await supabase
      .from('negocios')
      .select('id, nombre')
      .eq('is_demo', true)
      .single()

    if (negErr || !negocio) {
      return NextResponse.json(
        { error: 'Negocio demo no encontrado. Ejecutar seed-demo.sql primero.' },
        { status: 404 }
      )
    }

    const negocioId = negocio.id as string

    // 2. Borrar venta_items
    const { error: e1 } = await supabase
      .from('venta_items').delete().eq('negocio_id', negocioId)
    if (e1) throw new Error(`venta_items: ${e1.message}`)
    tablasCleaned.push('venta_items')

    // 3. Borrar ventas
    const { error: e2 } = await supabase
      .from('ventas').delete().eq('negocio_id', negocioId)
    if (e2) throw new Error(`ventas: ${e2.message}`)
    tablasCleaned.push('ventas')

    // 4. Restaurar stock via SQL raw (la función existe en migration_demo.sql)
    const { error: e3 } = await supabase.rpc('demo_reset_stock', { p_negocio_id: negocioId })
    if (e3) {
      // Fallback manual si la función RPC no fue creada
      console.warn('[demo:reset] RPC demo_reset_stock no disponible, usando update manual')
      const { data: prods } = await supabase
        .from('productos')
        .select('id, stock_inicial')
        .eq('negocio_id', negocioId)
        .not('stock_inicial', 'is', null)

      if (prods) {
        for (const p of prods) {
          await supabase.from('productos')
            .update({ stock_actual: p.stock_inicial })
            .eq('id', p.id)
        }
      }
    }
    tablasCleaned.push('productos (stock restaurado a stock_inicial)')

    // 5. Productos activos para generar ventas
    const { data: productos, error: e4 } = await supabase
      .from('productos')
      .select('id, precio_venta')
      .eq('negocio_id', negocioId)
      .eq('activo', true)
      .order('es_favorito', { ascending: false })

    if (e4 || !productos?.length) {
      throw new Error('No se encontraron productos activos en el negocio demo.')
    }

    // 6. Generar 3 días de ventas frescas
    const { ventas, items } = generarVentasFicticias(productos, negocioId, 3)

    const { error: e5 } = await supabase.from('ventas').insert(ventas as never)
    if (e5) throw new Error(`insertar ventas: ${e5.message}`)

    const { error: e6 } = await supabase.from('venta_items').insert(items as never)
    if (e6) throw new Error(`insertar venta_items: ${e6.message}`)

    tablasCleaned.push(`ventas (${ventas.length} regeneradas)`, `venta_items (${items.length} regenerados)`)

    return NextResponse.json({
      success:          true,
      negocio:          negocio.nombre,
      reset_at:         resetAt,
      tablas_limpiadas: tablasCleaned,
    })
  } catch (err) {
    console.error('[demo:reset]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
