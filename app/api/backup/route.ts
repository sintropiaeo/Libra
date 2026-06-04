import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function isVercelCron(req: NextRequest): boolean {
  const auth   = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

function isTestMode(req: NextRequest): boolean {
  return (
    process.env.ENABLE_BACKUP_TEST === 'true' &&
    req.nextUrl.searchParams.get('test') === 'true'
  )
}

// ─── Table discovery via PostgREST OpenAPI spec ───────────────────────────────
// GET /rest/v1/ devuelve el spec OpenAPI con una entrada en `definitions`
// por cada tabla/vista expuesta en el schema public. Es el endpoint más
// confiable — no requiere acceso a information_schema ni funciones custom.

async function getPublicTableNames(): Promise<string[]> {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Error al obtener spec de PostgREST: ${res.status} — ${body}`)
  }

  const spec = await res.json()
  // spec.definitions tiene una entrada por cada tabla/vista del schema public
  return Object.keys(spec.definitions ?? {}).sort()
}

// ─── Prioridad de tablas ──────────────────────────────────────────────────────
// Las tablas críticas se exportan primero para garantizar su backup aunque
// el tiempo se agote antes de procesar el resto.

const TABLAS_PRIORITARIAS = [
  'productos',
  'ventas',
  'venta_items',
  'categorias',
  'proveedores',
  'perfiles',
  'negocio_config',
  'configuracion_ticket',
]

function ordenarTablas(nombres: string[]): string[] {
  const set    = new Set(nombres)
  const prio   = TABLAS_PRIORITARIAS.filter(t => set.has(t))
  const resto  = nombres.filter(t => !TABLAS_PRIORITARIAS.includes(t)).sort()
  return [...prio, ...resto]
}

// ─── HTML del email ───────────────────────────────────────────────────────────

function buildEmailHtml(
  negocio:        string,
  fecha:          string,
  hora:           string,
  detalle:        Record<string, number>,
  totalRegistros: number,
  parcial:        boolean,
  omitidas:       string[],
): string {
  const rows = Object.entries(detalle)
    .map(
      ([tabla, n]) =>
        `<tr>
          <td style="padding:7px 14px;border-bottom:1px solid #e2e8f0;color:#334155">${tabla}</td>
          <td style="padding:7px 14px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#1e293b">${n.toLocaleString('es-AR')}</td>
        </tr>`,
    )
    .join('')

  const alertaParcial = parcial ? `
    <div style="margin:16px 28px 0;padding:12px 16px;background:#fef9c3;border:1px solid #fde047;border-radius:8px">
      <p style="margin:0;font-size:13px;color:#713f12;font-weight:600">⚠️ Backup parcial — plan Free (timeout 10s)</p>
      <p style="margin:4px 0 0;font-size:12px;color:#92400e">
        Tablas no exportadas por tiempo: <strong>${omitidas.join(', ')}</strong><br>
        Las tablas críticas (productos, ventas) siempre se procesan primero.
        Para backup completo, pasá al plan Pro de Vercel.
      </p>
    </div>` : ''

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Backup Libra</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:${parcial ? '#b45309' : '#1e40af'};padding:24px 28px;display:flex;align-items:center;gap:12px">
      <span style="font-size:28px">${parcial ? '⚠️' : '🗄️'}</span>
      <div>
        <h1 style="margin:0;color:white;font-size:18px;font-weight:700">${parcial ? 'Backup Parcial' : 'Backup Semanal'} — ${negocio}</h1>
        <p style="margin:4px 0 0;color:${parcial ? '#fde68a' : '#93c5fd'};font-size:13px">${fecha} · ${hora} (hora Argentina)</p>
      </div>
    </div>

    ${alertaParcial}

    <!-- Resumen -->
    <div style="padding:20px 28px 0">
      <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Tablas exportadas</p>
    </div>

    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:9px 14px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;border-bottom:2px solid #e2e8f0">Tabla</th>
          <th style="padding:9px 14px;text-align:right;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;border-bottom:2px solid #e2e8f0">Registros</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#eff6ff">
          <td style="padding:10px 14px;font-weight:700;color:#1e40af">Total exportado</td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;color:#1e40af">${totalRegistros.toLocaleString('es-AR')}</td>
        </tr>
      </tfoot>
    </table>

    <!-- Footer -->
    <div style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="margin:0;color:#94a3b8;font-size:12px">
        El archivo <strong style="color:#64748b">backup-${fecha}.json</strong> con todos los datos está adjunto a este correo.<br>
        Backup generado automáticamente por Libra · Vercel Cron
      </p>
    </div>
  </div>
</body>
</html>`
}

// ─── Lógica principal del backup ──────────────────────────────────────────────

async function ejecutarBackup() {
  const resendKey   = process.env.RESEND_API_KEY
  const backupEmail = process.env.BACKUP_EMAIL
  const fromEmail   = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

  if (!resendKey)   throw new Error('Falta la variable RESEND_API_KEY')
  if (!backupEmail) throw new Error('Falta la variable BACKUP_EMAIL')

  const supabase = createAdminClient()

  // 1. Descubrir tablas y ordenar por prioridad
  const allTableNames    = await getPublicTableNames()
  const tableNamesOrden  = ordenarTablas(allTableNames)

  // 2. Exportar tablas con presupuesto de tiempo
  // Vercel free tier = 10s timeout. Reservamos 3s para armar JSON + enviar email.
  const DEADLINE_MS   = 7_000
  const inicio        = Date.now()
  const tablas: Record<string, unknown[]> = {}
  const detalle: Record<string, number>   = {}
  const tablasOmitidas: string[]          = []
  let totalRegistros = 0

  for (let i = 0; i < tableNamesOrden.length; i++) {
    const tableName = tableNamesOrden[i]

    // Verificar tiempo restante antes de empezar cada tabla
    if (Date.now() - inicio > DEADLINE_MS) {
      tablasOmitidas.push(...tableNamesOrden.slice(i))
      console.warn(`[backup] Tiempo agotado. Omitidas: ${tablasOmitidas.join(', ')}`)
      break
    }

    // Paginar de a 1.000 (límite max-rows de PostgREST en Supabase hosted)
    let allRows: unknown[] = []
    let from = 0
    const PAGE = 1_000
    let done = false

    while (!done) {
      if (Date.now() - inicio > DEADLINE_MS) {
        // Tiempo agotado a mitad de tabla: guardar lo acumulado hasta ahora
        console.warn(`[backup] Tiempo agotado exportando "${tableName}" en fila ${from}`)
        tablasOmitidas.push(...tableNamesOrden.slice(i + 1))
        done = true
        i = tableNamesOrden.length  // fuerza salida del for
        break
      }

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(from, from + PAGE - 1)

      if (error) {
        console.error(`[backup] Error en tabla "${tableName}":`, error.message)
        done = true
        break
      }
      allRows = allRows.concat(data ?? [])
      if (!data || data.length < PAGE) done = true
      else from += PAGE
    }

    tablas[tableName]  = allRows
    detalle[tableName] = allRows.length
    totalRegistros    += allRows.length
  }

  const esParcial = tablasOmitidas.length > 0

  // 3. Obtener nombre del negocio
  let negocioNombre = 'Libra'
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cfg } = await (supabase as any).from('negocio_config').select('nombre').maybeSingle()
    if (cfg?.nombre) negocioNombre = cfg.nombre
  } catch { /* tabla puede no existir */ }

  // 4. Armar el JSON del backup
  const ahora = new Date()
  const fecha = ahora.toISOString().split('T')[0]
  const hora  = ahora.toLocaleString('es-AR', {
    hour:     '2-digit',
    minute:   '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })

  const backupObj = {
    fecha,
    hora,
    negocio:         negocioNombre,
    generado:        ahora.toISOString(),
    parcial:         esParcial,
    tablas_omitidas: esParcial ? tablasOmitidas : undefined,
    tablas,
    resumen: {
      total_tablas:      tableNamesOrden.length,
      tablas_exportadas: Object.keys(tablas).length,
      tablas_omitidas:   tablasOmitidas,
      total_registros:   totalRegistros,
      tablas_detalle:    detalle,
    },
  }

  const jsonString = JSON.stringify(backupObj, null, 2)
  const filename   = `backup-${fecha}${esParcial ? '-parcial' : ''}.json`

  // 5. Enviar por email con Resend
  const resend = new Resend(resendKey)
  const html   = buildEmailHtml(negocioNombre, fecha, hora, detalle, totalRegistros, esParcial, tablasOmitidas)

  const { error: emailError } = await resend.emails.send({
    from:        fromEmail,
    to:          backupEmail,
    subject:     `Backup Libra — ${negocioNombre} — ${fecha}`,
    html,
    attachments: [
      {
        filename,
        content: Buffer.from(jsonString).toString('base64'),
      },
    ],
  })

  if (emailError) {
    throw new Error(`Error al enviar email: ${(emailError as { message?: string }).message ?? JSON.stringify(emailError)}`)
  }

  return {
    success:         true,
    tablas:          allTableNames.length,
    registros_total: totalRegistros,
    fecha,
    tablas_detalle:  detalle,
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Modo test — solo cuando ENABLE_BACKUP_TEST=true y ?test=true en la URL
  if (isTestMode(req)) {
    try {
      const result = await ejecutarBackup()
      return NextResponse.json(result)
    } catch (err) {
      console.error('[backup:test]', err)
      return NextResponse.json({ error: (err as Error).message }, { status: 500 })
    }
  }

  // Producción — requiere header del cron de Vercel
  if (!isVercelCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await ejecutarBackup()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[backup:cron]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
