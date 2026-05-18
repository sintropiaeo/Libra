// QZ Tray — cliente de escritorio para impresión silenciosa (sin diálogo).
// Carga la librería dinámicamente; si QZ Tray no está corriendo devuelve false
// y el POS cae en el fallback con window.print().
//
// Primera vez: QZ Tray muestra un popup "¿Permitir que este sitio imprima?"
// Al aceptar, lo recuerda permanentemente para este dominio.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QzLib = any

let _qz: QzLib = null

async function cargarQZ(): Promise<QzLib | null> {
  if (typeof window === 'undefined') return null
  if (_qz) return _qz

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('qz-tray') as any
    _qz = mod.default ?? mod

    // Modo sin certificado: QZ pedirá permiso al usuario la primera vez
    _qz.security.setCertificatePromise((resolve: (s: string) => void) => resolve(''))
    _qz.security.setSignatureAlgorithm('SHA512')
    _qz.security.setSignaturePromise(
      () => (resolve: (s: string) => void) => resolve('')
    )

    return _qz
  } catch {
    return null
  }
}

export async function conectarQZ(): Promise<boolean> {
  const qz = await cargarQZ()
  if (!qz) return false
  if (qz.websocket.isActive()) return true

  try {
    await qz.websocket.connect({ retries: 2, delay: 1 })
    return true
  } catch {
    return false
  }
}

export async function imprimirConQZ(
  html:  string,
  ancho: '58mm' | '80mm'
): Promise<{ ok: boolean; error?: string }> {
  const qz = await cargarQZ()
  if (!qz) return { ok: false, error: 'Librería QZ Tray no disponible' }

  try {
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect({ retries: 1, delay: 0.5 })
    }

    const printer = await qz.printers.getDefault()
    const mmAncho = ancho === '58mm' ? 58 : 80

    const config = qz.configs.create(printer, {
      size:      { width: mmAncho, units: 'mm' },
      colorType: 'grayscale',
      margins:   0,
      jobName:   'Ticket Libra',
    })

    await qz.print(config, [{ type: 'pixel', format: 'html', data: html }])
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al imprimir' }
  }
}
