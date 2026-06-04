'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Perfil, Seccion } from '@/lib/permisos'
import { tieneAcceso, puedeEditarProductos, puedeRegistrarCompras, esAdmin, esCajero } from '@/lib/permisos'

interface Permissions {
  loading:       boolean
  perfil:        Perfil | null
  rol:           string | null
  negocioId:     string | null
  puedeVer:      (seccion: Seccion) => boolean
  puedeEditar:   (seccion: Seccion) => boolean
  esAdmin:       boolean
  esCajero:      boolean
}

export function usePermissions(): Permissions {
  const [perfil, setPerfil]   = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      supabase
        .from('perfiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          setPerfil(data as Perfil | null)
          setLoading(false)
        })
    })
  }, [])

  return {
    loading,
    perfil,
    rol:       perfil?.rol ?? null,
    negocioId: perfil?.negocio_id ?? null,
    esAdmin:   esAdmin(perfil),
    esCajero:  esCajero(perfil),

    puedeVer: (seccion) => tieneAcceso(perfil, seccion),

    puedeEditar: (seccion) => {
      if (!perfil) return false
      if (seccion === 'productos')  return puedeEditarProductos(perfil)
      if (seccion === 'compras')    return puedeRegistrarCompras(perfil)
      // cajero solo puede ver ventas, no editar registros históricos
      if (perfil.rol === 'cajero')  return seccion === 'ventas'
      return tieneAcceso(perfil, seccion)
    },
  }
}
