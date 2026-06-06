export default function BillingSection({ invoices, payments, generateInvoice, processPayment }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Facturación</h2>
            <p className="mt-1 text-sm text-slate-700">Registra y paga facturas desde el portal.</p>
          </div>
          <button onClick={generateInvoice} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
            Generar nueva factura
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3">Factura</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoiceItem) => (
                <tr key={invoiceItem.id} className="border-t border-slate-200/70 bg-slate-100">
                  <td className="px-4 py-4 text-slate-700">{invoiceItem.id}</td>
                  <td className="px-4 py-4 text-slate-700">{invoiceItem.currency} {invoiceItem.amount}</td>
                  <td className="px-4 py-4 capitalize text-slate-700">{invoiceItem.status || 'issued'}</td>
                  <td className="px-4 py-4">
                    <button onClick={() => processPayment(invoiceItem)} className="rounded-2xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600">
                      Pagar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <h2 className="text-xl font-semibold text-slate-900">Últimos pagos</h2>
        <div className="mt-5 grid gap-3">
          {payments.slice(-5).reverse().map((paymentItem) => (
            <div key={paymentItem.id} className="rounded-[28px] border border-slate-200/70 bg-slate-100/90 p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-semibold text-slate-900">{paymentItem.id}</p>
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">{paymentItem.status}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{paymentItem.currency} {paymentItem.amount}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
