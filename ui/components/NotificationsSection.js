export default function NotificationsSection({ notifications, channelIcon }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <h2 className="text-xl font-semibold text-slate-900">Notificaciones</h2>
        <p className="mt-1 text-sm text-slate-700">Envía alertas operativas y revisa el historial de comunicación.</p>
        <div className="mt-6 grid gap-3">
          {notifications.map((notificationItem) => (
            <div key={notificationItem.id} className="rounded-[28px] border border-slate-200/70 bg-slate-100/90 p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-slate-900">{channelIcon[notificationItem.channel] || '🔔'} {notificationItem.event_type}</p>
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">{notificationItem.status}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{notificationItem.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
