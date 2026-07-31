'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, Loader2, AlertTriangle, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  crearPresentacion,
  actualizarPresentacion,
  eliminarPresentacion,
} from '@/app/(dashboard)/productos/actions'

type Presentacion = {
  id:            string
  nombre:        string
  cantidad_base: number
  precio_venta:  number
  codigo_barras: string | null
  activo:        boolean
}

export default function PresentacionesModal({
  productoId,
  productoNombre,
  onClose,
  onChanged,
}: {
  productoId:     string
  productoNombre: string
  onClose:        () => void
  onChanged?:     () => void
}) {
  const [items,       setItems]       = useState<Presentacion[]>([])
  const [cargando,    setCargando]    = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [ocupadoId,   setOcupadoId]   = useState<string | null>(null)
  const [creando,     setCreando]     = useState(false)
  const [nueva, setNueva] = useState({ nombre: '', cantidad_base: '1', precio_venta: '0', codigo_barras: '' })

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('producto_presentaciones')
      .select('id, nombre, cantidad_base, precio_venta, codigo_barras, activo')
      .eq('producto_id', productoId)
      .order('cantidad_base')
    if (error) setError(error.message)
    else setItems((data ?? []).map((d) => ({ ...d, precio_venta: Number(d.precio_venta) })))
    setCargando(false)
  }, [productoId])

  useEffect(() => { cargar() }, [cargar])

  function patch(id: string, campo: keyof Presentacion, valor: string | number | boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)))
  }

  async function guardar(item: Presentacion) {
    setError(null)
    setOcupadoId(item.id)
    const r = await actualizarPresentacion(item.id, {
      nombre:        item.nombre,
      cantidad_base: Number(item.cantidad_base),
      precio_venta:  Number(item.precio_venta),
      codigo_barras: item.codigo_barras?.trim() || null,
      activo:        item.activo,
    })
    setOcupadoId(null)
    if (r.error) { setError(r.error); return }
    await cargar()
    onChanged?.()
  }

  async function borrar(id: string) {
    setError(null)
    setOcupadoId(id)
    const r = await eliminarPresentacion(id)
    setOcupadoId(null)
    if (r.error) { setError(r.error); return }
    await cargar()
    onChanged?.()
  }

  async function agregar() {
    setError(null)
    if (!nueva.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setCreando(true)
    const r = await crearPresentacion(productoId, {
      nombre:        nueva.nombre,
      cantidad_base: Number(nueva.cantidad_base),
      precio_venta:  Number(nueva.precio_venta),
      codigo_barras: nueva.codigo_barras.trim() || null,
      activo:        true,
    })
    setCreando(false)
    if (r.error) { setError(r.error); return }
    setNueva({ nombre: '', cantidad_base: '1', precio_venta: '0', codigo_barras: '' })
    await cargar()
    onChanged?.()
  }

  const inputCls = 'px-2 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-5 h-5 text-slate-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">Presentaciones</h2>
              <p className="text-xs text-slate-500 truncate">{productoNombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4">
          <p className="text-xs text-slate-500">
            Cada presentación descuenta <b>cantidad × cantidad base</b> del stock del producto.
            El precio es el <b>total</b> de la presentación (no por unidad).
          </p>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {cargando ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <>
              {/* Encabezado de columnas */}
              <div className="grid grid-cols-[1.6fr_0.8fr_1fr_1.4fr_auto_auto] gap-2 items-center px-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                <span>Nombre</span>
                <span>Cant. base</span>
                <span>Precio</span>
                <span>Cód. barras</span>
                <span className="text-center">Activo</span>
                <span></span>
              </div>

              {items.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-3">Este producto todavía no tiene presentaciones.</p>
              )}

              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-[1.6fr_0.8fr_1fr_1.4fr_auto_auto] gap-2 items-center">
                  <input className={inputCls} value={item.nombre}
                    onChange={(e) => patch(item.id, 'nombre', e.target.value)} placeholder="Ej: Caja x100" />
                  <input className={inputCls} type="number" min={1} step={1} value={item.cantidad_base}
                    onChange={(e) => patch(item.id, 'cantidad_base', e.target.value)} />
                  <input className={inputCls} type="number" min={0} step="1" value={item.precio_venta}
                    onChange={(e) => patch(item.id, 'precio_venta', e.target.value)} />
                  <input className={inputCls} value={item.codigo_barras ?? ''}
                    onChange={(e) => patch(item.id, 'codigo_barras', e.target.value)} placeholder="Opcional" />
                  <button
                    onClick={() => patch(item.id, 'activo', !item.activo)}
                    title={item.activo ? 'Activo' : 'Inactivo'}
                    className={`relative w-9 h-5 rounded-full transition-colors mx-auto ${item.activo ? 'bg-blue-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.activo ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => guardar(item)}
                      disabled={ocupadoId === item.id}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white transition-colors"
                    >
                      {ocupadoId === item.id ? '…' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => borrar(item.id)}
                      disabled={ocupadoId === item.id}
                      title="Eliminar"
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Fila para agregar */}
              <div className="grid grid-cols-[1.6fr_0.8fr_1fr_1.4fr_auto_auto] gap-2 items-center pt-2 border-t border-slate-100">
                <input className={inputCls} value={nueva.nombre}
                  onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} placeholder="Nueva presentación" />
                <input className={inputCls} type="number" min={1} step={1} value={nueva.cantidad_base}
                  onChange={(e) => setNueva({ ...nueva, cantidad_base: e.target.value })} />
                <input className={inputCls} type="number" min={0} step="1" value={nueva.precio_venta}
                  onChange={(e) => setNueva({ ...nueva, precio_venta: e.target.value })} />
                <input className={inputCls} value={nueva.codigo_barras}
                  onChange={(e) => setNueva({ ...nueva, codigo_barras: e.target.value })} placeholder="Opcional" />
                <span></span>
                <button
                  onClick={agregar}
                  disabled={creando}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {creando ? '…' : 'Agregar'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl shrink-0">
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
