export default function Topbar({ selectedCustomer, logout }) {
  return (
    <header className="border-b border-slate-200/70 bg-white/90 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">TelcoX</p>
          <h1 className="text-3xl font-semibold text-slate-900">Portal de Operaciones TelcoX</h1>
          <p className="mt-2 text-sm text-slate-700">Monitorea servicios, facturación y experiencia de cliente con estilo corporativo.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-[28px] border border-slate-200/80 bg-slate-100/90 px-4 py-3 text-sm text-slate-700 shadow-lg shadow-cyan-500/10">
            <p className="font-semibold text-slate-900">{selectedCustomer?.full_name ?? 'Usuario demo'}</p>
            <p className="text-slate-700">{selectedCustomer?.email ?? 'demo@telcox.com'}</p>
          </div>
          <button onClick={logout} className="rounded-[28px] border border-cyan-500/30 bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/15 transition hover:bg-cyan-500">
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  )
}
