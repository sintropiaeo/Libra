// ─── Tipos ─────────────────────────────────────────────────────────────────

export type Rol = 'admin' | 'empleado'

export interface PermisosEmpleado {
  dashboard:    boolean
  productos:    'ver' | 'editar' | 'sin_acceso'
  ventas:       boolean
  proveedores:  boolean
  compras:      'ver' | 'registrar' | 'sin_acceso'
  reportes:     boolean
}

export interface Perfil {
  id:          string
  user_id:     string
  nombre:      string
  email:       string
  rol:         Rol
  permisos:    PermisosEmpleado
  activo:      boolean
  created_at:  string
}

export interface NegocioConfig {
  id:             string
  nombre:         string
  direccion:      string
  telefono:       string
  logo_url:       string
  metodos_pago:   string[]
}

// ─── Defaults ──────────────────────────────────────────────────────────────

export const PERMISOS_DEFAULT: PermisosEmpleado = {
  dashboard:   true,
  productos:   'ver',
  ventas:      true,
  proveedores: false,
  compras:     'sin_acceso',
  reportes:    false,
}

export const TODOS_LOS_METODOS: { id: string; nombre: string }[] = [
  { id: 'efectivo',      nombre: 'Efectivo'      },
  { id: 'transferencia', nombre: 'Transferencia' },
  { id: 'debito',        nombre: 'Débito'        },
  { id: 'credito',       nombre: 'Crédito'       },
]

// ─── Comprobadores de acceso ───────────────────────────────────────────────

type Seccion =
  | 'dashboard'
  | 'productos'
  | 'ventas'
  | 'proveedores'
  | 'compras'
  | 'reportes'
  | 'configuracion'

export function tieneAcceso(perfil: Perfil | null, seccion: Seccion): boolean {
  if (!perfil || !perfil.activo) return false
  if (perfil.rol === 'admin') return true
  if (seccion === 'configuracion') return false

  const p = perfil.permisos
  switch (seccion) {
    case 'dashboard':   return p.dashboard
    case 'ventas':      return p.ventas
    case 'proveedores': return p.proveedores
    case 'reportes':    return p.reportes
    case 'productos':   return p.productos !== 'sin_acceso'
    case 'compras':     return p.compras !== 'sin_acceso'
    default:            return false
  }
}

export function puedeEditarProductos(perfil: Perfil | null): boolean {
  if (!perfil) return false
  if (perfil.rol === 'admin') return true
  return perfil.permisos.productos === 'editar'
}

export function puedeRegistrarCompras(perfil: Perfil | null): boolean {
  if (!perfil) return false
  if (perfil.rol === 'admin') return true
  return perfil.permisos.compras === 'registrar'
}
