export default function NotificationsSection({ notifications, channelIcon }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <h2 className="text-xl font-semibold text-slate-900">Notificaciones</h2>
        <p className="mt-1 text-sm text-slate-700">Envía alertas operativas y revisa el historial de comunicación.</p>
        <div className="mt-6 grid gap-3">
          {notifications.map((notificationItem) => (
            <div key={notificationItem.id} className="rounded-[28px] border border-slate-200/70 bg-slate-100/90 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm font-semibold text-slate-900">
                  {channelIcon[notificationItem.channel] || '🔔'} {notificationItem.event_type || 'Alerta general'}
                </p>
                <div className="flex items-center gap-2">
                  {notificationItem.gateway_provider && (
                    <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
                      🛰️ {notificationItem.gateway_provider}
                    </span>
                  )}
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                    notificationItem.status === 'delivered' || notificationItem.status === 'sent'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {notificationItem.status}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-700">{notificationItem.message}</p>
              {notificationItem.gateway_message_id && (
                <div className="mt-3 flex items-center justify-between border-t border-slate-200/50 pt-2 text-[11px] font-mono text-slate-500">
                  <span>Gateway Msg ID: {notificationItem.gateway_message_id}</span>
                  {notificationItem.external_system && (
                    <span className="text-cyan-600 font-semibold uppercase tracking-wider">
                      Integrado vía {notificationItem.external_system}
                    </span>
                  )}
                </div>
              )}
              {notificationItem.gateway_error && (
                <div className="mt-2 text-xs font-mono text-rose-600">
                  Error de pasarela: {notificationItem.gateway_error}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
