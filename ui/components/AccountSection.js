export default function AccountSection({ selectedCustomer, orders, auditEvents }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <h2 className="text-xl font-semibold text-slate-900">Cuenta y seguridad</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200/70 bg-slate-100/90 p-5">
            <p className="text-sm text-slate-700">Cliente actual</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">{selectedCustomer?.full_name ?? 'Ninguno'}</p>
            <p className="mt-1 text-sm text-slate-700">{selectedCustomer?.email ?? 'demo@telcox.com'}</p>
          </div>
          <div className="rounded-[28px] border border-slate-200/70 bg-slate-100/90 p-5">
            <p className="text-sm text-slate-700">Autenticación</p>
            <p className="mt-3 text-lg font-semibold text-slate-900">OAuth2 + PKCE</p>
            <p className="mt-2 text-sm text-slate-700">En producción, implemente Authorization Code + PKCE para SSO y acceso móvil seguro.</p>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <h2 className="text-xl font-semibold text-slate-900">Resumen de operaciones</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200/70 bg-slate-100/90 p-4">
            <p className="text-sm text-slate-700">Órdenes de provisión</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{orders.length}</p>
          </div>
          <div className="rounded-[28px] border border-slate-200/70 bg-slate-100/90 p-4">
            <p className="text-sm text-slate-700">Eventos de auditoría</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{auditEvents.length}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
