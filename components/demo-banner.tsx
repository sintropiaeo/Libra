'use client'

import { useState, useEffect } from 'react'
import { Zap, X } from 'lucide-react'

const SESSION_KEY = 'libra_demo_banner_dismissed'

export default function DemoBanner({ isDemo }: { isDemo: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isDemo) return
    const dismissed = sessionStorage.getItem(SESSION_KEY)
    if (!dismissed) setVisible(true)
  }, [isDemo])

  if (!visible) return null

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-amber-100 border-b border-amber-300 text-amber-900 text-sm">
      <div className="flex items-center gap-2 ml-64">
        <Zap className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="font-medium">Estás en modo demo</span>
        <span className="text-amber-700 hidden sm:inline">
          — los datos son ficticios y se resetean cada domingo a las 5am
        </span>
      </div>
      <button
        onClick={dismiss}
        aria-label="Cerrar banner demo"
        className="p-1 rounded hover:bg-amber-200 transition-colors text-amber-700"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
