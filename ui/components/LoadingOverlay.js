export default function LoadingOverlay({ show, label = 'Cargando' }) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/20 px-6 backdrop-blur-sm">
      <div className="flex min-w-[220px] items-center gap-4 rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-slate-900 shadow-telecard">
        <span className="h-9 w-9 animate-spin rounded-full border-4 border-cyan-100 border-t-cyan-600" />
        <div>
          <p className="text-sm font-bold">{label}</p>
          <p className="text-xs font-medium text-slate-500">Un momento por favor</p>
        </div>
      </div>
    </div>
  )
}
