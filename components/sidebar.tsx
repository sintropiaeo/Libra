'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  ShoppingBag,
  BarChart3,
  LogOut,
  BookOpen,
  Settings,
  ShieldAlert,
} from 'lucide-react'
import { signOut } from '@/app/login/actions'
import type { Perfil } from '@/lib/permisos'
import { tieneAcceso, esSuperAdmin } from '@/lib/permisos'

const NAV_ITEMS = [
  { label: 'Dashboard',   href: '/dashboard',    icon: LayoutDashboard, seccion: 'dashboard'   as const },
  { label: 'Productos',   href: '/productos',    icon: Package,          seccion: 'productos'   as const },
  { label: 'Ventas',      href: '/ventas/nueva', icon: ShoppingCart,     seccion: 'ventas'      as const },
  { label: 'Proveedores', href: '/proveedores',  icon: Truck,            seccion: 'proveedores' as const },
  { label: 'Compras',     href: '/compras',      icon: ShoppingBag,      seccion: 'compras'     as const },
  { label: 'Reportes',    href: '/reportes',     icon: BarChart3,        seccion: 'reportes'    as const },
]

export default function Sidebar({
  userEmail,
  perfil,
}: {
  userEmail: string
  perfil: Perfil
}) {
  const pathname   = usePathname()
  const superAdmin = esSuperAdmin(perfil)

  const visibleItems = NAV_ITEMS.filter((item) =>
    tieneAcceso(perfil, item.seccion)
  )

  function isActive(href: string) {
    const base = href === '/ventas/nueva' ? '/ventas' : href
    return (
      pathname === href ||
      (base !== '/dashboard' && pathname.startsWith(base))
    )
  }

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
    }`

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 flex flex-col z-10">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-white font-bold text-base leading-none">Libra</h1>
            <p className="text-slate-400 text-xs mt-0.5">Gestión comercial</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href} className={linkClass(isActive(href))}>
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </Link>
        ))}

        {/* Configuración (admin y super_admin) */}
        {(perfil.rol === 'admin' || superAdmin) && (
          <>
            <div className="my-2 border-t border-slate-800" />
            <Link
              href="/configuracion"
              className={linkClass(pathname.startsWith('/configuracion'))}
            >
              <Settings className="w-5 h-5 shrink-0" />
              Configuración
            </Link>
          </>
        )}

        {/* Super Admin — invisible para todos los demás */}
        {superAdmin && (
          <>
            <div className="my-2 border-t border-slate-700" />
            <Link
              href="/super-admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith('/super-admin')
                  ? 'bg-violet-600 text-white'
                  : 'text-violet-400 hover:bg-violet-900/40 hover:text-violet-200'
              }`}
            >
              <ShieldAlert className="w-5 h-5 shrink-0" />
              Super Admin
            </Link>
          </>
        )}
      </nav>

      {/* Usuario + Cerrar sesión */}
      <div className="px-3 py-3 border-t border-slate-800">
        <div className="px-3 py-2 mb-1">
          <p className="text-slate-200 text-xs font-semibold truncate">
            {perfil.nombre}
          </p>
          <p className="text-slate-500 text-xs truncate">{userEmail}</p>
          {/* Badge: super_admin se muestra como Administrador normal */}
          <span
            className={`inline-block text-xs px-1.5 py-0.5 rounded mt-1 font-medium ${
              perfil.rol === 'empleado'
                ? 'bg-slate-700 text-slate-400'
                : 'bg-blue-900/60 text-blue-300'
            }`}
          >
            {perfil.rol === 'empleado' ? 'Empleado' : 'Administrador'}
          </span>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  )
}
