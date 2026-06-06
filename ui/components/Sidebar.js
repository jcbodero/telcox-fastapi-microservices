export default function Sidebar({ tabs, activeTab, setActiveTab, counts, onRefresh, isLoading }) {
  return (
    <aside className="space-y-6 rounded-[32px] border border-slate-200/80 bg-white/90 p-5 shadow-xl shadow-cyan-900/10">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Secciones</h2>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${activeTab === tab ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-600 hover:bg-slate-200 hover:text-white'}`}
          >
            {tab === 'dashboard' && 'Dashboard'}
            {tab === 'catalog' && 'Catálogo'}
            {tab === 'billing' && 'Facturación'}
            {tab === 'notifications' && 'Notificaciones'}
            {tab === 'account' && 'Cuenta'}
            {tab === 'external' && 'Sistemas Externos'}
          </button>
        ))}
      </div>

      <div className="rounded-[28px] bg-slate-100/80 p-4 text-sm text-slate-600 shadow-inner shadow-slate-200/10">
        <h3 className="font-semibold text-slate-900">Resumen rápido</h3>
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
            <span>Clientes</span>
            <strong className="text-white">{counts.customers}</strong>
          </div>
          <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
            <span>Servicios</span>
            <strong className="text-white">{counts.services}</strong>
          </div>
          <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
            <span>Facturas</span>
            <strong className="text-white">{counts.invoices}</strong>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span>Pagos</span>
            <strong className="text-white">{counts.payments}</strong>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] bg-slate-100/80 p-4 text-sm text-slate-600 shadow-inner shadow-slate-200/10">
        <h3 className="font-semibold text-slate-900">Acciones</h3>
        <button onClick={onRefresh} disabled={isLoading} className="mt-4 w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700">
          Actualizar datos
        </button>
      </div>
    </aside>
  )
}
