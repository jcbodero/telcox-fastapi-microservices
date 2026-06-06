export default function DashboardSection({ activeServices, auditEvents }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Visión general</h2>
            <p className="mt-1 text-sm text-slate-700">Control de estado de servicios, auditoría y operaciones.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {activeServices.map((service) => (
            <div key={service.id} className="rounded-[28px] border border-slate-200/70 bg-slate-100/90 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{service.product_id || service.id}</h3>
                  <p className="mt-1 text-sm text-slate-700">Cliente: {service.customer_id}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{service.status}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <p>Datos: {service.data_used_gb ?? 0}GB / {service.data_limit_gb ?? 0}GB</p>
                <p>Saldo: {service.balance ?? 0}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <h2 className="text-xl font-semibold text-slate-900">Últimos eventos de auditoría</h2>
        <div className="mt-5 space-y-3">
          {auditEvents.slice(0, 4).map((event) => (
            <div key={event.id} className="rounded-[28px] border border-slate-200/70 bg-slate-100/90 p-4">
              <p className="text-sm font-semibold text-slate-900">{event.action}</p>
              <p className="mt-1 text-sm text-slate-700">Recurso: {event.resource}</p>
              <p className="mt-2 text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
