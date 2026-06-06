import { useMemo, useState } from 'react'

const emptyForm = {
  id: '',
  name: '',
  type: 'mobile_plan',
  monthly_price: '',
  currency: 'USD',
  status: 'active',
  featuresText: '',
}

const productTypes = [
  { value: 'all', label: 'Todos' },
  { value: 'mobile_plan', label: 'Movil' },
  { value: 'broadband_plan', label: 'Fibra' },
  { value: 'package_upgrade', label: 'Paquete' },
  { value: 'addon_service', label: 'Adicional' },
]

const typeLabels = {
  mobile_plan: 'Plan movil',
  broadband_plan: 'Fibra hogar',
  package_upgrade: 'Paquete extra',
  addon_service: 'Servicio adicional',
}

const typeTone = {
  mobile_plan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  broadband_plan: 'border-sky-200 bg-sky-50 text-sky-700',
  package_upgrade: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  addon_service: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const currency = (value, code = 'USD') => {
  const number = Number(value || 0)
  return `${code} ${number.toFixed(2)}`
}

const productToForm = (product) => ({
  id: product.id || '',
  name: product.name || '',
  type: product.type || 'mobile_plan',
  monthly_price: String(product.monthly_price ?? ''),
  currency: product.currency || 'USD',
  status: product.status || 'active',
  featuresText: (product.features || []).join('\n'),
})

const formToProduct = (form, originalId = '') => ({
  id: originalId || form.id.trim(),
  name: form.name.trim(),
  type: form.type,
  monthly_price: Number(form.monthly_price || 0),
  currency: form.currency.trim() || 'USD',
  status: form.status,
  features: form.featuresText
    .split('\n')
    .map((feature) => feature.trim())
    .filter(Boolean),
})

function CatalogSummary({ catalog }) {
  const active = catalog.filter((product) => product.status !== 'inactive').length
  const planCount = catalog.filter((product) => product.type === 'mobile_plan' || product.type === 'broadband_plan').length
  const addonCount = catalog.filter((product) => product.type === 'package_upgrade' || product.type === 'addon_service').length

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ['Productos', catalog.length],
        ['Activos', active],
        ['Planes y extras', `${planCount}/${addonCount}`],
      ].map(([label, value]) => (
        <div key={label} className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
      ))}
    </div>
  )
}

function ProductForm({ form, setForm, editingId, onCancel, onSubmit, isLoading }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-950">{editingId ? 'Editar producto' : 'Nuevo producto'}</h3>
          <p className="mt-1 text-sm text-slate-500">Administra planes, paquetes y servicios del catalogo.</p>
        </div>
        {editingId && (
          <button type="button" onClick={onCancel} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200">
            Limpiar
          </button>
        )}
      </div>

      {!editingId && (
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Codigo</span>
          <input
            value={form.id}
            onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))}
            placeholder="prd-fibra-500m"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:bg-white"
          />
        </label>
      )}

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Nombre</span>
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Plan Fibra 500 Mbps"
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:bg-white"
          required
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Tipo</span>
          <select
            value={form.type}
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:bg-white"
          >
            {productTypes.filter((type) => type.value !== 'all').map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Precio</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.monthly_price}
            onChange={(event) => setForm((current) => ({ ...current, monthly_price: event.target.value }))}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:bg-white"
            required
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Moneda</span>
          <input
            value={form.currency}
            onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:bg-white"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Estado</span>
          <select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:bg-white"
          >
            <option value="active">Activo</option>
            <option value="inactive">Pausado</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Beneficios</span>
        <textarea
          value={form.featuresText}
          onChange={(event) => setForm((current) => ({ ...current, featuresText: event.target.value }))}
          placeholder="Un beneficio por linea"
          rows={5}
          className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-cyan-500 focus:bg-white"
        />
      </label>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {editingId ? 'Guardar cambios' : 'Crear producto'}
      </button>
    </form>
  )
}

function ProductCard({ product, onEdit, onToggle, onDelete, onActivate, isLoading }) {
  const isInactive = product.status === 'inactive'

  return (
    <article className={`rounded-[24px] border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${isInactive ? 'border-slate-200 opacity-70' : 'border-slate-200 hover:border-cyan-200'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${typeTone[product.type] || typeTone.addon_service}`}>
            {typeLabels[product.type] || product.type || 'Producto'}
          </span>
          <h3 className="mt-3 text-lg font-bold text-slate-950">{product.name}</h3>
          <p className="mt-1 text-xs font-mono text-slate-500">{product.id}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-slate-950">{currency(product.monthly_price, product.currency)}</p>
          <p className={`mt-2 text-xs font-bold ${isInactive ? 'text-amber-600' : 'text-emerald-600'}`}>
            {isInactive ? 'Pausado' : 'Activo'}
          </p>
        </div>
      </div>

      <div className="mt-5 min-h-[88px] space-y-2">
        {(product.features || []).slice(0, 4).map((feature) => (
          <p key={feature} className="flex gap-2 text-sm font-medium text-slate-600">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
            <span>{feature}</span>
          </p>
        ))}
        {(product.features || []).length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Sin beneficios registrados.
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onActivate(product)}
          disabled={isLoading || isInactive}
          className="rounded-2xl bg-slate-950 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Aprovisionar
        </button>
        <button
          type="button"
          onClick={() => onEdit(product)}
          className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50"
        >
          Editar
        </button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onToggle(product)}
          disabled={isLoading}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isInactive ? 'Activar' : 'Pausar'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(product)}
          disabled={isLoading}
          className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Eliminar
        </button>
      </div>
    </article>
  )
}

export default function CatalogSection({
  catalog,
  createProvisioningOrder,
  createProduct,
  updateProduct,
  toggleProduct,
  deleteProduct,
  isLoading,
}) {
  const [query, setQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [formError, setFormError] = useState('')

  const filteredCatalog = useMemo(() => {
    const term = query.trim().toLowerCase()
    return catalog
      .filter((product) => selectedType === 'all' || product.type === selectedType)
      .filter((product) => {
        if (!term) return true
        const haystack = [product.id, product.name, product.type, ...(product.features || [])].join(' ').toLowerCase()
        return haystack.includes(term)
      })
  }, [catalog, query, selectedType])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId('')
    setFormError('')
  }

  const onEdit = (product) => {
    setForm(productToForm(product))
    setEditingId(product.id)
    setFormError('')
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setFormError('')
    if (!editingId && !form.id.trim()) {
      setFormError('Ingresa un codigo para el producto.')
      return
    }
    if (!form.name.trim()) {
      setFormError('Ingresa un nombre para el producto.')
      return
    }

    try {
      const payload = formToProduct(form, editingId)
      if (editingId) await updateProduct(editingId, payload)
      else await createProduct(payload)
      resetForm()
    } catch (error) {
      setFormError(error.message)
    }
  }

  const onDelete = async (product) => {
    const shouldDelete = window.confirm(`Eliminar ${product.name}?`)
    if (!shouldDelete) return
    try {
      await deleteProduct(product)
      if (editingId === product.id) resetForm()
    } catch (error) {
      setFormError(error.message)
    }
  }

  const onToggle = async (product) => {
    try {
      await toggleProduct(product)
    } catch (error) {
      setFormError(error.message)
    }
  }

  const onActivate = async (product) => {
    try {
      await createProvisioningOrder(product)
    } catch (error) {
      setFormError(error.message)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/20">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">Sistema de catalogo</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">Productos comerciales</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Crea, edita, pausa y aprovisiona ofertas de telefonia, fibra, paquetes y servicios adicionales.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, codigo o beneficio"
              className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:bg-white lg:w-80"
            />
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-cyan-500 focus:bg-white"
            >
              {productTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6">
          <CatalogSummary catalog={catalog} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className="grid gap-4 md:grid-cols-2">
          {filteredCatalog.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={onEdit}
              onToggle={onToggle}
              onDelete={onDelete}
              onActivate={onActivate}
              isLoading={isLoading}
            />
          ))}
          {filteredCatalog.length === 0 && (
            <div className="col-span-full rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-medium text-slate-500">
              No hay productos para los filtros seleccionados.
            </div>
          )}
        </section>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          {formError && (
            <div className="mb-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {formError}
            </div>
          )}
          <ProductForm
            form={form}
            setForm={setForm}
            editingId={editingId}
            onCancel={resetForm}
            onSubmit={onSubmit}
            isLoading={isLoading}
          />
        </aside>
      </div>
    </div>
  )
}
