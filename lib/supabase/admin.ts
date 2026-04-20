import { createClient } from '@supabase/supabase-js'

/**
 * Cliente con service_role key — bypasa RLS.
 * Solo usar en Server Actions/Server Components del lado del servidor.
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
 */
export function createAdminClient() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY en .env.local'
    )
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  })
}
