'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, X } from 'lucide-react'

const PASOS = [
  'Ir a Configuración y completar los datos del negocio',
  'Crear las categorías de tus productos',
  'Cargar tus productos (podés importarlos desde Excel)',
  '¡Listo para vender!',
]

export default function BienvenidaModal({ perfilId }: { perfilId: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const key = `libra_bienvenida_${perfilId}`
    if (!localStorage.getItem(key)) setVisible(true)
  }, [perfilId])

  function cerrar() {
    localStorage.setItem(`libra_bienvenida_${perfilId}`, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">¡Bienvenido a Libra! 👋</h2>
            <p className="text-slate-500 text-sm mt-1">
              Para empezar, te recomendamos seguir estos pasos:
            </p>
          </div>
          <button
            onClick={cerrar}
            className="text-slate-400 hover:text-slate-600 transition-colors ml-3 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {PASOS.map((paso, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                i === PASOS.length - 1
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-blue-100 text-blue-600'
              }`}>
                {i === PASOS.length - 1
                  ? <CheckCircle className="w-4 h-4" />
                  : i + 1}
              </div>
              <p className={`text-sm pt-0.5 ${
                i === PASOS.length - 1
                  ? 'text-emerald-700 font-semibold'
                  : 'text-slate-700'
              }`}>
                {paso}
              </p>
            </div>
          ))}

          <button
            onClick={cerrar}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            Entendido, ¡vamos!
          </button>
        </div>
      </div>
    </div>
  )
}
