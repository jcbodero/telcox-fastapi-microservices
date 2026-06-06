export default function ActivityLog({ log, onClear }) {
  return (
    <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Actividad reciente</h2>
          <p className="mt-1 text-sm text-slate-700">Registro de eventos generados por acciones realizadas en el portal.</p>
        </div>
        <button onClick={onClear} className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-700">
          Limpiar registro
        </button>
      </div>
      <div className="mt-5 space-y-3">
        {log.length === 0 ? (
          <p className="text-sm text-slate-700">No hay registros aún.</p>
        ) : (
          log.map((entry, idx) => (
            <div key={idx} className="rounded-3xl border border-slate-200/70 bg-slate-100/90 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">{entry.message}</p>
              <p className="mt-1 text-xs text-slate-700">{new Date(entry.created_at).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
