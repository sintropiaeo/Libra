'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, ChevronRight, Phone, Mail, MapPin } from 'lucide-react'
import {
  crearProveedor,
  actualizarProveedor,
  toggleActivoProveedor,
} from '@/app/(dashboard)/proveedores/actions'

type Proveedor = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  direccion: string | null
  notas: string | null
  activo: boolean
  created_at: string
}

type FormValues = {
  nombre: string
  telefono: string
  email: string
  direccion: string
  notas: string
}

const FORM_EMPTY: FormValues = {
  nombre:    '',
  telefono:  '',
  email:     '',
  direccion: '',
  notas:     '',
}

export default function ProveedoresCliente({
  initialProveedores,
}: {
  initialProveedores: Proveedor[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [busqueda, setBusqueda]           = useState('')
  const [soloActivos, setSoloActivos]     = useState(true)
  const [modalAbierto, setModalAbierto]   = useState(false)
  const [editando, setEditando]           = useState<Proveedor | null>(null)
  const [form, setForm]                   = useState<FormValues>(FORM_EMPTY)
  const [guardando, setGuardando]         = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  // ─── Filtrado ──────────────────────────────────────────────────────────────
  const proveedoresFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return initialProveedores.filter((p) => {
      if (soloActivos && !p.activo) return false
      if (!q) return true
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.telefono?.includes(q)
      )
    })
  }, [initialProveedores, busqueda, soloActivos])

  // ─── Modal helpers ─────────────────────────────────────────────────────────
  function abrirNuevo() {
    setEditando(null)
    setForm(FORM_EMPTY)
    setError(null)
    setModalAbierto(true)
  }

  function abrirEditar(p: Proveedor) {
    setEditando(p)
    setForm({
      nombre:    p.nombre,
      telefono:  p.telefono  ?? '',
      email:     p.email     ?? '',
      direccion: p.direccion ?? '',
      notas:     p.notas     ?? '',
    })
    setError(null)
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setEditando(null)
    setError(null)
  }

  // ─── Guardar ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    setGuardando(true)
    setError(null)

    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, v))

    const result = editando
      ? await actualizarProveedor(editando.id, fd)
      : await crearProveedor(fd)

    setGuardando(false)

    if (result?.error) {
      setError(result.error)
      return
    }

    cerrarModal()
    startTransition(() => router.refresh())
  }

  // ─── Toggle activo ─────────────────────────────────────────────────────────
  async function handleToggle(e: React.MouseEvent, p: Proveedor) {
    e.preventDefault()
    e.stopPropagation()
    await toggleActivoProveedor(p.id, !p.activo)
    startTransition(() => router.refresh())
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proveedores</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {initialProveedores.filter((p) => p.activo).length} activos ·{' '}
            {initialProveedores.length} en total
          </p>
        </div>
        <button
          onClick={abrirNuevo}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo proveedor
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          Solo activos
        </label>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {proveedoresFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-slate-500 mb-1">
              {initialProveedores.length === 0
                ? 'No hay proveedores registrados'
                : 'Sin resultados para esa búsqueda'}
            </p>
            {initialProveedores.length === 0 && (
              <button
                onClick={abrirNuevo}
                className="mt-3 text-sm text-blue-600 hover:underline font-medium"
              >
                Agregar primer proveedor
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {proveedoresFiltrados.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/proveedores/${p.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
                >
                  {/* Avatar inicial */}
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-slate-600 font-semibold text-sm">
                    {p.nombre.charAt(0).toUpperCase()}
                  </div>

                  {/* Datos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800 truncate">{p.nombre}</p>
                      {!p.activo && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-0.5">
                      {p.telefono && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Phone className="w-3 h-3" />
                          {p.telefono}
                        </span>
                      )}
                      {p.email && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Mail className="w-3 h-3" />
                          {p.email}
                        </span>
                      )}
                      {p.direccion && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="w-3 h-3" />
                          {p.direccion}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.preventDefault()}>
                    <button
                      onClick={(e) => { e.preventDefault(); abrirEditar(p) }}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={(e) => handleToggle(e, p)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                        p.activo
                          ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={cerrarModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header modal */}
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">
                {editando ? 'Editar proveedor' : 'Nuevo proveedor'}
              </h2>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

                {/* Nombre */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nombre del proveedor"
                    autoFocus
                  />
                </div>

                {/* Teléfono + Email */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="11 1234-5678"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="proveedor@email.com"
                    />
                  </div>
                </div>

                {/* Dirección */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Av. Corrientes 1234, CABA"
                  />
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
                  <textarea
                    value={form.notas}
                    onChange={(e) => setForm({ ...form, notas: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Observaciones, condiciones de pago, etc."
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
              </div>

              {/* Footer modal */}
              <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60"
                >
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
