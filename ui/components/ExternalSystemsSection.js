import { useMemo, useState } from 'react'

const systemTabs = [
  {
    key: 'overview',
    icon: 'BSS',
    label: 'Resumen',
    description: 'Flujo integrado',
  },
  {
    key: 'sri',
    icon: 'SRI',
    label: 'SRI',
    description: 'Facturas',
  },
  {
    key: 'paymentGateway',
    icon: 'PSP',
    label: 'Gateway PSP',
    description: 'Pagos',
  },
  {
    key: 'networkOss',
    icon: 'OSS',
    label: 'OSS/NMS',
    description: 'Altas',
  },
  {
    key: 'kyc',
    icon: 'ID',
    label: 'Identidad',
    description: 'KYC',
  },
  {
    key: 'notificationGateway',
    icon: 'MSG',
    label: 'Notificaciones',
    description: 'Alertas',
  },
]

const flowItems = [
  { key: 'sri', icon: 'SRI', label: 'Factura', target: 'SRI', tone: 'emerald' },
  { key: 'paymentGateway', icon: 'PSP', label: 'Pago', target: 'Gateway PSP', tone: 'indigo' },
  { key: 'networkOss', icon: 'OSS', label: 'Alta', target: 'OSS/NMS', tone: 'sky' },
  { key: 'kyc', icon: 'ID', label: 'KYC', target: 'Identidad', tone: 'amber' },
  { key: 'notificationGateway', icon: 'MSG', label: 'Alerta', target: 'Gateway Notif.', tone: 'cyan' },
]

const toneMap = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  sky: 'border-sky-200 bg-sky-50 text-sky-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
}

function isOnline(data) {
  return data?.health?.status === 'ok'
}

function Badge({ text, tone = 'slate' }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${toneMap[tone] || toneMap.slate}`}>
      {text || 'N/A'}
    </span>
  )
}

function TextIcon({ children, tone = 'slate' }) {
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border text-[11px] font-black tracking-[0.08em] ${toneMap[tone] || toneMap.slate}`}>
      {children}
    </span>
  )
}

function MetricCard({ label, value, tone = 'slate' }) {
  return (
    <div className={`rounded-[20px] border px-4 py-3 ${toneMap[tone] || toneMap.slate}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  )
}

function DataRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200/70 py-2 last:border-0">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className={`text-right text-xs font-bold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value ?? '-'}</span>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-medium text-slate-500">
      {text}
    </div>
  )
}

function SystemHeader({ icon, title, subtitle, online, tone }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <TextIcon tone={tone}>{icon}</TextIcon>
        <div>
          <h3 className="text-xl font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
        </div>
      </div>
      <Badge text={online ? 'Online' : 'Offline'} tone={online ? 'emerald' : 'rose'} />
    </div>
  )
}

function SriPanel({ data }) {
  const authorizations = data?.authorizations || []
  const authorized = authorizations.filter((item) => item.status === 'authorized').length

  return (
    <SystemPanel>
      <SystemHeader icon="SRI" title="SRI Ecuador" subtitle="Autorizacion de comprobantes electronicos" online={isOnline(data)} tone="emerald" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <MetricCard label="Comprobantes" value={authorizations.length} tone="slate" />
        <MetricCard label="Autorizados" value={authorized} tone="emerald" />
      </div>
      <RecordsTitle title="Ultimas autorizaciones" />
      {authorizations.length === 0 ? (
        <EmptyState text="Sin autorizaciones registradas en esta sesion." />
      ) : (
        <div className="space-y-3">
          {authorizations.slice(-5).reverse().map((item, index) => (
            <RecordCard key={item.sri_access_key || index}>
              <DataRow label="Factura" value={item.invoice_id} />
              <DataRow label="Monto" value={`${item.currency || 'USD'} ${Number(item.amount || 0).toFixed(2)}`} />
              <DataRow label="Estado" value={<Badge text={item.status} tone="emerald" />} />
              <DataRow label="Clave SRI" value={item.sri_access_key?.slice(0, 32)} mono />
            </RecordCard>
          ))}
        </div>
      )}
    </SystemPanel>
  )
}

function PaymentGatewayPanel({ data, onTestCharge, isLoading }) {
  const transactions = data?.transactions || []
  const approved = transactions.filter((item) => item.status === 'approved').length
  const declined = transactions.filter((item) => item.status === 'declined' || item.status === 'refunded').length

  return (
    <SystemPanel>
      <SystemHeader icon="PSP" title="Gateway PSP" subtitle="Procesamiento de pagos con gateway externo mock" online={isOnline(data)} tone="indigo" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Transacciones" value={transactions.length} tone="slate" />
        <MetricCard label="Aprobadas" value={approved} tone="emerald" />
        <MetricCard label="Declinadas" value={declined} tone="rose" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onTestCharge('success')}
          disabled={isLoading}
          className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Test cobro exitoso
        </button>
        <button
          type="button"
          onClick={() => onTestCharge('fail')}
          disabled={isLoading}
          className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Test cobro fallido
        </button>
      </div>
      <RecordsTitle title="Ultimas transacciones" />
      {transactions.length === 0 ? (
        <EmptyState text="Sin transacciones registradas en esta sesion." />
      ) : (
        <div className="space-y-3">
          {transactions.slice(-5).reverse().map((item) => (
            <RecordCard key={item.transaction_id}>
              <DataRow label="Transaccion" value={item.transaction_id?.slice(0, 28)} mono />
              <DataRow label="Gateway" value={item.gateway || 'telcox-psp-mock'} />
              <DataRow label="Monto" value={`${item.currency || 'USD'} ${Number(item.amount || 0).toFixed(2)}`} />
              <DataRow label="Estado" value={<Badge text={item.status} tone={item.status === 'approved' ? 'emerald' : 'rose'} />} />
              {item.authorization_code && <DataRow label="Autorizacion" value={item.authorization_code} mono />}
            </RecordCard>
          ))}
        </div>
      )}
    </SystemPanel>
  )
}

function NetworkOssPanel({ data }) {
  const orders = data?.orders || []
  const networkStatus = data?.networkStatus
  const regions = networkStatus?.regions || {}
  const active = orders.filter((item) => item.status === 'active').length

  return (
    <SystemPanel>
      <SystemHeader icon="OSS" title="Network OSS / NMS" subtitle="Provisionamiento tecnico y estado de red" online={isOnline(data)} tone="sky" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <MetricCard label="Ordenes de red" value={orders.length} tone="slate" />
        <MetricCard label="Activaciones" value={active} tone="sky" />
      </div>
      <RecordsTitle title="Regiones monitoreadas" />
      {Object.keys(regions).length === 0 ? (
        <EmptyState text="Sin estado regional disponible." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(regions).map(([city, info]) => (
            <RecordCard key={city}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black capitalize text-slate-950">{city}</p>
                <Badge text={info.status} tone={info.status === 'operational' ? 'emerald' : 'amber'} />
              </div>
              <DataRow label="Cobertura 5G" value={`${info['5g_coverage_pct'] || 0}%`} />
              <DataRow label="Latencia" value={info.latency_ms ? `${info.latency_ms} ms` : '-'} />
            </RecordCard>
          ))}
        </div>
      )}
      <RecordsTitle title="Ultimas ordenes de red" />
      {orders.length === 0 ? (
        <EmptyState text="Sin ordenes de red registradas." />
      ) : (
        <div className="space-y-3">
          {orders.slice(-4).reverse().map((item) => (
            <RecordCard key={item.reference_id}>
              <DataRow label="Referencia" value={item.reference_id?.slice(0, 28)} mono />
              <DataRow label="Operacion" value={item.operation} />
              <DataRow label="Nodo" value={item.network_node} />
              <DataRow label="Estado" value={<Badge text={item.status} tone={item.status === 'active' ? 'emerald' : 'slate'} />} />
            </RecordCard>
          ))}
        </div>
      )}
    </SystemPanel>
  )
}

function KycPanel({ data }) {
  const verifications = data?.verifications || []
  const completed = verifications.filter((item) => item.status === 'completed').length
  const review = verifications.filter((item) => item.status === 'manual_review').length
  const rejected = verifications.filter((item) => item.status === 'rejected').length

  return (
    <SystemPanel>
      <SystemHeader icon="ID" title="KYC Identity" subtitle="Validacion documental, biometria y prueba de vida" online={isOnline(data)} tone="amber" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Aprobadas" value={completed} tone="emerald" />
        <MetricCard label="Revision" value={review} tone="amber" />
        <MetricCard label="Rechazadas" value={rejected} tone="rose" />
      </div>
      <RecordsTitle title="Ultimas verificaciones" />
      {verifications.length === 0 ? (
        <EmptyState text="Sin verificaciones registradas en esta sesion." />
      ) : (
        <div className="space-y-3">
          {verifications.slice(-5).reverse().map((item) => (
            <RecordCard key={item.verification_id}>
              <DataRow label="Verificacion" value={item.verification_id?.slice(0, 28)} mono />
              <DataRow label="Documento" value={item.document_check} />
              <DataRow label="Face match" value={item.face_match} />
              <DataRow label="Liveness" value={item.liveness} />
              <DataRow label="Estado" value={<Badge text={item.status} tone={item.status === 'completed' ? 'emerald' : item.status === 'manual_review' ? 'amber' : 'rose'} />} />
              {item.similarity_score && <DataRow label="Similitud" value={`${(item.similarity_score * 100).toFixed(1)}%`} />}
            </RecordCard>
          ))}
        </div>
      )}
    </SystemPanel>
  )
}

function NotificationGatewayPanel({ data }) {
  const messages = data?.messages || []
  const stats = data?.stats
  const byChannel = stats?.by_channel || {}

  return (
    <SystemPanel>
      <SystemHeader icon="MSG" title="Notification Gateway" subtitle="Mensajes SMS, email y push contra proveedores mock" online={isOnline(data)} tone="cyan" />
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <MetricCard label="SMS" value={byChannel.sms || 0} tone="cyan" />
        <MetricCard label="Email" value={byChannel.email || 0} tone="sky" />
        <MetricCard label="Push" value={byChannel.push || 0} tone="indigo" />
      </div>
      <RecordsTitle title="Ultimos mensajes entregados" />
      {messages.length === 0 ? (
        <EmptyState text="Sin mensajes registrados en esta sesion." />
      ) : (
        <div className="space-y-3">
          {messages.slice(-5).reverse().map((item) => (
            <RecordCard key={item.message_id}>
              <DataRow label="Mensaje" value={item.message_id?.slice(0, 28)} mono />
              <DataRow label="Canal" value={item.channel} />
              <DataRow label="Evento" value={item.event_type || item.channel} />
              <DataRow label="Proveedor" value={item.provider || '-'} />
              <DataRow label="Estado" value={<Badge text={item.status} tone={item.status === 'delivered' || item.status === 'sent' ? 'emerald' : 'rose'} />} />
              <p className="mt-3 truncate rounded-2xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                {item.message || 'Sin contenido'}
              </p>
            </RecordCard>
          ))}
        </div>
      )}
    </SystemPanel>
  )
}

function SystemPanel({ children }) {
  return (
    <section className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-200/30">
      {children}
    </section>
  )
}

function RecordCard({ children }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {children}
    </div>
  )
}

function RecordsTitle({ title }) {
  return <h4 className="mt-6 mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{title}</h4>
}

function OverviewPanel({ externalData, onlineCount, setActiveTab }) {
  return (
    <SystemPanel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">Mapa de consumo BSS</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">BSS TelcoX hacia sistemas externos</h3>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
            Cada operacion del portal dispara una integracion externa y deja evidencia operacional en su tab.
          </p>
        </div>
        <MetricCard label="Disponibilidad" value={`${onlineCount}/5`} tone={onlineCount >= 4 ? 'emerald' : onlineCount >= 2 ? 'amber' : 'rose'} />
      </div>

      <div className="mt-6 grid gap-3 xl:grid-cols-5">
        {flowItems.map((item) => {
          const online = isOnline(externalData[item.key])
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              <div className="flex items-center justify-between gap-3">
                <TextIcon tone={item.tone}>{item.icon}</TextIcon>
                <Badge text={online ? 'Online' : 'Offline'} tone={online ? 'emerald' : 'rose'} />
              </div>
              <p className="mt-4 text-sm font-black text-slate-950">{item.label}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">BSS {'->'} {item.target}</p>
            </button>
          )
        })}
      </div>
    </SystemPanel>
  )
}

export default function ExternalSystemsSection({ externalData, onRefreshExternal, onTestCharge, isLoading }) {
  const [activeTab, setActiveTab] = useState('overview')

  const onlineCount = useMemo(() => {
    if (!externalData) return 0
    return flowItems.filter((item) => isOnline(externalData[item.key])).length
  }, [externalData])

  if (!externalData) {
    return (
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-sm font-semibold text-slate-500">Cargando datos de sistemas externos</p>
        <button
          type="button"
          onClick={onRefreshExternal}
          className="mt-4 rounded-2xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-cyan-500/20 transition hover:bg-cyan-500"
        >
          Cargar sistemas externos
        </button>
      </div>
    )
  }

  const panels = {
    overview: <OverviewPanel externalData={externalData} onlineCount={onlineCount} setActiveTab={setActiveTab} />,
    sri: <SriPanel data={externalData.sri} />,
    paymentGateway: <PaymentGatewayPanel data={externalData.paymentGateway} onTestCharge={onTestCharge} isLoading={isLoading} />,
    networkOss: <NetworkOssPanel data={externalData.networkOss} />,
    kyc: <KycPanel data={externalData.kyc} />,
    notificationGateway: <NotificationGatewayPanel data={externalData.notificationGateway} />,
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/20">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">Monitoreo externo</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">Sistemas Externos Integrados</h2>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
              Datos en tiempo real de los 5 sistemas externos que el BSS TelcoX consume activamente.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className={`h-2.5 w-2.5 rounded-full ${onlineCount >= 4 ? 'bg-emerald-500' : onlineCount >= 2 ? 'bg-amber-500' : 'bg-rose-500'}`} />
              <span className="text-sm font-black text-slate-800">{onlineCount}/5 sistemas online</span>
            </div>
            <button
              type="button"
              onClick={onRefreshExternal}
              disabled={isLoading}
              className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isLoading ? 'Cargando' : 'Actualizar externos'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {systemTabs.map((tab) => {
            const online = tab.key === 'overview' ? onlineCount >= 4 : isOnline(externalData[tab.key])
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-[20px] border px-3 py-3 text-left transition ${
                  active
                    ? 'border-cyan-300 bg-cyan-50 shadow-md shadow-cyan-500/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-900">{tab.icon}</span>
                  <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                </div>
                <p className="mt-2 text-sm font-black text-slate-950">{tab.label}</p>
                <p className="text-xs font-medium text-slate-500">{tab.description}</p>
              </button>
            )
          })}
        </div>
      </section>

      {panels[activeTab]}
    </div>
  )
}
