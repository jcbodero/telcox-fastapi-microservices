export default function DashboardSection({ activeServices, auditEvents }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Servicios Activos</h2>
            <p className="mt-1 text-sm text-slate-500">Monitorea el consumo de datos, saldo y estado en tiempo real.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {activeServices.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-500">
              No tienes ningún servicio activo. Suscríbete a un plan desde el catálogo.
            </div>
          ) : (
            activeServices.map((service) => {
              const pct = service.data_limit_gb > 0 
                ? Math.min(100, Math.round((service.data_used_gb / service.data_limit_gb) * 100)) 
                : 0
              
              return (
                <div key={service.id} className="rounded-[28px] border border-slate-200/70 bg-slate-50/80 p-6 shadow-sm transition hover:shadow-md">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 capitalize">
                        {service.product_id.replace('prd-', '').replace('-', ' ')}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {service.id}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                      service.status === 'active' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {service.status === 'active' ? '● Activo' : '● Suspendido'}
                    </span>
                  </div>

                  <div className="mt-6 space-y-4">
                    {/* Data usage indicator */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>Consumo de datos</span>
                        <span>{service.data_used_gb} GB / {service.data_limit_gb} GB</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500" 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-right text-[10px] text-slate-500 font-medium">
                        Has consumido el {pct}% de tu plan
                      </p>
                    </div>

                    {/* Balance */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                      <span className="text-slate-600 font-medium">Saldo pendiente</span>
                      <span className={`text-base font-bold ${service.balance > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                        ${parseFloat(service.balance || 0).toFixed(2)} USD
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <h2 className="text-xl font-semibold text-slate-900">Últimos eventos de auditoría</h2>
        <div className="mt-5 space-y-3">
          {auditEvents.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No se registran eventos de auditoría recientes.</p>
          ) : (
            auditEvents.slice(0, 4).map((event) => (
              <div key={event.id} className="rounded-[24px] border border-slate-200/70 bg-slate-50 p-4 transition hover:bg-slate-100/50">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-bold text-slate-900 uppercase tracking-wide">{event.action}</p>
                  <p className="text-xs text-slate-400">{new Date(event.created_at).toLocaleTimeString()}</p>
                </div>
                <p className="mt-1 text-xs text-slate-600 font-mono">Recurso: {event.resource}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
