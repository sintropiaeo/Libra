'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { BookOpen, Eye, EyeOff } from 'lucide-react'
import { registrar } from './actions'
import { useState } from 'react'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
    >
      {pending ? 'Creando cuenta...' : 'Crear cuenta y comenzar'}
    </button>
  )
}

export default function RegistroForm() {
  const [state, formAction] = useFormState(registrar, { error: null })
  const [verPass, setVerPass] = useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950">
      <div className="w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Bienvenido a Libra</h1>
            <p className="text-slate-500 text-sm mt-1 text-center">
              Creá tu cuenta de administrador para empezar
            </p>
          </div>

          <form action={formAction} className="space-y-4">

            {/* Nombre completo */}
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-slate-700 mb-1.5">
                Nombre completo
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                required
                placeholder="Juan Pérez"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="tu@email.com"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={verPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-2.5 pr-11 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setVerPass(!verPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {verPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Nombre del negocio */}
            <div>
              <label htmlFor="nombre_negocio" className="block text-sm font-medium text-slate-700 mb-1.5">
                Nombre de la librería / negocio
              </label>
              <input
                id="nombre_negocio"
                name="nombre_negocio"
                type="text"
                required
                placeholder="Librería El Libro Feliz"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <p className="text-xs text-slate-400 mt-1">
                Aparecerá en los tickets de venta
              </p>
            </div>

            {state?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
                {state.error}
              </div>
            )}

            <SubmitButton />
          </form>

          <div className="mt-5 text-center">
            <Link href="/login" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
              ← Volver al inicio de sesión
            </Link>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Libra &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
