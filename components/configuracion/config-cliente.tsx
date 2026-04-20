'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Building2, CreditCard, Tag,
  Plus, Pencil, Trash2, Check, X,
  ChevronDown, ChevronRight, Save,
  ShieldCheck, ShieldOff, UserPlus, Upload,
} from 'lucide-react'
import type { Perfil, NegocioConfig, PermisosEmpleado } from '@/lib/permisos'
import { PERMISOS_DEFAULT, TODOS_LOS_METODOS } from '@/lib/permisos'
import {
  crearEmpleado,
  actualizarPermisosEmpleado,
  toggleActivoEmpleado,
  guardarNegocio,
  guardarMetodosPago,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from '@/app/(dashboard)/configuracion/actions'

// ─── Tipos ────────────────────────────────────────────────────────────────

type ConfigTab = 'usuarios' | 'negocio' | 'metodos' | 'categorias'

interface Categoria {
  id: string
  nombre: string
}

interface Props {
  empleados:  Perfil[]
  negocio:    NegocioConfig | null
  categorias: Categoria[]
  adminId:    string
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const LABEL_PRODUCTOS: Record<string, string> = {
  sin_acceso: 'Sin acceso',
  ver:        'Solo ver',
  editar:     'Ver y editar',
}
const LABEL_COMPRAS: Record<string, string> = {
  sin_acceso: 'Sin acceso',
  ver:        'Solo ver',
  registrar:  'Registrar compras',
}

// ─── Componente principal ─────────────────────────────────────────────────

export default function ConfigCliente({ empleados: init, negocio: initNegocio, categorias: initCats, adminId }: Props) {
  const router     = useRouter()
  const [tab, setTab] = useState<ConfigTab>('usuarios')

  const tabs: { id: ConfigTab; label: string; icon: React.ElementType }[] = [
    { id: 'usuarios',   label: 'Usuarios',          icon: Users      },
    { id: 'negocio',    label: 'Datos del negocio',  icon: Building2  },
    { id: 'metodos',    label: 'Métodos de pago',    icon: CreditCard },
    { id: 'categorias', label: 'Categorías',         icon: Tag        },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Configuración</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'usuarios'   && <TabUsuarios   empleados={init}          adminId={adminId} onRefresh={() => router.refresh()} />}
      {tab === 'negocio'    && <TabNegocio    negocio={initNegocio}                       onRefresh={() => router.refresh()} />}
      {tab === 'metodos'    && <TabMetodos    negocio={initNegocio}                       onRefresh={() => router.refresh()} />}
      {tab === 'categorias' && <TabCategorias categorias={initCats}                       onRefresh={() => router.refresh()} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: USUARIOS
// ══════════════════════════════════════════════════════════════════════════

function TabUsuarios({ empleados, adminId, onRefresh }: { empleados: Perfil[]; adminId: string; onRefresh: () => void }) {
  const [showCreate, setShowCreate]     = useState(false)
  const [expanded, setExpanded]         = useState<string | null>(null)
  const [isPending, startTransition]    = useTransition()
  const [errMsg, setErrMsg]             = useState<string | null>(null)
  const [okMsg, setOkMsg]               = useState<string | null>(null)

  function toggleExpand(id: string) {
    setExpanded(prev => prev === id ? null : id)
  }

  async function handleToggleActivo(perfil: Perfil) {
    if (perfil.id === adminId) return // no desactivar al propio admin
    startTransition(async () => {
      const res = await toggleActivoEmpleado(perfil.id, !perfil.activo)
      if (res.error) { setErrMsg(res.error); return }
      onRefresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{empleados.length} usuario{empleados.length !== 1 ? 's' : ''} registrado{empleados.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Agregar empleado
        </button>
      </div>

      {errMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg flex items-center justify-between">
          {errMsg}
          <button onClick={() => setErrMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {okMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded-lg flex items-center justify-between">
          {okMsg}
          <button onClick={() => setOkMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Lista de empleados */}
      <div className="space-y-2">
        {empleados.map(perfil => (
          <div key={perfil.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Fila principal */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Avatar inicial */}
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-slate-600">
                  {perfil.nombre.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {perfil.nombre}
                  {perfil.id === adminId && (
                    <span className="ml-2 text-xs text-slate-400">(vos)</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 truncate">{perfil.email}</p>
              </div>

              {/* Badges */}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                perfil.rol === 'admin'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {perfil.rol === 'admin' ? 'Admin' : 'Empleado'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                perfil.activo
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-600'
              }`}>
                {perfil.activo ? 'Activo' : 'Inactivo'}
              </span>

              {/* Acciones */}
              {perfil.rol !== 'admin' && (
                <>
                  <button
                    onClick={() => handleToggleActivo(perfil)}
                    disabled={isPending}
                    title={perfil.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                      perfil.activo
                        ? 'text-slate-400 hover:bg-red-50 hover:text-red-500'
                        : 'text-slate-400 hover:bg-green-50 hover:text-green-600'
                    }`}
                  >
                    {perfil.activo ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => toggleExpand(perfil.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
                  >
                    {expanded === perfil.id
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />}
                  </button>
                </>
              )}
            </div>

            {/* Panel de permisos expandible */}
            {expanded === perfil.id && perfil.rol !== 'admin' && (
              <PermisosPanel
                perfil={perfil}
                onSave={() => { onRefresh(); setOkMsg('Permisos actualizados') }}
                onError={setErrMsg}
              />
            )}
          </div>
        ))}
      </div>

      {/* Modal crear empleado */}
      {showCreate && (
        <ModalCrearEmpleado
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); setOkMsg('Empleado creado correctamente'); onRefresh() }}
          onError={setErrMsg}
        />
      )}
    </div>
  )
}

// ─── Panel de permisos ────────────────────────────────────────────────────

function PermisosPanel({ perfil, onSave, onError }: {
  perfil:  Perfil
  onSave:  () => void
  onError: (msg: string) => void
}) {
  const [p, setP] = useState<PermisosEmpleado>({ ...PERMISOS_DEFAULT, ...perfil.permisos })
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const res = await actualizarPermisosEmpleado(perfil.id, p)
      if (res.error) { onError(res.error); return }
      onSave()
    })
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Permisos de {perfil.nombre}</p>

      <div className="grid grid-cols-2 gap-3">
        {/* Dashboard */}
        <PermisoToggle
          label="Dashboard"
          descripcion="Ver métricas y gráficos"
          checked={p.dashboard}
          onChange={v => setP(prev => ({ ...prev, dashboard: v }))}
        />

        {/* Ventas / POS */}
        <PermisoToggle
          label="Punto de Venta"
          descripcion="Cobrar ventas desde el POS"
          checked={p.ventas}
          onChange={v => setP(prev => ({ ...prev, ventas: v }))}
        />

        {/* Proveedores */}
        <PermisoToggle
          label="Proveedores"
          descripcion="Ver lista de proveedores"
          checked={p.proveedores}
          onChange={v => setP(prev => ({ ...prev, proveedores: v }))}
        />

        {/* Reportes */}
        <PermisoToggle
          label="Reportes"
          descripcion="Ver reportes y estadísticas"
          checked={p.reportes}
          onChange={v => setP(prev => ({ ...prev, reportes: v }))}
        />

        {/* Productos (3 opciones) */}
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-sm font-medium text-slate-700">Productos</p>
          <p className="text-xs text-slate-400 mb-2">Catálogo de productos</p>
          <select
            value={p.productos}
            onChange={e => setP(prev => ({ ...prev, productos: e.target.value as PermisosEmpleado['productos'] }))}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700"
          >
            {Object.entries(LABEL_PRODUCTOS).map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
        </div>

        {/* Compras (3 opciones) */}
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-sm font-medium text-slate-700">Compras</p>
          <p className="text-xs text-slate-400 mb-2">Registro de compras a proveedores</p>
          <select
            value={p.compras}
            onChange={e => setP(prev => ({ ...prev, compras: e.target.value as PermisosEmpleado['compras'] }))}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white text-slate-700"
          >
            {Object.entries(LABEL_COMPRAS).map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={save}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Guardando…' : 'Guardar permisos'}
        </button>
      </div>
    </div>
  )
}

function PermisoToggle({ label, descripcion, checked, onChange }: {
  label:       string
  descripcion: string
  checked:     boolean
  onChange:    (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
        checked
          ? 'bg-blue-50 border-blue-200'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 ${
        checked ? 'bg-blue-600' : 'bg-slate-200'
      }`}>
        {checked && <Check className="w-3 h-3 text-white" />}
      </div>
      <div>
        <p className={`text-sm font-medium ${checked ? 'text-blue-700' : 'text-slate-700'}`}>{label}</p>
        <p className="text-xs text-slate-400">{descripcion}</p>
      </div>
    </button>
  )
}

// ─── Modal crear empleado ─────────────────────────────────────────────────

function ModalCrearEmpleado({ onClose, onCreated, onError }: {
  onClose:   () => void
  onCreated: () => void
  onError:   (msg: string) => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await crearEmpleado(formData)
      if (res.error) { onError(res.error); return }
      onCreated()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Agregar empleado</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input
              name="nombre"
              required
              placeholder="Ej: María García"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              required
              placeholder="empleado@gmail.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña temporal</label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">El empleado podrá cambiarla después de iniciar sesión.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Creando…' : 'Crear empleado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: NEGOCIO
// ══════════════════════════════════════════════════════════════════════════

function TabNegocio({ negocio, onRefresh }: { negocio: NegocioConfig | null; onRefresh: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg]                = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [preview, setPreview]        = useState<string>(negocio?.logo_url ?? '')
  const fileRef                      = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await guardarNegocio(formData)
      if (res.error) { setMsg({ type: 'err', text: res.error }); return }
      setMsg({ type: 'ok', text: 'Datos guardados correctamente' })
      onRefresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      {msg && (
        <div className={`text-sm px-4 py-2.5 rounded-lg flex items-center justify-between ${
          msg.type === 'ok'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {msg.text}
          <button type="button" onClick={() => setMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la librería</label>
        <input
          name="nombre"
          defaultValue={negocio?.nombre ?? ''}
          required
          placeholder="Ej: Librería El Saber"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
        <input
          name="direccion"
          defaultValue={negocio?.direccion ?? ''}
          placeholder="Ej: Av. Corrientes 1234, CABA"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
        <input
          name="telefono"
          defaultValue={negocio?.telefono ?? ''}
          placeholder="Ej: +54 11 1234-5678"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Logo</label>
        <div className="flex items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Logo"
              className="w-16 h-16 rounded-lg object-contain border border-slate-200 bg-white"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
              <Upload className="w-6 h-6 text-slate-400" />
            </div>
          )}
          <div>
            <input
              ref={fileRef}
              name="logo"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) setPreview(URL.createObjectURL(file))
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50"
            >
              Subir imagen
            </button>
            <p className="text-xs text-slate-400 mt-1">PNG, JPG o SVG. Máx 2MB.</p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        <Save className="w-4 h-4" />
        {isPending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: MÉTODOS DE PAGO
// ══════════════════════════════════════════════════════════════════════════

function TabMetodos({ negocio, onRefresh }: { negocio: NegocioConfig | null; onRefresh: () => void }) {
  const activos = negocio?.metodos_pago ?? ['efectivo', 'transferencia', 'debito', 'credito']
  const [seleccionados, setSeleccionados] = useState<string[]>(activos)
  const [isPending, startTransition]      = useTransition()
  const [msg, setMsg]                     = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function toggle(id: string) {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  function save() {
    if (seleccionados.length === 0) {
      setMsg({ type: 'err', text: 'Debe haber al menos un método de pago activo' })
      return
    }
    startTransition(async () => {
      const res = await guardarMetodosPago(seleccionados)
      if (res.error) { setMsg({ type: 'err', text: res.error }); return }
      setMsg({ type: 'ok', text: 'Métodos de pago actualizados' })
      onRefresh()
    })
  }

  return (
    <div className="max-w-md space-y-4">
      <p className="text-sm text-slate-500">
        Seleccioná los métodos que aparecen disponibles en el Punto de Venta.
      </p>

      {msg && (
        <div className={`text-sm px-4 py-2.5 rounded-lg flex items-center justify-between ${
          msg.type === 'ok'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {msg.text}
          <button onClick={() => setMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="space-y-2">
        {TODOS_LOS_METODOS.map(({ id, nombre }) => {
          const activo = seleccionados.includes(id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                activo
                  ? 'bg-blue-50 border-blue-300 text-blue-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                activo ? 'bg-blue-600' : 'bg-slate-200'
              }`}>
                {activo && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm font-medium">{nombre}</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={save}
        disabled={isPending}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        <Save className="w-4 h-4" />
        {isPending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: CATEGORÍAS
// ══════════════════════════════════════════════════════════════════════════

function TabCategorias({ categorias: init, onRefresh }: { categorias: Categoria[]; onRefresh: () => void }) {
  const [categorias, setCategorias]   = useState<Categoria[]>(init)
  const [editId, setEditId]           = useState<string | null>(null)
  const [editNombre, setEditNombre]   = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [showAdd, setShowAdd]         = useState(false)
  const [isPending, startTransition]  = useTransition()
  const [errMsg, setErrMsg]           = useState<string | null>(null)

  function startEdit(cat: Categoria) {
    setEditId(cat.id)
    setEditNombre(cat.nombre)
  }

  function cancelEdit() {
    setEditId(null)
    setEditNombre('')
  }

  function handleEdit(cat: Categoria) {
    if (!editNombre.trim()) return
    startTransition(async () => {
      const res = await actualizarCategoria(cat.id, editNombre)
      if (res.error) { setErrMsg(res.error); return }
      setCategorias(prev => prev.map(c => c.id === cat.id ? { ...c, nombre: editNombre.trim() } : c))
      cancelEdit()
      onRefresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await eliminarCategoria(id)
      if (res.error) { setErrMsg(res.error); return }
      setCategorias(prev => prev.filter(c => c.id !== id))
      onRefresh()
    })
  }

  function handleAdd() {
    if (!nuevoNombre.trim()) return
    startTransition(async () => {
      const res = await crearCategoria(nuevoNombre)
      if (res.error) { setErrMsg(res.error); return }
      setNuevoNombre('')
      setShowAdd(false)
      onRefresh()
    })
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{categorias.length} categoría{categorias.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva categoría
        </button>
      </div>

      {errMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg flex items-center justify-between">
          {errMsg}
          <button onClick={() => setErrMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Formulario nueva categoría */}
      {showAdd && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={nuevoNombre}
            onChange={e => setNuevoNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAdd(false) }}
            placeholder="Nombre de la categoría"
            className="flex-1 border border-blue-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            disabled={isPending || !nuevoNombre.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowAdd(false); setNuevoNombre('') }}
            className="px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Lista de categorías */}
      <div className="space-y-1.5">
        {categorias.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            No hay categorías. Agregá una para empezar.
          </p>
        )}
        {categorias.map(cat => (
          <div
            key={cat.id}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg"
          >
            {editId === cat.id ? (
              <>
                <input
                  autoFocus
                  value={editNombre}
                  onChange={e => setEditNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleEdit(cat); if (e.key === 'Escape') cancelEdit() }}
                  className="flex-1 border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none"
                />
                <button
                  onClick={() => handleEdit(cat)}
                  disabled={isPending}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={cancelEdit}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-slate-700">{cat.nombre}</span>
                <button
                  onClick={() => startEdit(cat)}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(cat.id)}
                  disabled={isPending}
                  className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
