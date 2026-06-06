const labels = {
  dashboard: 'Dashboard',
  catalog: 'Catalogo',
  billing: 'Facturacion',
  external: 'Sistemas externos',
}

export default function Sidebar({ tabs, activeTab, setActiveTab }) {
  return (
    <aside className="space-y-6 rounded-[32px] border border-slate-200/80 bg-white/90 p-5 shadow-xl shadow-cyan-900/10">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Operacion</h2>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${activeTab === tab ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
          >
            {labels[tab] || tab}
          </button>
        ))}
      </div>
    </aside>
  )
}
