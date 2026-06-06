const currency = (value) => `$${Number(value || 0).toFixed(2)}`

const pct = (value, max) => {
  if (!max || Number(max) <= 0) return 0
  return Math.min(100, Math.round((Number(value || 0) / Number(max)) * 100))
}

function KpiCard({ label, value, detail, tone = 'cyan' }) {
  const toneMap = {
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
      <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${toneMap[tone]}`}>
        {label}
      </span>
      <p className="mt-4 text-3xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-xs font-medium text-slate-500">{detail}</p>
    </div>
  )
}

function BarChart({ rows }) {
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>{row.label}</span>
            <span>{row.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.max(4, row.percent)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Donut({ percent, label, detail }) {
  return (
    <div className="flex items-center gap-5">
      <div
        className="grid h-32 w-32 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(#0891b2 ${percent}%, #e2e8f0 0)` }}
      >
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-inner">
          <span className="text-2xl font-bold text-slate-950">{percent}%</span>
        </div>
      </div>
      <div>
        <p className="text-base font-bold text-slate-950">{label}</p>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>
      </div>
    </div>
  )
}

function ServiceCard({ service, orders }) {
  const usage = pct(service.data_used_gb, service.data_limit_gb)
  const order = orders.find(
    (item) =>
      item.product_id === service.product_id &&
      item.customer_id === service.customer_id &&
      item.network_reference_id,
  )

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-950">{service.product_id}</p>
          <p className="mt-1 text-[11px] font-mono text-slate-500">{service.id}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${service.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {service.status || 'pending'}
        </span>
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
          <span>Datos</span>
          <span>{service.data_used_gb} / {service.data_limit_gb} GB</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-cyan-600" style={{ width: `${usage}%` }} />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs">
        <span className="font-semibold text-slate-500">Saldo</span>
        <span className="font-bold text-slate-950">{currency(service.balance)}</span>
      </div>
      {order && (
        <p className="mt-3 rounded-xl bg-cyan-50 px-3 py-2 text-[11px] font-mono text-cyan-700">
          OSS {order.network_node || 'node'} / {order.network_reference_id}
        </p>
      )}
    </div>
  )
}

function ActivationPanel({ catalog, selectedCustomer, createProvisioningOrder, isLoading }) {
  const plans = catalog.filter((product) => product.type === 'mobile_plan' || product.type === 'broadband_plan')
  const addons = catalog.filter((product) => product.type === 'package_upgrade' || product.type === 'addon_service')
  const recommended = [...plans.slice(0, 3), ...addons.slice(0, 2)]

  return (
    <div className="rounded-[32px] border border-cyan-200/70 bg-white p-6 shadow-lg shadow-cyan-900/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Activar suscripcion y aprovisionar</h2>
          <p className="mt-1 text-sm text-slate-500">
            Crea la orden BSS, aprovisiona contra OSS y actualiza el servicio activo del cliente.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
          {selectedCustomer?.id || 'sin cliente'}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {recommended.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => createProvisioningOrder(product)}
            disabled={isLoading || !selectedCustomer}
            className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
              {product.type === 'package_upgrade' ? 'Aprovisionar paquete' : product.type === 'addon_service' ? 'Activar adicional' : 'Activar plan'}
            </span>
            <p className="mt-2 text-sm font-bold text-slate-950">{product.name}</p>
            <p className="mt-1 text-xs text-slate-500">{currency(product.monthly_price)} / mes</p>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function DashboardSection({
  selectedCustomer,
  activeServices,
  auditEvents,
  orders = [],
  invoices = [],
  payments = [],
  catalog = [],
  createProvisioningOrder,
  isLoading,
}) {
  const activeCount = activeServices.filter((service) => service.status === 'active').length
  const completedOrders = orders.filter((order) => order.status === 'completed').length
  const pendingInvoices = invoices.filter((invoice) => invoice.status !== 'paid').length
  const approvedPayments = payments.filter((payment) => payment.status === 'approved').length
  const totalData = activeServices.reduce((sum, service) => sum + Number(service.data_limit_gb || 0), 0)
  const usedData = activeServices.reduce((sum, service) => sum + Number(service.data_used_gb || 0), 0)
  const usagePct = pct(usedData, totalData)
  const pendingBalance = activeServices.reduce((sum, service) => sum + Number(service.balance || 0), 0)

  const orderRows = [
    { label: 'Ordenes completadas', value: completedOrders, percent: orders.length ? pct(completedOrders, orders.length) : 0, color: 'bg-emerald-500' },
    { label: 'Facturas pendientes', value: pendingInvoices, percent: invoices.length ? pct(pendingInvoices, invoices.length) : 0, color: 'bg-amber-500' },
    { label: 'Pagos aprobados', value: approvedPayments, percent: payments.length ? pct(approvedPayments, payments.length) : 0, color: 'bg-cyan-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-200/70 bg-white p-6 shadow-lg shadow-slate-200/20">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">Dashboard operacional</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Vista de suscripciones y red</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Controla activaciones, consumo, facturacion y ordenes de aprovisionamiento desde una sola vista.
            </p>
          </div>
          <div className="rounded-[20px] bg-slate-50 px-4 py-3 text-sm">
            <p className="font-bold text-slate-950">{selectedCustomer?.full_name || 'Cliente no seleccionado'}</p>
            <p className="text-xs text-slate-500">{selectedCustomer?.email || 'Sin correo registrado'}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Servicios activos" value={activeCount} detail={`${activeServices.length} servicios registrados`} tone="emerald" />
          <KpiCard label="Datos usados" value={`${usedData.toFixed(1)} GB`} detail={`${totalData.toFixed(1)} GB contratados`} tone="cyan" />
          <KpiCard label="Saldo pendiente" value={currency(pendingBalance)} detail={`${pendingInvoices} facturas por atender`} tone="amber" />
          <KpiCard label="Provisioning" value={completedOrders} detail={`${orders.length} ordenes BSS`} tone="slate" />
        </div>
      </div>

      <ActivationPanel
        catalog={catalog}
        selectedCustomer={selectedCustomer}
        createProvisioningOrder={createProvisioningOrder}
        isLoading={isLoading}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <div className="rounded-[32px] border border-slate-200/70 bg-white p-6 shadow-lg shadow-slate-200/20">
          <h2 className="text-xl font-bold text-slate-950">Consumo del plan</h2>
          <div className="mt-5">
            <Donut
              percent={usagePct}
              label={`${usedData.toFixed(1)} GB consumidos`}
              detail={`${totalData.toFixed(1)} GB disponibles entre todos los servicios activos.`}
            />
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200/70 bg-white p-6 shadow-lg shadow-slate-200/20">
          <h2 className="text-xl font-bold text-slate-950">Operacion BSS</h2>
          <div className="mt-5">
            <BarChart rows={orderRows} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <div className="rounded-[32px] border border-slate-200/70 bg-white p-6 shadow-lg shadow-slate-200/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Servicios aprovisionados</h2>
              <p className="mt-1 text-sm text-slate-500">Estado tecnico y referencia OSS de cada suscripcion.</p>
            </div>
            <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">{activeServices.length}</span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {activeServices.length === 0 ? (
              <div className="col-span-full rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No hay servicios activos. Activa un plan desde el panel superior para crear la orden y aprovisionarla.
              </div>
            ) : (
              activeServices.map((service) => <ServiceCard key={service.id} service={service} orders={orders} />)
            )}
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200/70 bg-white p-6 shadow-lg shadow-slate-200/20">
          <h2 className="text-xl font-bold text-slate-950">Auditoria reciente</h2>
          <div className="mt-5 space-y-3">
            {auditEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">{event.action || 'evento'}</p>
                <p className="mt-1 text-[11px] font-mono text-slate-500">{event.resource || event.resource_id || event.id}</p>
              </div>
            ))}
            {auditEvents.length === 0 && <p className="text-sm text-slate-500">No hay eventos recientes.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
