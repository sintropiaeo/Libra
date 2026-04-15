'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, TrendingDown, ChevronRight, Building2, SlidersHorizontal } from 'lucide-react'

type Compra = {
  id: string
  fecha: string
  total: number
  notas: string | null
  proveedores: { id: string; nombre: string } | null
}

type Proveedor = {
  id: string
  nombre: string
}

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(v)

type RangoFecha = 'hoy' | 'semana' | 'mes' | 'todo'

const RANGOS: { value: RangoFecha; label: string }[] = [
  { value: 'hoy',    label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes',    label: 'Este mes' },
  { value: 'todo',   label: 'Todo' },
]

function inicioRango(rango: RangoFecha): Date | null {
  const hoy = new Date()
  if (rango === 'hoy') {
    return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  }
  if (rango === 'semana') {
    const d = new Date(hoy)
    d.setDate(d.getDate() - d.getDay()) // domingo de esta semana
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (rango === 'mes') {
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  }
  return null
}

export default function HistorialComprasCliente({
  initialCompras,
  proveedores,
}: {
  initialCompras: Compra[]
  proveedores: Proveedor[]
}) {
  const [rango,       setRango]       = useState<RangoFecha>('todo')
  const [provFiltro,  setProvFiltro]  = useState<string>('') // id o ''

  // ─── Filtrado ──────────────────────────────────────────────────────────────
  const comprasFiltradas = useMemo(() => {
    const inicio = inicioRango(rango)
    return initialCompras.filter((c) => {
      if (inicio && new Date(c.fecha) < inicio) return false
      if (provFiltro && c.proveedores?.id !== provFiltro) return false
      return true
    })
  }, [initialCompras, rango, provFiltro])

  const totalFiltrado = comprasFiltradas.reduce((s, c) => s + Number(c.total), 0)

  // Stats globales del día (independientes del filtro)
  const hoy = new Date()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const comprasHoy = initialCompras.filter((c) => new Date(c.fecha) >= inicioHoy)
  const totalHoy   = comprasHoy.reduce((s, c) => s + Number(c.total), 0)

  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compras</h1>
          <p className="text-slate-500 text-sm mt-0.5">Historial de compras a proveedores</p>
        </div>
        <Link
          href="/compras/nueva"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva compra
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Compras hoy</p>
            <p className="text-xl font-bold text-slate-900">{ARS(totalHoy)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-slate-500 font-bold text-sm">#</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Hoy</p>
            <p className="text-xl font-bold text-slate-900">{comprasHoy.length} compras</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-slate-500 font-bold text-sm">∑</span>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total registros</p>
            <p className="text-xl font-bold text-slate-900">{initialCompras.length}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="font-medium">Filtrar:</span>
        </div>

        {/* Rango de fecha */}
        <div className="flex gap-1">
          {RANGOS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRango(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                rango === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Proveedor */}
        {proveedores.length > 0 && (
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={provFiltro}
              onChange={(e) => setProvFiltro(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none text-slate-600"
            >
              <option value="">Todos los proveedores</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Resumen del filtro activo */}
        {comprasFiltradas.length > 0 && (
          <span className="ml-auto text-sm text-slate-500">
            {comprasFiltradas.length} {comprasFiltradas.length === 1 ? 'compra' : 'compras'} ·{' '}
            <span className="font-semibold text-slate-700">{ARS(totalFiltrado)}</span>
          </span>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {comprasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-slate-500 mb-1">
              {initialCompras.length === 0
                ? 'No hay compras registradas'
                : 'Sin resultados para los filtros seleccionados'}
            </p>
            {initialCompras.length === 0 && (
              <Link
                href="/compras/nueva"
                className="mt-3 text-sm text-blue-600 hover:underline font-medium"
              >
                Registrar primera compra →
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3.5">Fecha y hora</th>
                  <th className="px-5 py-3.5">Proveedor</th>
                  <th className="px-5 py-3.5">Notas</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comprasFiltradas.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                      {new Date(c.fecha).toLocaleString('es-AR', {
                        day:    '2-digit',
                        month:  '2-digit',
                        year:   'numeric',
                        hour:   '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.proveedores ? (
                        <Link
                          href={`/proveedores/${c.proveedores.id}`}
                          className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 transition-colors w-fit"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {c.proveedores.nombre}
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-xs">Sin proveedor</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs max-w-xs truncate">
                      {c.notas || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-800 whitespace-nowrap">
                      {ARS(Number(c.total))}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/compras/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                      >
                        Ver detalle
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
