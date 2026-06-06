export default function BillingSection({ invoices, payments, generateInvoice, processPayment }) {
  return (
    <div className="space-y-6">
      {/* Facturas */}
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Estado de Facturación</h2>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              Facturas con autorización SRI en tiempo real via servicio externo (puerto 8010).
            </p>
          </div>
          <button
            onClick={generateInvoice}
            className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-500 transition shadow-sm"
          >
            Generar factura + autorizar SRI
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-4">Factura ID</th>
                <th className="px-4 py-4">Monto</th>
                <th className="px-4 py-4">Vencimiento</th>
                <th className="px-4 py-4">Estado BSS</th>
                <th className="px-4 py-4">SRI</th>
                <th className="px-4 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                    No tienes facturas registradas.
                  </td>
                </tr>
              ) : (
                invoices.map((invoiceItem) => {
                  const isPaid = invoiceItem.status === 'paid'
                  const sriOk = invoiceItem.sri_status === 'authorized'
                  const sriPending = invoiceItem.sri_status === 'pending'
                  return (
                    <tr key={invoiceItem.id} className="bg-white hover:bg-slate-50 transition">
                      <td className="px-4 py-4 font-mono text-slate-900 text-xs font-bold">{invoiceItem.id}</td>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {invoiceItem.currency} {parseFloat(invoiceItem.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-slate-500 font-medium text-xs">
                        {invoiceItem.due_date || 'N/A'}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isPaid ? '✓ Pagado' : '● Pendiente'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-0.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            sriOk ? 'bg-emerald-100 text-emerald-800' : sriPending ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-800'
                          }`}>
                            🏛️ {invoiceItem.sri_status || 'pending'}
                          </span>
                          {invoiceItem.sri_access_key && (
                            <p className="font-mono text-[9px] text-emerald-600 truncate max-w-[120px]" title={invoiceItem.sri_access_key}>
                              {invoiceItem.sri_access_key.slice(0, 12)}…
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {isPaid ? (
                          <span className="text-sm font-semibold text-emerald-600 pr-4">Completado</span>
                        ) : (
                          <button
                            onClick={() => processPayment(invoiceItem)}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                          >
                            Pagar ahora
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de pagos */}
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <h2 className="text-xl font-semibold text-slate-900">Historial de Transacciones</h2>
        <p className="mt-1 text-sm text-slate-500 font-medium">
          Pagos procesados via Payment Gateway externo (PSP, puerto 8011). Incluye autorización y referencia de red.
        </p>

        <div className="mt-5 grid gap-4">
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No se registran transacciones de pago.</p>
          ) : (
            payments.slice(-5).reverse().map((paymentItem) => (
              <div key={paymentItem.id} className="rounded-[24px] border border-slate-200/70 bg-slate-50 p-5 shadow-sm transition hover:bg-slate-100/50">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400 font-mono">BSS ID: {paymentItem.id}</p>
                    <p className="text-xs text-slate-600 font-semibold">Factura: {paymentItem.invoice_id || 'N/A'}</p>
                    {/* Gateway fields — new from external integration */}
                    {paymentItem.gateway_transaction_id && (
                      <p className="text-[10px] text-violet-600 font-mono">
                        🔗 Gateway TXN: {paymentItem.gateway_transaction_id}
                      </p>
                    )}
                    {paymentItem.gateway_authorization_code && (
                      <p className="text-[10px] text-violet-700 font-semibold">
                        AUTH: {paymentItem.gateway_authorization_code}
                      </p>
                    )}
                    {paymentItem.gateway_reference && !paymentItem.gateway_transaction_id && (
                      <p className="text-[10px] text-slate-400 font-mono">Ref: {paymentItem.gateway_reference}</p>
                    )}
                    {paymentItem.external_system && (
                      <span className="inline-block rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-600 border border-violet-200">
                        via {paymentItem.external_system}
                      </span>
                    )}
                  </div>
                  <div className="text-right sm:space-y-1">
                    <p className="font-bold text-slate-900">
                      {paymentItem.currency} {parseFloat(paymentItem.amount || 0).toFixed(2)}
                    </p>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      paymentItem.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {paymentItem.status === 'approved' ? 'Aprobada' : 'Declinada'}
                    </span>
                    {paymentItem.gateway_error && (
                      <p className="text-[9px] text-rose-500 mt-0.5">{paymentItem.gateway_error}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
