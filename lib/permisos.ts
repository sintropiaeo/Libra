// ─── Tipos ─────────────────────────────────────────────────────────────────

export type Rol = 'super_admin' | 'admin' | 'cajero' | 'empleado'

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
  negocio_id:  string
  created_at:  string
}

export interface NegocioConfig {
  id:                   string
  nombre:               string
  direccion:            string
  telefono:             string
  logo_url:             string
  metodos_pago:         string[]
  imprimir_ticket_auto: boolean
  tamano_ticket:        '58mm' | '80mm'
  sonido_escaneo:       boolean
}

export interface ConfiguracionTicket {
  id:                 string
  nombre_comercio:    string
  direccion:          string
  cuit:               string
  condicion_iva:      string
  telefono:           string | null
  logo_url:           string | null
  ancho_papel:        '58mm' | '80mm'
  mostrar_logo:       boolean
  mostrar_cuit:       boolean
  mostrar_telefono:   boolean
  mostrar_direccion:  boolean
  mensaje_pie:        string | null
  mostrar_vendedor:   boolean
  copias_a_imprimir:  number
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

export type Seccion =
  | 'dashboard'
  | 'productos'
  | 'ventas'
  | 'proveedores'
  | 'compras'
  | 'reportes'
  | 'configuracion'
  | 'comprobantes'
  | 'caja'
  | 'super_admin'

export function esSuperAdmin(perfil: Perfil | null): boolean {
  return perfil?.rol === 'super_admin'
}

export function tieneAcceso(perfil: Perfil | null, seccion: Seccion): boolean {
  if (!perfil || !perfil.activo) return false

  if (perfil.rol === 'super_admin') return true

  if (perfil.rol === 'admin') return seccion !== 'super_admin'

  // cajero: permisos fijos, no configurables
  if (perfil.rol === 'cajero') {
    switch (seccion) {
      case 'dashboard':     return true
      case 'ventas':        return true
      case 'productos':     return true
      case 'comprobantes':  return true
      case 'caja':          return true
      default:              return false
    }
  }

  // empleado (rol legacy): permisos configurables via JSONB
  if (seccion === 'configuracion' || seccion === 'super_admin') return false

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
  if (perfil.rol === 'super_admin' || perfil.rol === 'admin') return true
  if (perfil.rol === 'cajero') return false
  return perfil.permisos.productos === 'editar'
}

export function puedeRegistrarCompras(perfil: Perfil | null): boolean {
  if (!perfil) return false
  if (perfil.rol === 'super_admin' || perfil.rol === 'admin') return true
  if (perfil.rol === 'cajero') return false
  return perfil.permisos.compras === 'registrar'
}

export function esCajero(perfil: Perfil | null): boolean {
  return perfil?.rol === 'cajero'
}

export function esAdmin(perfil: Perfil | null): boolean {
  return perfil?.rol === 'admin' || perfil?.rol === 'super_admin'
}
