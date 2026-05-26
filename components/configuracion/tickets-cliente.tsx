'use client'

import { useState, useTransition } from 'react'
import { Building2, Printer, Settings2, Save, X, Check } from 'lucide-react'
import { guardarConfigTicket } from '@/app/(dashboard)/configuracion/tickets/actions'
import type { ConfiguracionTicket } from '@/lib/permisos'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FormState = Omit<ConfiguracionTicket, 'id'>

const CONDICIONES_IVA = [
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
  'Consumidor Final',
  'No Responsable',
]

const DEFAULTS: FormState = {
  nombre_comercio:    '',
  direccion:          '',
  cuit:               '',
  condicion_iva:      'Responsable Inscripto',
  telefono:           '',
  logo_url:           '',
  ancho_papel:        '80mm',
  mostrar_logo:       false,
  mostrar_cuit:       true,
  mostrar_telefono:   true,
  mostrar_direccion:  true,
  mensaje_pie:        '¡Gracias por su compra!',
  mostrar_vendedor:   false,
  copias_a_imprimir:  1,
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TicketsCliente({ config }: { config: ConfiguracionTicket | null }) {
  const [form, setForm] = useState<FormState>({
    nombre_comercio:    config?.nombre_comercio    ?? DEFAULTS.nombre_comercio,
    direccion:          config?.direccion          ?? DEFAULTS.direccion,
    cuit:               config?.cuit               ?? DEFAULTS.cuit,
    condicion_iva:      config?.condicion_iva      ?? DEFAULTS.condicion_iva,
    telefono:           config?.telefono           ?? DEFAULTS.telefono,
    logo_url:           config?.logo_url           ?? DEFAULTS.logo_url,
    ancho_papel:        config?.ancho_papel        ?? DEFAULTS.ancho_papel,
    mostrar_logo:       config?.mostrar_logo       ?? DEFAULTS.mostrar_logo,
    mostrar_cuit:       config?.mostrar_cuit       ?? DEFAULTS.mostrar_cuit,
    mostrar_telefono:   config?.mostrar_telefono   ?? DEFAULTS.mostrar_telefono,
    mostrar_direccion:  config?.mostrar_direccion  ?? DEFAULTS.mostrar_direccion,
    mensaje_pie:        config?.mensaje_pie        ?? DEFAULTS.mensaje_pie,
    mostrar_vendedor:   config?.mostrar_vendedor   ?? DEFAULTS.mostrar_vendedor,
    copias_a_imprimir:  config?.copias_a_imprimir  ?? DEFAULTS.copias_a_imprimir,
  })

  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function save() {
    startTransition(async () => {
      const res = await guardarConfigTicket(form)
      if (res.error) { setMsg({ type: 'err', text: res.error }); return }
      setMsg({ type: 'ok', text: 'Configuración guardada correctamente' })
      setTimeout(() => setMsg(null), 4000)
    })
  }

  const fecha = new Date().toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Tickets de Venta</h1>
        <p className="text-sm text-slate-500 mt-1">
          Personalizá cómo se imprimen los comprobantes en el Punto de Venta.
        </p>
      </div>

      <div className="flex gap-8 items-start">
        {/* ── Formulario ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {msg && (
            <div className={`text-sm px-4 py-2.5 rounded-lg flex items-center justify-between ${
              msg.type === 'ok'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <span className="flex items-center gap-2">
                {msg.type === 'ok' && <Check className="w-4 h-4" />}
                {msg.text}
              </span>
              <button onClick={() => setMsg(null)}><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* ─── Sección 1: Datos del Comercio ─── */}
          <Card icon={<Building2 className="w-4 h-4 text-slate-500" />} title="Datos del Comercio">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre del comercio" className="col-span-2">
                <input
                  value={form.nombre_comercio}
                  onChange={e => set('nombre_comercio', e.target.value)}
                  placeholder="Ej: Librería El Saber"
                  className={INPUT}
                />
              </Field>

              <Field label="CUIT">
                <input
                  value={form.cuit}
                  onChange={e => set('cuit', e.target.value)}
                  placeholder="Ej: 20-12345678-9"
                  className={INPUT}
                />
              </Field>

              <Field label="Condición ante el IVA">
                <select
                  value={form.condicion_iva}
                  onChange={e => set('condicion_iva', e.target.value)}
                  className={INPUT}
                >
                  {CONDICIONES_IVA.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label="Dirección" className="col-span-2">
                <input
                  value={form.direccion}
                  onChange={e => set('direccion', e.target.value)}
                  placeholder="Ej: Av. Corrientes 1234, CABA"
                  className={INPUT}
                />
              </Field>

              <Field label="Teléfono">
                <input
                  value={form.telefono ?? ''}
                  onChange={e => set('telefono', e.target.value)}
                  placeholder="Ej: +54 11 1234-5678"
                  className={INPUT}
                />
              </Field>

              <Field label="URL del logo" hint="Enlace público a una imagen (PNG o JPG)">
                <input
                  value={form.logo_url ?? ''}
                  onChange={e => set('logo_url', e.target.value)}
                  placeholder="https://..."
                  className={INPUT}
                />
              </Field>
            </div>
          </Card>

          {/* ─── Sección 2: Diseño del Ticket ─── */}
          <Card icon={<Printer className="w-4 h-4 text-slate-500" />} title="Diseño del Ticket">
            <div className="space-y-2.5">
              <ToggleRow
                label="Mostrar logo"
                descripcion="Imprime la imagen del logo en la cabecera del ticket"
                checked={form.mostrar_logo}
                onChange={v => set('mostrar_logo', v)}
              />
              <ToggleRow
                label="Mostrar CUIT"
                descripcion="Incluye el CUIT del comercio debajo del nombre"
                checked={form.mostrar_cuit}
                onChange={v => set('mostrar_cuit', v)}
              />
              <ToggleRow
                label="Mostrar condición IVA"
                descripcion="Muestra 'Responsable Inscripto', 'Monotributista', etc."
                checked={form.mostrar_cuit}
                onChange={v => set('mostrar_cuit', v)}
                disabled
                hint="Se muestra junto al CUIT"
              />
              <ToggleRow
                label="Mostrar dirección"
                descripcion="Incluye la dirección física del comercio"
                checked={form.mostrar_direccion}
                onChange={v => set('mostrar_direccion', v)}
              />
              <ToggleRow
                label="Mostrar teléfono"
                descripcion="Incluye el número de teléfono"
                checked={form.mostrar_telefono}
                onChange={v => set('mostrar_telefono', v)}
              />
              <ToggleRow
                label="Mostrar vendedor"
                descripcion="Incluye el nombre del usuario que registró la venta"
                checked={form.mostrar_vendedor}
                onChange={v => set('mostrar_vendedor', v)}
              />
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <Field label="Mensaje de cierre" hint="Texto que aparece al final del ticket">
                <input
                  value={form.mensaje_pie ?? ''}
                  onChange={e => set('mensaje_pie', e.target.value)}
                  placeholder="Ej: ¡Gracias por su compra!"
                  className={INPUT}
                />
              </Field>
            </div>
          </Card>

          {/* ─── Sección 3: Opciones de Impresión ─── */}
          <Card icon={<Settings2 className="w-4 h-4 text-slate-500" />} title="Opciones de Impresión">
            <div className="space-y-5">
              {/* Ancho del papel */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Ancho del papel</p>
                <p className="text-xs text-slate-400 mb-3">Debe coincidir con el rollo de tu impresora térmica</p>
                <div className="flex gap-3">
                  {(['58mm', '80mm'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('ancho_papel', t)}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        form.ancho_papel === t
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <span className="block text-lg mb-0.5">{t === '58mm' ? '▮' : '▬'}</span>
                      {t}
                      <span className="block text-xs font-normal mt-0.5 text-slate-400">
                        {t === '58mm' ? 'Rollo angosto' : 'Rollo standard'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Copias */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Copias a imprimir</p>
                <p className="text-xs text-slate-400 mb-3">Cantidad de tickets que se imprimen por cada venta</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set('copias_a_imprimir', n)}
                      className={`w-12 h-12 rounded-xl border-2 text-sm font-bold transition-all ${
                        form.copias_a_imprimir === n
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Botón guardar */}
          <button
            onClick={save}
            disabled={isPending}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {isPending
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando…</>
              : <><Save className="w-4 h-4" />Guardar configuración</>
            }
          </button>
        </div>

        {/* ── Preview ── */}
        <div className="w-[260px] shrink-0 sticky top-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Vista previa</p>
          <TicketPreview form={form} fecha={fecha} />
          <p className="text-xs text-slate-400 text-center mt-3">
            Simulación del ticket impreso
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const INPUT = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

function Card({
  icon, title, children,
}: {
  icon:     React.ReactNode
  title:    string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
        {icon}
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function Field({
  label, hint, children, className = '',
}: {
  label:     string
  hint?:     string
  children:  React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

function ToggleRow({
  label, descripcion, checked, onChange, disabled, hint,
}: {
  label:       string
  descripcion: string
  checked:     boolean
  onChange:    (v: boolean) => void
  disabled?:   boolean
  hint?:       string
}) {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
        disabled
          ? 'border-slate-100 bg-slate-50 opacity-60 cursor-default'
          : checked
          ? 'border-blue-200 bg-blue-50 cursor-pointer'
          : 'border-slate-200 bg-white hover:border-slate-300 cursor-pointer'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{hint ?? descripcion}</p>
      </div>
      <div className={`relative shrink-0 ml-4 w-10 h-5 rounded-full transition-colors ${
        checked ? 'bg-blue-500' : 'bg-slate-300'
      }`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`} />
      </div>
    </div>
  )
}

// ─── Ticket Preview ───────────────────────────────────────────────────────────

function TicketPreview({ form, fecha }: { form: FormState; fecha: string }) {
  const ancho = form.ancho_papel === '58mm' ? '215px' : '268px'

  return (
    <div
      className="mx-auto border border-slate-300 shadow-md rounded-sm"
      style={{
        width:      ancho,
        fontFamily: "'Courier New', Courier, monospace",
        fontSize:   '11px',
        lineHeight: '1.4',
        background: '#fffef7',
        padding:    '10px 8px',
      }}
    >
      {/* Logo */}
      {form.mostrar_logo && form.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={form.logo_url}
          alt="Logo"
          style={{ display: 'block', maxWidth: '80px', maxHeight: '60px', margin: '0 auto 6px', objectFit: 'contain' }}
        />
      )}

      {/* Nombre */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', marginBottom: '2px' }}>
        {form.nombre_comercio || 'Nombre del Comercio'}
      </div>

      {/* Datos del comercio */}
      {form.mostrar_cuit && form.cuit && (
        <div style={{ textAlign: 'center' }}>CUIT: {form.cuit}</div>
      )}
      {form.mostrar_cuit && (
        <div style={{ textAlign: 'center' }}>{form.condicion_iva}</div>
      )}
      {form.mostrar_direccion && form.direccion && (
        <div style={{ textAlign: 'center' }}>{form.direccion}</div>
      )}
      {form.mostrar_telefono && form.telefono && (
        <div style={{ textAlign: 'center' }}>Tel: {form.telefono}</div>
      )}

      <Sep />

      {/* Cabecera venta */}
      <div>{fecha}</div>
      <div>Venta <strong>#001</strong></div>

      <Sep />

      {/* Ítems de ejemplo */}
      <Row left="1× Lapicera azul"   right="$500"   />
      <Row left="2× Cuaderno A4"     right="$2.400" />
      <Row left="1× Resma A4"        right="$4.800" />

      <Sep />

      <Row left="TOTAL" right="$7.700" bold />

      <Sep />

      <div>Método: Efectivo</div>
      {form.mostrar_vendedor && <div>Vendedor: Admin</div>}

      {form.mensaje_pie && (
        <>
          <Sep />
          <div style={{ textAlign: 'center' }}>{form.mensaje_pie}</div>
        </>
      )}

      {/* Borde recortado */}
      <div style={{
        marginTop:    '12px',
        borderTop:    '1px dashed #aaa',
        paddingTop:   '4px',
        textAlign:    'center',
        color:        '#bbb',
        fontSize:     '9px',
        letterSpacing: '1px',
      }}>
        ✂ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
      </div>
    </div>
  )
}

function Sep() {
  return (
    <div style={{
      borderTop: '1px dashed #777',
      margin:    '5px 0',
    }} />
  )
}

function Row({ left, right, bold }: { left: string; right: string; bold?: boolean }) {
  return (
    <div style={{
      display:        'flex',
      justifyContent: 'space-between',
      gap:            '4px',
      fontWeight:     bold ? 'bold' : 'normal',
      padding:        '1px 0',
    }}>
      <span style={{ flex: 1 }}>{left}</span>
      <span>{right}</span>
    </div>
  )
}
