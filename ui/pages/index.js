import { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import DashboardSection from '../components/DashboardSection'
import CatalogSection from '../components/CatalogSection'
import BillingSection from '../components/BillingSection'
import ExternalSystemsSection from '../components/ExternalSystemsSection'
import OnboardingGate from '../components/OnboardingGate'
import LoadingOverlay from '../components/LoadingOverlay'
import { useAuth } from '../lib/AuthContext'
import { apiMap, loadAllData, postJson, putJson, patchJson, deleteJson, loadExternalSystemsData } from '../lib/serviceApi'

const tabs = ['dashboard', 'catalog', 'billing', 'external']

export default function Home() {
  const { user, isAuthenticated, isLoading: isAuthLoading, login, logout, getAccessToken } = useAuth()
  const [customerList, setCustomerList] = useState([])
  const [activeServices, setActiveServices] = useState([])
  const [catalog, setCatalog] = useState([])
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [auditEvents, setAuditEvents] = useState([])
  const [orders, setOrders] = useState([])
  const [externalData, setExternalData] = useState(null)
  const [lastMessage, setLastMessage] = useState('')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOnboardingVerified, setIsOnboardingVerified] = useState(false)

  const appendLog = (message) => {
    setLastMessage(message)
  }

  const selectedCustomer = useMemo(() => user || customerList[0] || null, [user, customerList])

  const loadData = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const token = await getAccessToken()
      const [customersData, servicesData, catalogData, invoicesData, paymentsData, , auditData, ordersData] = await loadAllData(token)
      setCustomerList(customersData)
      setActiveServices(servicesData)
      setCatalog(catalogData)
      setInvoices(invoicesData)
      setPayments(paymentsData)
      setAuditEvents(auditData)
      setOrders(ordersData)

      const extData = await loadExternalSystemsData()
      setExternalData(extData)
      appendLog('Dashboard actualizado')
    } catch (error) {
      setErrorMessage(error.message)
      appendLog(`Error de carga: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const onRefreshExternal = async () => {
    setIsLoading(true)
    try {
      const extData = await loadExternalSystemsData()
      setExternalData(extData)
      appendLog('Sistemas externos actualizados')
    } catch (error) {
      appendLog(`Error actualizando externos: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const onTestCharge = async (mode) => {
    setIsLoading(true)
    try {
      const payload = { amount: 15.0, currency: 'USD', mode }
      const res = await postJson('paymentGateway', '/payment-gateway/charge', payload)
      appendLog(`Prueba PSP ${mode}: ${res.status || 'declined'}`)
      await onRefreshExternal()
    } catch (error) {
      appendLog(`Prueba PSP fallida: ${error.message}`)
      await onRefreshExternal()
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setIsOnboardingVerified(false)
      return
    }
    if (isOnboardingVerified) loadData()
  }, [isAuthenticated, isOnboardingVerified])

  const completeLoginOnboarding = () => {
    setIsOnboardingVerified(true)
    setActiveTab('dashboard')
    appendLog('Onboarding de inicio de sesion completado')
  }

  const sendNotification = async (customerId, channel, message) => {
    try {
      const payload = { customer_id: customerId, channel, event_type: 'service_update', message, mode: 'success' }
      await postJson('notification', apiMap.notification, payload, await getAccessToken())
      appendLog(`Notificacion enviada: ${channel}`)
    } catch (error) {
      appendLog(`Notificacion fallida: ${error.message}`)
    }
  }

  const processPayment = async (invoice) => {
    if (!selectedCustomer) return appendLog('Seleccione un cliente antes de pagar')
    setIsLoading(true)
    try {
      const payload = {
        customer_id: selectedCustomer.id,
        invoice_id: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
        method: 'card',
        mode: 'success',
      }
      const data = await postJson('payment', apiMap.payment, payload, await getAccessToken())
      appendLog(`Pago procesado: ${data.id}`)
      await patchJson('billing', `/billing-service/invoices/${invoice.id}`, { status: 'paid' }, await getAccessToken())
      await sendNotification(selectedCustomer.id, 'email', `Pago registrado para ${invoice.id}`)
      await loadData()
    } catch (error) {
      appendLog(`Pago fallido: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const generateInvoice = async () => {
    if (!selectedCustomer) return appendLog('Seleccione un cliente para generar factura')
    setIsLoading(true)
    try {
      const payload = {
        customer_id: selectedCustomer.id,
        amount: 24.99,
        currency: 'USD',
        description: 'Plan TelcoX Premium',
      }
      const data = await postJson('billing', apiMap.billingGenerate, payload, await getAccessToken())
      appendLog(`Factura generada: ${data.id}`)
      await loadData()
    } catch (error) {
      appendLog(`Factura fallida: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const createCatalogProduct = async (product) => {
    setIsLoading(true)
    try {
      const data = await postJson('catalog', apiMap.catalog, product, await getAccessToken())
      appendLog(`Producto creado: ${data.name || data.id}`)
      await loadData()
      return data
    } catch (error) {
      appendLog(`Producto no creado: ${error.message}`)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const updateCatalogProduct = async (productId, product) => {
    setIsLoading(true)
    try {
      const data = await putJson('catalog', `${apiMap.catalog}/${productId}`, product, await getAccessToken())
      appendLog(`Producto actualizado: ${data.name || data.id}`)
      await loadData()
      return data
    } catch (error) {
      appendLog(`Producto no actualizado: ${error.message}`)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const toggleCatalogProduct = async (product) => {
    setIsLoading(true)
    try {
      const nextStatus = product.status === 'inactive' ? 'active' : 'inactive'
      const data = await patchJson('catalog', `${apiMap.catalog}/${product.id}`, { status: nextStatus }, await getAccessToken())
      appendLog(`${nextStatus === 'active' ? 'Producto activado' : 'Producto pausado'}: ${data.name || data.id}`)
      await loadData()
      return data
    } catch (error) {
      appendLog(`Estado no actualizado: ${error.message}`)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const deleteCatalogProduct = async (product) => {
    setIsLoading(true)
    try {
      await deleteJson('catalog', `${apiMap.catalog}/${product.id}`, await getAccessToken())
      appendLog(`Producto eliminado: ${product.name || product.id}`)
      await loadData()
    } catch (error) {
      appendLog(`Producto no eliminado: ${error.message}`)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const createProvisioningOrder = async (product) => {
    if (!selectedCustomer) return appendLog('Seleccione un cliente antes de aprovisionar')
    setIsLoading(true)
    try {
      let operation = 'activate'
      if (product.type === 'package_upgrade') {
        operation = 'upgrade'
      } else if (product.type === 'addon_service') {
        operation = 'request_addon'
      }

      const payload = {
        customer_id: selectedCustomer.id,
        product_id: product.id,
        operation,
        channel: 'web',
        status: 'pending',
        data_limit_gb: product.type === 'package_upgrade' ? 10.0 : 20.0,
      }
      const data = await postJson('provisioning', apiMap.provisioning, payload, await getAccessToken())
      appendLog(`Suscripcion aprovisionada: ${data.id}`)

      const channel = product.type === 'addon_service' ? 'email' : 'sms'
      await sendNotification(selectedCustomer.id, channel, `Solicitud de ${product.name} procesada correctamente`)
      await loadData()
      setActiveTab('dashboard')
    } catch (error) {
      appendLog(`Aprovisionamiento fallido: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
        <LoadingOverlay show label="Cargando" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,158,239,0.18),transparent_28%),linear-gradient(to_bottom,#f8fbff_0%,#eef2ff_100%)] p-6 text-slate-900">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200/80 bg-white/90 p-8 shadow-telecard">
          <h1 className="mb-4 text-3xl font-semibold">TelcoX Business Portal</h1>
          <p className="mb-6 text-slate-700">Inicia sesion con Keycloak para ver tus indicadores y administrar suscripciones.</p>
          <button onClick={login} className="w-full rounded-3xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500">
            Ingresar con Keycloak
          </button>
        </div>
      </div>
    )
  }

  if (!isOnboardingVerified) {
    return (
      <OnboardingGate
        user={user}
        getAccessToken={getAccessToken}
        onComplete={completeLoginOnboarding}
        logout={logout}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,158,239,0.18),transparent_28%),linear-gradient(to_bottom,#f8fbff_0%,#eef2ff_100%)] text-slate-900">
      <LoadingOverlay show={isLoading} label="Cargando" />
      <Topbar selectedCustomer={selectedCustomer} logout={logout} />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 rounded-[32px] border border-cyan-200/70 bg-cyan-500/5 p-6 shadow-xl shadow-cyan-500/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-600">TelcoX Network Control</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Dashboard de suscripciones</h2>
              <p className="max-w-2xl text-sm text-slate-600">
                KPIs, consumo, facturacion y aprovisionamiento en una sola vista operacional.
              </p>
            </div>
            <div className="rounded-3xl bg-white/95 px-5 py-4 text-sm font-semibold text-slate-900 shadow-md shadow-cyan-200/70">
              Activacion BSS | Provisioning OSS | KPIs
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <Sidebar
            tabs={tabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          <section className="space-y-6">
            {errorMessage && (
              <div className="rounded-[32px] border border-rose-500/50 bg-rose-100/95 p-4 text-sm text-rose-900 shadow-lg shadow-rose-200/80">
                <p className="font-semibold uppercase tracking-[0.16em] text-rose-700">Alerta de sistema</p>
                <p className="mt-2">{errorMessage}</p>
              </div>
            )}

            {lastMessage && (
              <div className="rounded-[24px] border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
                {lastMessage}
              </div>
            )}

            {activeTab === 'dashboard' && (
              <DashboardSection
                selectedCustomer={selectedCustomer}
                activeServices={activeServices}
                auditEvents={auditEvents}
                orders={orders}
                invoices={invoices}
                payments={payments}
                catalog={catalog}
                createProvisioningOrder={createProvisioningOrder}
                isLoading={isLoading}
              />
            )}
            {activeTab === 'catalog' && (
              <CatalogSection
                catalog={catalog}
                createProvisioningOrder={createProvisioningOrder}
                createProduct={createCatalogProduct}
                updateProduct={updateCatalogProduct}
                toggleProduct={toggleCatalogProduct}
                deleteProduct={deleteCatalogProduct}
                isLoading={isLoading}
              />
            )}
            {activeTab === 'billing' && <BillingSection invoices={invoices} payments={payments} generateInvoice={generateInvoice} processPayment={processPayment} />}
            {activeTab === 'external' && (
              <ExternalSystemsSection
                externalData={externalData}
                onRefreshExternal={onRefreshExternal}
                onTestCharge={onTestCharge}
                isLoading={isLoading}
              />
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
