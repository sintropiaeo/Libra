export const metadata = {
  title: 'Dashboard — Libra',
}

const stats = [
  { label: 'Ventas hoy',       value: '$0',  sub: '0 transacciones' },
  { label: 'Productos',        value: '20',  sub: '2 con stock bajo' },
  { label: 'Ventas del mes',   value: '$0',  sub: 'vs mes anterior' },
  { label: 'Proveedores',      value: '3',   sub: 'activos' },
]

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Resumen general de la librería</p>
      </div>

      {/* Tarjetas de stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500 font-medium">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
            <p className="text-xs text-slate-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Placeholder actividad */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Actividad reciente</h2>
        <p className="text-slate-400 text-sm text-center py-10">
          Las secciones se irán habilitando a medida que se construya la app.
        </p>
      </div>
    </div>
  )
}
