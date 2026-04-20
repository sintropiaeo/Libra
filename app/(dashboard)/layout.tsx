import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import type { Perfil } from '@/lib/permisos'
import { PERMISOS_DEFAULT } from '@/lib/permisos'
import { signOut } from '@/app/login/actions'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let { data: perfilData } = await supabase
    .from('perfiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Si no tiene perfil todavía, crearlo automáticamente
  if (!perfilData) {
    const { count } = await supabase
      .from('perfiles')
      .select('*', { count: 'exact', head: true })

    const esAdmin = (count ?? 0) === 0

    const { data: nuevo } = await supabase
      .from('perfiles')
      .insert({
        user_id: user.id,
        nombre:  user.email!.split('@')[0],
        email:   user.email!,
        rol:     esAdmin ? 'admin' : 'empleado',
        permisos: esAdmin ? {} : PERMISOS_DEFAULT,
        activo:  true,
      })
      .select()
      .single()

    perfilData = nuevo
  }

  const perfil = perfilData as Perfil | null

  // Cuenta desactivada → mostrar mensaje (sin redirect loop)
  if (!perfil || !perfil.activo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-red-500 text-xl">✕</span>
          </div>
          <div>
            <p className="text-slate-800 font-semibold">Cuenta desactivada</p>
            <p className="text-slate-500 text-sm mt-1">
              Tu cuenta fue desactivada por el administrador.
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full py-2.5 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar userEmail={user.email!} perfil={perfil} />
      <div className="flex-1 ml-64 min-w-0">
        {children}
      </div>
    </div>
  )
}
