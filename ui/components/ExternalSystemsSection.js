import { useState } from 'react'
import { buildUrl, fetchJson } from '../lib/serviceApi'

// ─── Status pill helper ────────────────────────────────────────────────────
function StatusPill({ online }) {
  return online
    ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />Online</span>
    : <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-rose-700"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />Offline</span>
}

// ─── Section wrapper ───────────────────────────────────────────────────────
function ExtCard({ title, subtitle, icon, accent, health, children }) {
  const online = health && health.status === 'ok'
  return (
    <div className="rounded-[28px] border border-slate-200/70 bg-white/95 p-5 shadow-lg shadow-slate-200/10 hover:shadow-telecard hover:border-telecom-300 transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-telecom-600 to-telecom-400 text-white text-lg shadow-sm shadow-telecom-500/10">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-[11px] text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>
        <StatusPill online={online} />
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

// ─── Small data row ────────────────────────────────────────────────────────
function DataRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200/60 py-1.5 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-[11px] font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  )
}

// ─── Badge ─────────────────────────────────────────────────────────────────
function Badge({ text, color }) {
  const map = {
    green: 'bg-emerald-100 text-emerald-800',
    red: 'bg-rose-100 text-rose-800',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-800',
    violet: 'bg-violet-100 text-violet-800',
    slate: 'bg-slate-100 text-slate-700',
  }
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[color] || map.slate}`}>{text}</span>
}

// ─── Payment Gateway Panel ─────────────────────────────────────────────────
function PaymentGatewayPanel({ data, onTestCharge }) {
  const { transactions = [], health } = data
  const approved = transactions.filter(t => t.status === 'approved').length
  const declined = transactions.filter(t => t.status === 'declined' || t.status === 'refunded').length

  return (
    <ExtCard title="Payment Gateway" subtitle="PSP Visa / Mastercard (mock)" icon="💳" accent="violet" health={health}>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/80 p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-slate-900">{transactions.length}</p>
          <p className="text-[10px] text-slate-500">Transacciones</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-emerald-700">{approved}</p>
          <p className="text-[10px] text-emerald-600">Aprobadas</p>
        </div>
        <div className="rounded-xl bg-rose-50 p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-rose-700">{declined}</p>
          <p className="text-[10px] text-rose-600">Declinadas</p>
        </div>
      </div>

      {transactions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Últimas transacciones</p>
          {transactions.slice(-3).reverse().map(txn => (
            <div key={txn.transaction_id} className="rounded-xl bg-white/90 p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-slate-500">{txn.transaction_id?.slice(0, 18)}…</span>
                <Badge text={txn.status} color={txn.status === 'approved' ? 'green' : txn.status === 'refunded' ? 'amber' : 'red'} />
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[11px] text-slate-600">{txn.gateway || 'telcox-psp-mock'}</span>
                <span className="font-semibold text-slate-900 text-xs">{txn.currency} {parseFloat(txn.amount || 0).toFixed(2)}</span>
              </div>
              {txn.authorization_code && (
                <p className="mt-1 font-mono text-[10px] text-violet-600">AUTH: {txn.authorization_code}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-[11px] text-slate-400 py-3">Sin transacciones en esta sesión</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => onTestCharge('success')}
          className="rounded-xl bg-telecom-500 px-3 py-2 text-[11px] font-bold text-white hover:bg-telecom-600 transition shadow-sm shadow-telecom-500/10"
        >
          Test cobro exitoso
        </button>
        <button
          onClick={() => onTestCharge('fail')}
          className="rounded-xl bg-rose-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-rose-500 transition shadow-sm shadow-rose-600/10"
        >
          Test cobro fallido
        </button>
      </div>
    </ExtCard>
  )
}

// ─── Network OSS Panel ─────────────────────────────────────────────────────
function NetworkOssPanel({ data }) {
  const { orders = [], networkStatus, health } = data
  const active = orders.filter(o => o.status === 'active').length
  const regions = networkStatus?.regions || {}

  return (
    <ExtCard title="Network OSS / NMS" subtitle="Gestión de red y provisión (mock)" icon="🗼" accent="blue" health={health}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/80 p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-slate-900">{orders.length}</p>
          <p className="text-[10px] text-slate-500">Órdenes de red</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-blue-700">{active}</p>
          <p className="text-[10px] text-blue-600">Activaciones</p>
        </div>
      </div>

      {networkStatus && (
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Estado de regiones</p>
          <div className="space-y-1.5">
            {Object.entries(regions).map(([city, info]) => (
              <div key={city} className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${info.status === 'operational' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-[11px] font-semibold text-slate-800 capitalize">{city}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">5G {info['5g_coverage_pct']}%</span>
                  <Badge text={info.status} color={info.status === 'operational' ? 'green' : 'amber'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Últimas órdenes de red</p>
          {orders.slice(-2).reverse().map(o => (
            <div key={o.reference_id} className="rounded-xl bg-white/80 p-3 shadow-sm">
              <DataRow label="Referencia" value={o.reference_id?.slice(0, 20)} mono />
              <DataRow label="Operación" value={o.operation} />
              <DataRow label="Nodo" value={o.network_node} />
              <DataRow label="Estado" value={<Badge text={o.status} color={o.status === 'active' ? 'green' : 'slate'} />} />
            </div>
          ))}
        </div>
      )}
    </ExtCard>
  )
}

// ─── KYC Identity Panel ────────────────────────────────────────────────────
function KycPanel({ data }) {
  const { verifications = [], health } = data
  const completed = verifications.filter(v => v.status === 'completed').length
  const rejected = verifications.filter(v => v.status === 'rejected').length
  const review = verifications.filter(v => v.status === 'manual_review').length

  return (
    <ExtCard title="KYC Identity" subtitle="Verificación documental y biométrica (mock)" icon="🪪" accent="amber" health={health}>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-emerald-50 p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-emerald-700">{completed}</p>
          <p className="text-[10px] text-emerald-600">Aprobadas</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-amber-700">{review}</p>
          <p className="text-[10px] text-amber-600">Revisión</p>
        </div>
        <div className="rounded-xl bg-rose-50 p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-rose-700">{rejected}</p>
          <p className="text-[10px] text-rose-600">Rechazadas</p>
        </div>
      </div>

      {verifications.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Últimas verificaciones</p>
          {verifications.slice(-3).reverse().map(v => (
            <div key={v.verification_id} className="rounded-xl bg-white/90 p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] text-slate-500">{v.verification_id?.slice(0, 20)}</span>
                <Badge text={v.status} color={v.status === 'completed' ? 'green' : v.status === 'manual_review' ? 'amber' : 'red'} />
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <div className="rounded-lg bg-slate-50 p-1.5 text-center">
                  <p className={`font-bold ${v.document_check === 'approved' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {v.document_check === 'approved' ? '✓' : '✗'}
                  </p>
                  <p className="text-slate-500">Documento</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-1.5 text-center">
                  <p className={`font-bold ${v.face_match === 'approved' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {v.face_match === 'approved' ? '✓' : v.face_match === 'manual_review' ? '⚡' : '✗'}
                  </p>
                  <p className="text-slate-500">Face match</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-1.5 text-center">
                  <p className={`font-bold ${v.liveness === 'approved' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {v.liveness === 'approved' ? '✓' : '✗'}
                  </p>
                  <p className="text-slate-500">Liveness</p>
                </div>
              </div>
              {v.similarity_score && (
                <p className="mt-1.5 text-[10px] text-slate-500">Similitud: <span className="font-bold text-slate-700">{(v.similarity_score * 100).toFixed(1)}%</span></p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-[11px] text-slate-400 py-3">Sin verificaciones en esta sesión</p>
      )}
    </ExtCard>
  )
}

// ─── SRI Ecuador Panel ─────────────────────────────────────────────────────
function SriPanel({ data }) {
  const { authorizations = [], health } = data
  const authorized = authorizations.filter(a => a.status === 'authorized').length

  return (
    <ExtCard title="SRI Ecuador" subtitle="Autorización comprobantes electrónicos" icon="🏛️" accent="emerald" health={health}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/80 p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-slate-900">{authorizations.length}</p>
          <p className="text-[10px] text-slate-500">Comprobantes</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center shadow-sm">
          <p className="text-lg font-bold text-emerald-700">{authorized}</p>
          <p className="text-[10px] text-emerald-600">Autorizados</p>
        </div>
      </div>

      {authorizations.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Últimas autorizaciones</p>
          {authorizations.slice(-3).reverse().map((a, i) => (
            <div key={a.sri_access_key || i} className="rounded-xl bg-white/90 p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-700">Factura: {a.invoice_id}</span>
                <Badge text={a.status} color="green" />
              </div>
              {a.sri_access_key && (
                <p className="font-mono text-[9px] text-emerald-600 truncate">Clave: {a.sri_access_key?.slice(0, 24)}…</p>
              )}
              {a.amount && (
                <p className="text-[10px] text-slate-500 mt-0.5">{a.currency} {parseFloat(a.amount).toFixed(2)}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-[11px] text-slate-400 py-3">Sin autorizaciones en esta sesión</p>
      )}
    </ExtCard>
  )
}

// ─── Notification Gateway Panel ────────────────────────────────────────────
function NotificationGatewayPanel({ data }) {
  const { messages = [], stats, health } = data
  const byChannel = stats?.by_channel || {}

  return (
    <ExtCard title="Notification Gateway" subtitle="Twilio / SendGrid / FCM (mock)" icon="📡" accent="cyan" health={health}>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {['sms', 'email', 'push'].map(ch => (
          <div key={ch} className="rounded-xl bg-white/80 p-3 text-center shadow-sm">
            <p className="text-lg font-bold text-slate-900">{byChannel[ch] || 0}</p>
            <p className="text-[10px] text-slate-500 uppercase">{ch}</p>
          </div>
        ))}
      </div>

      {messages.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Últimos mensajes entregados</p>
          {messages.slice(-4).reverse().map(m => (
            <div key={m.message_id} className="rounded-xl bg-white/90 p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-700">
                  {m.channel === 'sms' ? '📱' : m.channel === 'email' ? '📧' : '🔔'} {m.event_type || m.channel}
                </span>
                <Badge text={m.status} color={m.status === 'delivered' || m.status === 'sent' ? 'green' : 'red'} />
              </div>
              <p className="text-[10px] text-slate-500 truncate">{m.message?.slice(0, 60)}…</p>
              {m.provider && <p className="mt-0.5 text-[9px] text-cyan-600 font-medium">{m.provider}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-[11px] text-slate-400 py-3">Sin mensajes en esta sesión</p>
      )}
    </ExtCard>
  )
}

// ─── Main ExternalSystemsSection ───────────────────────────────────────────
export default function ExternalSystemsSection({ externalData, onRefreshExternal, onTestCharge, isLoading }) {
  if (!externalData) {
    return (
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-8 text-center shadow-lg">
        <p className="text-slate-500 text-sm">Cargando datos de sistemas externos…</p>
        <button onClick={onRefreshExternal} className="mt-4 rounded-2xl bg-telecom-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-telecom-500 transition shadow-md shadow-telecom-500/10">
          Cargar sistemas externos
        </button>
      </div>
    )
  }

  const systems = [
    { key: 'paymentGateway', component: <PaymentGatewayPanel data={externalData.paymentGateway} onTestCharge={onTestCharge} /> },
    { key: 'networkOss', component: <NetworkOssPanel data={externalData.networkOss} /> },
    { key: 'kyc', component: <KycPanel data={externalData.kyc} /> },
    { key: 'sri', component: <SriPanel data={externalData.sri} /> },
    { key: 'notificationGateway', component: <NotificationGatewayPanel data={externalData.notificationGateway} /> },
  ]

  const onlineCount = systems.filter(s => {
    const h = externalData[s.key]?.health
    return h && h.status === 'ok'
  }).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-[32px] border border-telecom-200/70 bg-gradient-to-r from-telecom-50/90 to-cyan-50/70 p-6 shadow-lg shadow-telecom-100/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-telecom-600">Arquitectura BSS</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Sistemas Externos Integrados</h2>
            <p className="mt-1 text-sm text-slate-500">
              Datos en tiempo real de los 5 sistemas externos que el BSS TelcoX consume activamente.
              Cada panel muestra transacciones reales generadas por las operaciones del portal.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 shadow-sm border border-slate-100">
              <span className={`h-2.5 w-2.5 rounded-full ${onlineCount >= 4 ? 'bg-emerald-500 animate-pulse' : onlineCount >= 2 ? 'bg-amber-500' : 'bg-rose-500'}`} />
              <span className="text-sm font-bold text-slate-800">{onlineCount}/5 sistemas online</span>
            </div>
            <button
              onClick={onRefreshExternal}
              disabled={isLoading}
              className="rounded-2xl bg-telecom-600 px-4 py-2 text-xs font-bold text-white hover:bg-telecom-500 transition disabled:opacity-50 shadow-md shadow-telecom-600/15"
            >
              {isLoading ? 'Actualizando…' : '↻ Actualizar datos externos'}
            </button>
          </div>
        </div>

        {/* Integration flow diagram */}
        <div className="mt-5 overflow-x-auto">
          <div className="flex min-w-max items-center gap-2 rounded-2xl bg-white/70 px-5 py-3 shadow-inner">
            <div className="rounded-xl bg-telecom-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm shadow-telecom-500/10">BSS TelcoX</div>
            {[
              { label: 'Factura → SRI', color: 'emerald' },
              { label: 'Pago → Gateway PSP', color: 'violet' },
              { label: 'Alta → OSS/NMS', color: 'blue' },
              { label: 'KYC → Identidad', color: 'amber' },
              { label: 'Alerta → Gateway Notif.', color: 'cyan' },
            ].map((item, i) => {
              const colorMap = {
                emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/60',
                violet: 'bg-indigo-50 text-indigo-800 border-indigo-200/60',
                blue: 'bg-blue-50 text-blue-800 border-blue-200/60',
                amber: 'bg-amber-50 text-amber-800 border-amber-200/60',
                cyan: 'bg-cyan-50 text-cyan-800 border-cyan-200/60',
              }
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-slate-300">→</span>
                  <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold ${colorMap[item.color]}`}>{item.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Panels grid */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {systems.map(s => <div key={s.key}>{s.component}</div>)}
      </div>
    </div>
  )
}
