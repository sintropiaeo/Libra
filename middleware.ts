import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // No escribir lógica entre createServerClient y getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const rutasPublicas = ['/login', '/registro', '/auth']
  const esPublica = rutasPublicas.some(r => pathname.startsWith(r))

  // Sin sesión → redirigir a /login
  if (!user && !esPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Con sesión en /login → redirigir al dashboard
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Protección para cajeros — usa app_metadata.rol (disponible en el JWT,
  // sin necesidad de un query adicional a la DB)
  // Se establece en crearEmpleado() al crear el usuario con auth.admin.createUser()
  if (user) {
    const rolMetadata = user.app_metadata?.rol as string | undefined
    if (rolMetadata === 'cajero') {
      const rutasRestringidas = ['/proveedores', '/compras', '/configuracion', '/reportes', '/super-admin']
      if (rutasRestringidas.some(r => pathname.startsWith(r))) {
        const url = request.nextUrl.clone()
        url.pathname = '/ventas/nueva'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
