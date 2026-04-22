'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { BookOpen, Eye, EyeOff } from 'lucide-react'
import { signIn } from './actions'
import { useState } from 'react'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
    >
      {pending ? 'Ingresando...' : 'Ingresar'}
    </button>
  )
}

export default function LoginForm({
  mostrarRegistro,
  errorParam,
}: {
  mostrarRegistro: boolean
  errorParam?: string
}) {
  const [state, formAction] = useFormState(signIn, { error: null })
  const [verPass, setVerPass] = useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950">
      <div className="w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Libra</h1>
            <p className="text-slate-500 text-sm mt-1">Sistema de gestión comercial</p>
          </div>

          {/* Error de link inválido */}
          {errorParam === 'link_invalido' && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
              El link de recuperación expiró o es inválido. Pedí uno nuevo.
            </div>
          )}

          {/* Formulario de login */}
          <form action={formAction} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu@email.com"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={verPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
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
              <div className="flex justify-end mt-1">
                <Link
                  href="/login/recuperar"
                  className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </div>

            {state?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
                {state.error}
              </div>
            )}

            <SubmitButton />
          </form>

          {/* Link de registro — solo si no hay admin */}
          {mostrarRegistro && (
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-500">
                ¿Primera vez?{' '}
                <Link
                  href="/registro"
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Registrá tu negocio acá
                </Link>
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Libra &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
