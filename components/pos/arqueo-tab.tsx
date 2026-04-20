'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  LockOpen, Lock, X, AlertTriangle,
  TrendingUp, TrendingDown, CheckCircle2,
  Banknote, CreditCard, Smartphone, ChevronDown, ChevronRight,
} from 'lucide-react'
import { abrirCaja, cerrarCaja } from '@/app/(dashboard)/ventas/arqueo/actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ArqueoCaja {
  id:                   string
  usuario_id:           string
  usuario_nombre:       string
  fecha_apertura:       string
  fecha_cierre:         string | null
  monto_inicial:        number
  monto_final_esperado: number | null
  monto_final_real:     number | null
  diferencia:           number | null
  observaciones:        string | null
  estado:               'abierta' | 'cerrada'
}

export interface VentaTurno {
  total:       number
  metodo_pago: string
}

interface Props {
  arqueoAbierto:  ArqueoCaja | null
  ventasTurno:    VentaTurno[]
  historial:      ArqueoCaja[]
  metodosActivos: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(v)

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
  })
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

type MetodoCfg = { label: string; icon: React.ElementType; iconColor: string; valueColor: string }

const METODO_CFG: Record<string, MetodoCfg> = {
  efectivo:      { label: 'Efectivo',        icon: Banknote,   iconColor: 'text-emerald-500', valueColor: 'text-emerald-700' },
  transferencia: { label: 'Transferencia',   icon: Smartphone, iconColor: 'text-blue-400',    valueColor: 'text-blue-700'    },
  debito:        { label: 'Tarjeta débito',  icon: CreditCard, iconColor: 'text-purple-400',  valueColor: 'text-purple-700'  },
  credito:       { label: 'Tarjeta crédito', icon: CreditCard, iconColor: 'text-orange-400',  valueColor: 'text-orange-700'  },
}

function getCfg(metodo: string): MetodoCfg {
  return METODO_CFG[metodo] ?? { label: metodo, icon: Banknote, iconColor: 'text-slate-400', valueColor: 'text-slate-700' }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ArqueoTab({ arqueoAbierto, ventasTurno, historial, metodosActivos }: Props) {
  const router = useRouter()

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {arqueoAbierto
        ? <CajaAbierta
            arqueo={arqueoAbierto}
            ventasTurno={ventasTurno}
            metodosActivos={metodosActivos}
            onRefresh={() => router.refresh()}
          />
        : <CajaCerrada onRefresh={() => router.refresh()} />
      }

      {historial.length > 0 && (
        <HistorialArqueos historial={historial} />
      )}
    </div>
  )
}

// ─── Caja cerrada: form para abrir ───────────────────────────────────────────

function CajaCerrada({ onRefresh }: { onRefresh: () => void }) {
  const [monto, setMonto]            = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)

  function handleAbrir(e: React.FormEvent) {
    e.preventDefault()
    const valor = parseFloat(monto.replace(',', '.'))
    if (isNaN(valor) || valor < 0) { setError('Ingresá un monto válido'); return }
    startTransition(async () => {
      const res = await abrirCaja(valor)
      if (res.error) { setError(res.error); return }
      onRefresh()
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
        <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center shrink-0">
          <Lock className="w-4 h-4 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">Caja cerrada</p>
          <p className="text-xs text-slate-400">No hay caja abierta para este turno</p>
        </div>
      </div>

      <form onSubmit={handleAbrir} className="px-5 py-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Monto inicial en efectivo
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              className="w-full pl-7 pr-4 py-3 text-lg font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              autoFocus
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Contá el efectivo que hay en la caja y escribilo acá.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || !monto}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl transition-colors"
        >
          <LockOpen className="w-4 h-4" />
          {isPending ? 'Abriendo…' : 'Abrir caja'}
        </button>
      </form>
    </div>
  )
}

// ─── Caja abierta: resumen + cierre ──────────────────────────────────────────

function CajaAbierta({
  arqueo,
  ventasTurno,
  metodosActivos,
  onRefresh,
}: {
  arqueo:         ArqueoCaja
  ventasTurno:    VentaTurno[]
  metodosActivos: string[]
  onRefresh:      () => void
}) {
  const [showCierre, setShowCierre] = useState(false)

  const totalPorMetodo = (m: string) =>
    ventasTurno.filter(v => v.metodo_pago === m).reduce((s, v) => s + v.total, 0)

  const totalVentas   = ventasTurno.reduce((s, v) => s + v.total, 0)
  const montoEsperado = arqueo.monto_inicial + totalVentas

  return (
    <>
      <div className="bg-white rounded-2xl border border-emerald-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-emerald-50 border-b border-emerald-200">
          <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
            <LockOpen className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Caja abierta</p>
            <p className="text-xs text-emerald-600">
              Abierta a las {formatHora(arqueo.fecha_apertura)} · {arqueo.usuario_nombre}
            </p>
          </div>
        </div>

        {/* Resumen financiero */}
        <div className="px-5 py-4 space-y-3">
          {/* Monto inicial */}
          <ResumenRow
            label="Monto inicial"
            valor={arqueo.monto_inicial}
            icon={<Banknote className="w-4 h-4 text-slate-400" />}
          />

          {/* Una fila por cada método activo */}
          {metodosActivos.map(metodo => {
            const cfg = getCfg(metodo)
            const Icon = cfg.icon
            return (
              <ResumenRow
                key={metodo}
                label={`Ventas ${cfg.label}`}
                valor={totalPorMetodo(metodo)}
                icon={<Icon className={`w-4 h-4 ${cfg.iconColor}`} />}
                valueColor={cfg.valueColor}
              />
            )
          })}

          <div className="border-t border-slate-100 pt-3">
            <ResumenRow
              label="Total en caja esperado"
              valor={montoEsperado}
              icon={<Banknote className="w-4 h-4 text-emerald-500" />}
              valueColor="text-emerald-700"
              bold
            />
            <p className="text-xs text-slate-400 mt-1 ml-6">
              Monto inicial + todas las ventas del turno
            </p>
          </div>

          {ventasTurno.length > 0 && (
            <p className="text-xs text-slate-400 text-right">
              {ventasTurno.length} venta{ventasTurno.length !== 1 ? 's' : ''} en este turno
            </p>
          )}
        </div>

        {/* Botón cerrar */}
        <div className="px-5 pb-4">
          <button
            onClick={() => setShowCierre(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-red-200 text-red-600 hover:bg-red-50 font-semibold text-sm rounded-xl transition-colors"
          >
            <Lock className="w-4 h-4" />
            Cerrar caja
          </button>
        </div>
      </div>

      {showCierre && (
        <ModalCierre
          arqueo={arqueo}
          ventasTurno={ventasTurno}
          metodosActivos={metodosActivos}
          montoEsperadoTotal={montoEsperado}
          onClose={() => setShowCierre(false)}
          onCerrado={onRefresh}
        />
      )}
    </>
  )
}

function ResumenRow({
  label, valor, icon, valueColor, bold,
}: {
  label:       string
  valor:       number
  icon:        React.ReactNode
  valueColor?: string
  bold?:       boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0">{icon}</span>
      <span className={`flex-1 text-sm text-slate-600 ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`text-sm font-bold ${valueColor ?? 'text-slate-700'} ${bold ? 'text-base' : ''}`}>
        {ARS(valor)}
      </span>
    </div>
  )
}

// ─── Modal de cierre de caja ──────────────────────────────────────────────────

type DiffBadge = { texto: string; color: string; icon: React.ReactNode }

function makeDiffBadge(diferencia: number | null): DiffBadge | null {
  if (diferencia === null) return null
  if (Math.abs(diferencia) < 1)
    return { texto: 'Cuadrado', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> }
  if (diferencia > 0)
    return { texto: `+${ARS(diferencia)} sobrante`, color: 'text-blue-600 bg-blue-50 border-blue-200', icon: <TrendingUp className="w-3.5 h-3.5" /> }
  return { texto: `−${ARS(Math.abs(diferencia))} faltante`, color: 'text-red-600 bg-red-50 border-red-200', icon: <TrendingDown className="w-3.5 h-3.5" /> }
}

function ModalCierre({
  arqueo,
  ventasTurno,
  metodosActivos,
  montoEsperadoTotal,
  onClose,
  onCerrado,
}: {
  arqueo:              ArqueoCaja
  ventasTurno:         VentaTurno[]
  metodosActivos:      string[]
  montoEsperadoTotal:  number
  onClose:             () => void
  onCerrado:           () => void
}) {
  const [montosContados, setMontosContados] = useState<Record<string, string>>({})
  const [observaciones, setObs]             = useState('')
  const [isPending, startTransition]        = useTransition()
  const [error, setError]                   = useState<string | null>(null)

  // Monto esperado por método:
  // - efectivo: monto_inicial + ventas_efectivo
  // - otros:    solo ventas de ese método
  function esperadoPorMetodo(metodo: string): number {
    const ventas = ventasTurno
      .filter(v => v.metodo_pago === metodo)
      .reduce((s, v) => s + v.total, 0)
    return metodo === 'efectivo' ? arqueo.monto_inicial + ventas : ventas
  }

  function realPorMetodo(metodo: string): number | null {
    const raw = montosContados[metodo]
    if (raw === undefined || raw === '') return null
    const v = parseFloat(raw.replace(',', '.'))
    return isNaN(v) ? null : v
  }

  const todosCompletos = metodosActivos.every(m => realPorMetodo(m) !== null)

  const totalReal = todosCompletos
    ? metodosActivos.reduce((s, m) => s + (realPorMetodo(m) ?? 0), 0)
    : null

  const diferenciaTotal = totalReal !== null ? totalReal - montoEsperadoTotal : null

  function handleCerrar() {
    if (!todosCompletos) { setError('Completá los montos de todos los medios de cobro'); return }
    startTransition(async () => {
      const res = await cerrarCaja({
        arqueoId:           arqueo.id,
        montoFinalReal:     totalReal!,
        montoFinalEsperado: montoEsperadoTotal,
        observaciones,
      })
      if (res.error) { setError(res.error); return }
      onCerrado()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-semibold text-slate-800">Cerrar caja</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Resumen del turno */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-600">
              {ventasTurno.length} venta{ventasTurno.length !== 1 ? 's' : ''} · Total vendido
            </span>
            <span className="font-bold text-slate-800">
              {ARS(ventasTurno.reduce((s, v) => s + v.total, 0))}
            </span>
          </div>

          {/* Un bloque por método */}
          <div className="space-y-4">
            {metodosActivos.map(metodo => {
              const cfg      = getCfg(metodo)
              const Icon     = cfg.icon
              const esperado = esperadoPorMetodo(metodo)
              const real     = realPorMetodo(metodo)
              const dif      = real !== null ? real - esperado : null
              const badge    = makeDiffBadge(dif)

              return (
                <div key={metodo} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  {/* Label + esperado */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
                      <span className="text-sm font-semibold text-slate-800">{cfg.label}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      Esperado: <span className="font-bold text-slate-700">{ARS(esperado)}</span>
                    </span>
                  </div>

                  {/* Input de conteo */}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={montosContados[metodo] ?? ''}
                      onChange={e => setMontosContados(prev => ({ ...prev, [metodo]: e.target.value }))}
                      className="w-full pl-7 pr-4 py-2.5 text-base font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                    />
                  </div>

                  {/* Diferencia en tiempo real */}
                  {badge && (
                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold ${badge.color}`}>
                      {badge.icon}
                      {badge.texto}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Resumen total (cuando todos completos) */}
          {todosCompletos && totalReal !== null && (
            <div className="bg-slate-50 rounded-xl px-4 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total esperado</span>
                <span className="font-bold text-slate-800">{ARS(montoEsperadoTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total contado</span>
                <span className="font-bold text-slate-800">{ARS(totalReal)}</span>
              </div>
              {(() => {
                const b = makeDiffBadge(diferenciaTotal)
                return b ? (
                  <div className={`flex items-center gap-2 mt-2 px-3 py-2.5 rounded-xl border font-semibold text-sm ${b.color}`}>
                    {b.icon}
                    {Math.abs(diferenciaTotal!) < 1
                      ? 'Caja cuadrada'
                      : diferenciaTotal! > 0
                        ? `Sobrante total de ${ARS(diferenciaTotal!)}`
                        : `Faltante total de ${ARS(Math.abs(diferenciaTotal!))}`
                    }
                  </div>
                ) : null
              })()}
            </div>
          )}

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Observaciones <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Ej: Se encontraron 2 billetes falsos..."
              value={observaciones}
              onChange={e => setObs(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5 pt-3 shrink-0 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleCerrar}
            disabled={isPending || !todosCompletos}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {isPending ? 'Cerrando…' : 'Confirmar cierre'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Historial de arqueos ─────────────────────────────────────────────────────

function HistorialArqueos({ historial }: { historial: ArqueoCaja[] }) {
  const [expandido, setExpandido] = useState<string | null>(null)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <p className="text-sm font-semibold text-slate-700">Historial de arqueos</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {historial.map(a => {
          const diff   = a.diferencia ?? 0
          const esPos  = diff > 0.5
          const esNeg  = diff < -0.5
          const isOpen = expandido === a.id

          return (
            <li key={a.id}>
              <button
                onClick={() => setExpandido(isOpen ? null : a.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{formatFecha(a.fecha_apertura)}</p>
                  <p className="text-xs text-slate-400">{a.usuario_nombre}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-800">{ARS(a.monto_final_real ?? 0)}</p>
                  {a.diferencia !== null && (
                    <p className={`text-xs font-semibold ${
                      esNeg ? 'text-red-500' : esPos ? 'text-blue-500' : 'text-emerald-500'
                    }`}>
                      {esNeg ? `−${ARS(Math.abs(diff))}` : esPos ? `+${ARS(diff)}` : 'Cuadrada'}
                    </p>
                  )}
                </div>
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                }
              </button>

              {isOpen && (
                <div className="px-5 pb-3 pt-1 bg-slate-50 text-xs space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Apertura</span>
                    <span className="font-medium">{formatFecha(a.fecha_apertura)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cierre</span>
                    <span className="font-medium">{a.fecha_cierre ? formatFecha(a.fecha_cierre) : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Monto inicial</span>
                    <span className="font-medium">{ARS(a.monto_inicial)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Monto esperado</span>
                    <span className="font-medium">{ARS(a.monto_final_esperado ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Monto real</span>
                    <span className="font-medium">{ARS(a.monto_final_real ?? 0)}</span>
                  </div>
                  {a.observaciones && (
                    <div className="pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Obs: {a.observaciones}</span>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
