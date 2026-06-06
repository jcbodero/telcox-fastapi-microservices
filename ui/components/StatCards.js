export default function StatCards({ selectedCustomer, activeServices, invoices, payments }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-5 shadow-lg shadow-slate-200/10">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-700">Cliente activo</p>
        <p className="mt-4 text-3xl font-semibold text-slate-900">{selectedCustomer?.full_name ?? 'Demo TelcoX'}</p>
        <p className="mt-2 text-sm text-slate-700">{selectedCustomer?.email ?? 'No hay cliente cargado'}</p>
      </div>
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-5 shadow-lg shadow-slate-200/10">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-700">Servicios</p>
        <p className="mt-4 text-3xl font-semibold text-slate-900">{activeServices.length}</p>
        <p className="mt-2 text-sm text-slate-700">Servicios activos</p>
      </div>
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-5 shadow-lg shadow-slate-200/10">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-700">Facturas</p>
        <p className="mt-4 text-3xl font-semibold text-slate-900">{invoices.length}</p>
        <p className="mt-2 text-sm text-slate-700">Facturas totales</p>
      </div>
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-5 shadow-lg shadow-slate-200/10">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-700">Pagos</p>
        <p className="mt-4 text-3xl font-semibold text-slate-900">{payments.length}</p>
        <p className="mt-2 text-sm text-slate-700">Transacciones</p>
      </div>
    </div>
  )
}
