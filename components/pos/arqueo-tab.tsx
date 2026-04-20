'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  LockOpen, Lock, X, AlertTriangle,
  TrendingUp, TrendingDown, CheckCircle2,
  Clock, Banknote, CreditCard, ChevronDown, ChevronRight,
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
  arqueoAbierto: ArqueoCaja | null
  ventasTurno:   VentaTurno[]
  historial:     ArqueoCaja[]
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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ArqueoTab({ arqueoAbierto, ventasTurno, historial }: Props) {
  const router = useRouter()

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {arqueoAbierto
        ? <CajaAbierta
            arqueo={arqueoAbierto}
            ventasTurno={ventasTurno}
            onRefresh={() => router.refresh()}
          />
        : <CajaCerrada onRefresh={() => router.refresh()} />
      }

      {/* Historial de arqueos cerrados */}
      {historial.length > 0 && (
        <HistorialArqueos historial={historial} />
      )}
    </div>
  )
}

// ─── Caja cerrada: form para abrir ───────────────────────────────────────────

function CajaCerrada({ onRefresh }: { onRefresh: () => void }) {
  const [monto, setMonto]             = useState('')
  const [isPending, startTransition]  = useTransition()
  const [error, setError]             = useState<string | null>(null)

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
      {/* Estado: cerrada */}
      <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
        <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center shrink-0">
          <Lock className="w-4 h-4 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">Caja cerrada</p>
          <p className="text-xs text-slate-400">No hay caja abierta para este turno</p>
        </div>
      </div>

      {/* Form apertura */}
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
  onRefresh,
}: {
  arqueo:      ArqueoCaja
  ventasTurno: VentaTurno[]
  onRefresh:   () => void
}) {
  const [showCierre, setShowCierre]   = useState(false)

  // Calcular totales del turno
  const totalEfectivo    = ventasTurno
    .filter(v => v.metodo_pago === 'efectivo')
    .reduce((s, v) => s + v.total, 0)

  const totalOtros       = ventasTurno
    .filter(v => v.metodo_pago !== 'efectivo')
    .reduce((s, v) => s + v.total, 0)

  const montoEsperado    = arqueo.monto_inicial + totalEfectivo

  return (
    <>
      <div className="bg-white rounded-2xl border border-emerald-200 overflow-hidden">
        {/* Header: caja abierta */}
        <div className="flex items-center gap-3 px-5 py-4 bg-emerald-50 border-b border-emerald-200">
          <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
            <LockOpen className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800">Caja abierta</p>
            <p className="text-xs text-emerald-600">
              Abierta a las {formatHora(arqueo.fecha_apertura)} por {arqueo.usuario_nombre}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs text-emerald-600 font-medium">
              {formatHora(arqueo.fecha_apertura)}
            </span>
          </div>
        </div>

        {/* Resumen financiero */}
        <div className="px-5 py-4 space-y-3">
          <ResumenRow
            label="Monto inicial"
            valor={arqueo.monto_inicial}
            icon={<Banknote className="w-4 h-4 text-slate-400" />}
          />
          <ResumenRow
            label="Ventas en efectivo"
            valor={totalEfectivo}
            icon={<Banknote className="w-4 h-4 text-blue-400" />}
            highlight="blue"
          />
          <ResumenRow
            label="Ventas en tarjeta / transferencia"
            valor={totalOtros}
            icon={<CreditCard className="w-4 h-4 text-purple-400" />}
            highlight="purple"
          />
          <div className="border-t border-slate-100 pt-3">
            <ResumenRow
              label="Monto esperado en caja"
              valor={montoEsperado}
              icon={<Banknote className="w-4 h-4 text-emerald-500" />}
              highlight="emerald"
              bold
            />
            <p className="text-xs text-slate-400 mt-1 ml-6">
              Monto inicial + ventas en efectivo
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

      {/* Modal de cierre */}
      {showCierre && (
        <ModalCierre
          arqueo={arqueo}
          montoEsperado={montoEsperado}
          onClose={() => setShowCierre(false)}
          onCerrado={onRefresh}
        />
      )}
    </>
  )
}

function ResumenRow({
  label, valor, icon, highlight, bold,
}: {
  label:      string
  valor:      number
  icon:       React.ReactNode
  highlight?: 'blue' | 'purple' | 'emerald'
  bold?:      boolean
}) {
  const colorMap = {
    blue:    'text-blue-700',
    purple:  'text-purple-700',
    emerald: 'text-emerald-700',
  }
  const color = highlight ? colorMap[highlight] : 'text-slate-700'

  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0">{icon}</span>
      <span className={`flex-1 text-sm text-slate-600 ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`text-sm font-bold ${color} ${bold ? 'text-base' : ''}`}>{ARS(valor)}</span>
    </div>
  )
}

// ─── Modal de cierre de caja ──────────────────────────────────────────────────

function ModalCierre({
  arqueo,
  montoEsperado,
  onClose,
  onCerrado,
}: {
  arqueo:        ArqueoCaja
  montoEsperado: number
  onClose:       () => void
  onCerrado:     () => void
}) {
  const [montoReal, setMontoReal]       = useState('')
  const [observaciones, setObs]         = useState('')
  const [isPending, startTransition]    = useTransition()
  const [error, setError]               = useState<string | null>(null)

  const valorReal  = parseFloat(montoReal.replace(',', '.'))
  const valido     = !isNaN(valorReal) && valorReal >= 0
  const diferencia = valido ? valorReal - montoEsperado : null

  function diffLabel() {
    if (diferencia === null) return null
    if (Math.abs(diferencia) < 1) return { texto: 'Caja cuadrada', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-4 h-4" /> }
    if (diferencia > 0)           return { texto: `Sobrante de ${ARS(diferencia)}`, color: 'text-blue-600 bg-blue-50 border-blue-200', icon: <TrendingUp className="w-4 h-4" /> }
    return { texto: `Faltante de ${ARS(Math.abs(diferencia))}`, color: 'text-red-600 bg-red-50 border-red-200', icon: <TrendingDown className="w-4 h-4" /> }
  }

  const diff = diffLabel()

  function handleCerrar() {
    if (!valido) { setError('Ingresá el monto contado'); return }
    startTransition(async () => {
      const res = await cerrarCaja({
        arqueoId:           arqueo.id,
        montoFinalReal:     valorReal,
        montoFinalEsperado: montoEsperado,
        observaciones,
      })
      if (res.error) { setError(res.error); return }
      onCerrado()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Cerrar caja</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Monto esperado */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
            <span className="text-sm text-slate-600">Monto esperado</span>
            <span className="text-base font-bold text-slate-800">{ARS(montoEsperado)}</span>
          </div>

          {/* Efectivo contado */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Efectivo contado en caja
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={montoReal}
                onChange={e => setMontoReal(e.target.value)}
                className="w-full pl-7 pr-4 py-3 text-lg font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                autoFocus
              />
            </div>
          </div>

          {/* Diferencia en tiempo real */}
          {diff && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border font-semibold text-sm ${diff.color}`}>
              {diff.icon}
              {diff.texto}
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

        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleCerrar}
            disabled={isPending || !valido}
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
          const diff = a.diferencia ?? 0
          const esPos = diff > 0.5
          const esNeg = diff < -0.5
          const isOpen = expandido === a.id

          return (
            <li key={a.id}>
              <button
                onClick={() => setExpandido(isOpen ? null : a.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {formatFecha(a.fecha_apertura)}
                  </p>
                  <p className="text-xs text-slate-400">{a.usuario_nombre}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-800">
                    {ARS(a.monto_final_real ?? 0)}
                  </p>
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

              {/* Detalle expandido */}
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
