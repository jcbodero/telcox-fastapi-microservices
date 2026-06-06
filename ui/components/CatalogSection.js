export default function CatalogSection({ catalog, createProvisioningOrder }) {
  // Categorize products
  const plans = catalog.filter(p => p.type === 'mobile_plan' || p.type === 'broadband_plan')
  const upgrades = catalog.filter(p => p.type === 'package_upgrade')
  const addons = catalog.filter(p => p.type === 'addon_service')

  const renderProductCard = (product, btnText, btnColor) => (
    <div key={product.id} className="flex flex-col justify-between rounded-[28px] border border-slate-200/70 bg-slate-50/90 p-6 shadow-sm hover:shadow-md transition">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{product.name}</h3>
            <span className="inline-block mt-1.5 rounded-md bg-slate-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
              {product.type.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xl font-bold text-cyan-600">${parseFloat(product.monthly_price).toFixed(2)}</p>
        </div>
        
        <div className="mt-5 space-y-2 text-sm text-slate-600">
          {(product.features || []).map((feature, index) => (
            <p key={index} className="flex items-center gap-2">
              <span className="text-cyan-500">✓</span> {feature}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <button 
          onClick={() => createProvisioningOrder(product)} 
          className={`w-full rounded-2xl py-3 text-sm font-semibold text-white transition shadow-sm ${btnColor}`}
        >
          {btnText}
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      {/* 1. Planes Principales */}
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Planes de Internet y Telefonía</h2>
          <p className="mt-1 text-sm text-slate-500 font-medium">Suscríbete a nuestros planes móviles de alta velocidad y fibra óptica residencial.</p>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {plans.map((prod) => renderProductCard(prod, 'Activar Suscripción', 'bg-cyan-600 hover:bg-cyan-500'))}
        </div>
      </div>

      {/* 2. Paquetes Extra */}
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Paquetes de Datos Extra</h2>
          <p className="mt-1 text-sm text-slate-500 font-medium">¿Te quedaste sin datos? Adiciona gigabytes extras a tu plan activo de forma inmediata.</p>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {upgrades.map((prod) => renderProductCard(prod, 'Comprar Paquete', 'bg-indigo-600 hover:bg-indigo-500'))}
        </div>
      </div>

      {/* 3. Servicios Adicionales */}
      <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Servicios Adicionales y Canales Especiales</h2>
          <p className="mt-1 text-sm text-slate-500 font-medium">Habilita roaming internacional o contrata suscripciones a plataformas de streaming.</p>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {addons.map((prod) => renderProductCard(prod, 'Solicitar Servicio', 'bg-emerald-600 hover:bg-emerald-500'))}
        </div>
      </div>
    </div>
  )
}
