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
} from 'lucide-react'
import { signOut } from '@/app/login/actions'

const navItems = [
  { label: 'Dashboard',   href: '/dashboard',   icon: LayoutDashboard },
  { label: 'Productos',   href: '/productos',   icon: Package },
  { label: 'Ventas',      href: '/ventas/nueva', icon: ShoppingCart },
  { label: 'Proveedores', href: '/proveedores', icon: Truck },
  { label: 'Compras',     href: '/compras',     icon: ShoppingBag },
  { label: 'Reportes',    href: '/reportes',    icon: BarChart3 },
]

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()

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
        {navItems.map(({ label, href, icon: Icon }) => {
          // Para ventas, activar en cualquier sub-ruta de /ventas
          const baseHref = href === '/ventas/nueva' ? '/ventas' : href
          const isActive =
            pathname === href ||
            (baseHref !== '/dashboard' && pathname.startsWith(baseHref))

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Usuario + Cerrar sesión */}
      <div className="px-3 py-3 border-t border-slate-800">
        <div className="px-3 py-2 mb-1">
          <p className="text-slate-500 text-xs font-medium truncate">{userEmail}</p>
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
