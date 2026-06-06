export default function CatalogSection({ catalog, createProvisioningOrder }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Catálogo de productos</h2>
            <p className="mt-1 text-sm text-slate-700">Administra planes y ofertas disponibles.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {catalog.map((product) => (
            <div key={product.id} className="rounded-[28px] border border-slate-200/70 bg-slate-100/90 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
                  <p className="mt-2 text-sm text-slate-700">{product.type}</p>
                </div>
                <p className="text-xl font-semibold text-cyan-300">{product.currency} {product.monthly_price}</p>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                {(product.features || []).map((feature, index) => (
                  <p key={index}>• {feature}</p>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={() => createProvisioningOrder(product)} className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500">
                  Activar servicio
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
