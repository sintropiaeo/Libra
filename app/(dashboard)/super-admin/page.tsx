import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { esSuperAdmin } from '@/lib/permisos'
import type { Perfil } from '@/lib/permisos'
import { ShieldAlert, Users, ShoppingCart, Package, ShoppingBag, TrendingUp, Database, Zap } from 'lucide-react'

export const metadata = { title: 'Super Admin — Libra' }

const ARS = (v: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v)

export default async function SuperAdminPage() {
  // Auth check con cliente normal
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: perfilData } = await supabase
    .from('perfiles').select('*').eq('user_id', user.id).single()
  if (!esSuperAdmin(perfilData as Perfil | null)) redirect('/dashboard')

  // Stats globales — admin client para bypasear RLS y ver TODOS los negocios
  const admin = createAdminClient()

  const [
    { count: totalPerfiles },
    { count: totalProductos },
    { count: totalVentas },
    { count: totalCompras },
    { data: ventasData },
    { data: comprasData },
    { data: negocios },
  ] = await Promise.all([
    admin.from('perfiles').select('*', { count: 'exact', head: true }).neq('rol', 'super_admin'),
    admin.from('productos').select('*', { count: 'exact', head: true }),
    admin.from('ventas').select('*', { count: 'exact', head: true }),
    admin.from('compras_proveedor').select('*', { count: 'exact', head: true }),
    admin.from('ventas').select('total'),
    admin.from('compras_proveedor').select('total'),
    admin.from('negocios').select('id, nombre, is_demo, created_at').order('created_at'),
  ])

  // Stats por negocio
  const negociosConStats = await Promise.all(
    (negocios ?? []).map(async (neg) => {
      const [
        { count: productos },
        { count: ventas },
        { count: usuarios },
        { data: vData },
      ] = await Promise.all([
        admin.from('productos').select('*', { count: 'exact', head: true }).eq('negocio_id', neg.id),
        admin.from('ventas').select('*', { count: 'exact', head: true }).eq('negocio_id', neg.id),
        admin.from('perfiles').select('*', { count: 'exact', head: true }).eq('negocio_id', neg.id).neq('rol', 'super_admin'),
        admin.from('ventas').select('total').eq('negocio_id', neg.id),
      ])
      const facturado = (vData ?? []).reduce((s, v) => s + Number(v.total), 0)
      return { ...neg, productos, ventas, usuarios, facturado }
    })
  )

  const totalFacturado = (ventasData ?? []).reduce((s, v) => s + Number(v.total), 0)
  const totalInvertido = (comprasData ?? []).reduce((s, v) => s + Number(v.total), 0)

  const stats = [
    { label: 'Usuarios registrados',    value: String(totalPerfiles ?? 0),  icon: Users,        bg: 'bg-blue-100',    color: 'text-blue-600'    },
    { label: 'Productos en sistema',    value: String(totalProductos ?? 0), icon: Package,      bg: 'bg-emerald-100', color: 'text-emerald-600' },
    { label: 'Ventas registradas',      value: String(totalVentas ?? 0),    icon: ShoppingCart, bg: 'bg-violet-100',  color: 'text-violet-600'  },
    { label: 'Compras registradas',     value: String(totalCompras ?? 0),   icon: ShoppingBag,  bg: 'bg-amber-100',   color: 'text-amber-600'   },
    { label: 'Total facturado',         value: ARS(totalFacturado),         icon: TrendingUp,   bg: 'bg-emerald-100', color: 'text-emerald-600' },
    { label: 'Total invertido',         value: ARS(totalInvertido),         icon: Database,     bg: 'bg-red-100',     color: 'text-red-500'     },
  ]

  return (
    <div className="p-8 space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Super Admin</h1>
          <p className="text-slate-500 text-sm mt-0.5">Vista global del sistema · solo visible para vos</p>
        </div>
      </div>

      {/* Stats globales */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Estadísticas globales del sistema
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {stats.map(({ label, value, icon: Icon, bg, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5 truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Negocios */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Negocios en el sistema ({negociosConStats.length})
        </h2>
        {negociosConStats.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
            No hay negocios registrados
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">
                  <th className="px-5 py-3">Negocio</th>
                  <th className="px-5 py-3 text-right">Usuarios</th>
                  <th className="px-5 py-3 text-right">Productos</th>
                  <th className="px-5 py-3 text-right">Ventas</th>
                  <th className="px-5 py-3 text-right">Facturado</th>
                  <th className="px-5 py-3">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {negociosConStats.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        {n.nombre}
                        {n.is_demo && (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                            <Zap className="w-3 h-3" /> demo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{n.usuarios ?? 0}</td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{(n.productos ?? 0).toLocaleString('es-AR')}</td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{n.ventas ?? 0}</td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{ARS(n.facturado)}</td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {new Date(n.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
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
