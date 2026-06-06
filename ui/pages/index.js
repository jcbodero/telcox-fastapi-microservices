import { useEffect, useMemo, useState } from 'react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import StatCards from '../components/StatCards'
import ActivityLog from '../components/ActivityLog'
import DashboardSection from '../components/DashboardSection'
import CatalogSection from '../components/CatalogSection'
import BillingSection from '../components/BillingSection'
import NotificationsSection from '../components/NotificationsSection'
import AccountSection from '../components/AccountSection'
import { useAuth } from '../lib/AuthContext'
import { apiMap, loadAllData, postJson } from '../lib/serviceApi'

const tabs = ['dashboard', 'catalog', 'billing', 'notifications', 'account']

const channelIcon = {
  email: '📧',
  sms: '📱',
  push: '🔔',
}

export default function Home() {
  const { user, isAuthenticated, isLoading: isAuthLoading, login, logout, getAccessToken } = useAuth()
  const [customerList, setCustomerList] = useState([])
  const [activeServices, setActiveServices] = useState([])
  const [catalog, setCatalog] = useState([])
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [notifications, setNotifications] = useState([])
  const [auditEvents, setAuditEvents] = useState([])
  const [orders, setOrders] = useState([])
  const [log, setLog] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const appendLog = (message) => {
    setLog((prev) => [
      { message, created_at: new Date().toISOString() },
      ...prev,
    ])
  }

  const selectedCustomer = useMemo(() => user || customerList[0] || null, [user, customerList])

  const loadData = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const token = await getAccessToken()
      const [customersData, servicesData, catalogData, invoicesData, paymentsData, notificationsData, auditData, ordersData] = await loadAllData(token)
      setCustomerList(customersData)
      setActiveServices(servicesData)
      setCatalog(catalogData)
      setInvoices(invoicesData)
      setPayments(paymentsData)
      setNotifications(notificationsData)
      setAuditEvents(auditData)
      setOrders(ordersData)
      appendLog('Dashboard loaded')
    } catch (error) {
      setErrorMessage(error.message)
      appendLog(`Load error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) loadData()
  }, [isAuthenticated])

  const createCustomer = async () => {
    try {
      const payload = { full_name: 'Mario Perez', document_id: '0912345678', email: 'mario.perez@telcox.com', phone: '+593987654321' }
      const data = await postJson('customer', apiMap.customer, payload, await getAccessToken())
      setCustomerList((prev) => [data, ...prev])
      appendLog(`Cliente creado: ${data.id}`)
    } catch (error) {
      appendLog(`Create customer failed: ${error.message}`)
    }
  }

  const performOnboarding = async () => {
    if (!selectedCustomer) return appendLog('Seleccione un cliente para onboarding')
    try {
      const payload = { document_id: selectedCustomer.document_id, full_name: selectedCustomer.full_name }
      const data = await postJson('onboarding', apiMap.onboarding, payload, await getAccessToken())
      appendLog(`Onboarding: ${data.status}`)
      setAuditEvents((prev) => [{ id: `${Date.now()}`, action: 'onboarding', resource: selectedCustomer.id, created_at: new Date().toISOString() }, ...prev])
    } catch (error) {
      appendLog(`Onboarding failed: ${error.message}`)
    }
  }

  const processPayment = async (invoice) => {
    if (!selectedCustomer) return appendLog('Seleccione un cliente antes de pagar')
    try {
      const payload = { customer_id: selectedCustomer.id, invoice_id: invoice.id, amount: invoice.amount, currency: invoice.currency, method: 'card', mode: 'success' }
      const data = await postJson('payment', apiMap.payment, payload, await getAccessToken())
      appendLog(`Pago procesado: ${data.id}`)
      await sendNotification(selectedCustomer.id, 'email', `Pago registrado para ${invoice.id}`)
      await loadData()
    } catch (error) {
      appendLog(`Payment failed: ${error.message}`)
    }
  }

  const generateInvoice = async () => {
    if (!selectedCustomer) return appendLog('Seleccione un cliente para generar factura')
    try {
      const payload = { customer_id: selectedCustomer.id, amount: 24.99, currency: 'USD', description: 'Plan TelcoX Premium' }
      const data = await postJson('billing', apiMap.billingGenerate, payload, await getAccessToken())
      appendLog(`Factura generada: ${data.id}`)
      await loadData()
    } catch (error) {
      appendLog(`Invoice generation failed: ${error.message}`)
    }
  }

  const createProvisioningOrder = async (product) => {
    if (!selectedCustomer) return appendLog('Seleccione un cliente antes de provisionar')
    try {
      const payload = { customer_id: selectedCustomer.id, product_id: product.id, operation: 'activate', channel: 'web', status: 'pending', data_limit_gb: 20 }
      const data = await postJson('provisioning', apiMap.provisioning, payload, await getAccessToken())
      appendLog(`Provisioning request: ${data.id}`)
      await sendNotification(selectedCustomer.id, 'sms', `Solicitud de activación para ${product.name}`)
      await loadData()
    } catch (error) {
      appendLog(`Provisioning failed: ${error.message}`)
    }
  }

  const sendNotification = async (customerId, channel, message) => {
    try {
      const payload = { customer_id: customerId, channel, event_type: 'service_update', message, mode: 'success' }
      await postJson('notification', apiMap.notification, payload, await getAccessToken())
      appendLog(`Notificación enviada: ${channel}`)
    } catch (error) {
      appendLog(`Notification failed: ${error.message}`)
    }
  }

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm shadow-lg">
          Validando sesion...
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,158,239,0.18),transparent_28%),linear-gradient(to_bottom,#f8fbff_0%,#eef2ff_100%)] flex items-center justify-center p-6 text-slate-900">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200/80 bg-white/90 p-8 shadow-telecard">
          <h1 className="text-3xl font-semibold mb-4">TelcoX Business Portal</h1>
          <p className="text-slate-700 mb-6">Inicia sesion con Keycloak para ver el estado de tus servicios y administrar tus recursos.</p>
          <button onClick={login} className="w-full rounded-3xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500">
            Ingresar con Keycloak
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,158,239,0.18),transparent_28%),linear-gradient(to_bottom,#f8fbff_0%,#eef2ff_100%)] text-slate-900">
      <Topbar selectedCustomer={selectedCustomer} logout={logout} />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-[32px] border border-cyan-200/70 bg-cyan-500/5 p-6 shadow-xl shadow-cyan-500/10 mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-600">TelcoX Network Control</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Visibilidad total de red y facturación</h2>
              <p className="max-w-2xl text-sm text-slate-600">Gestiona clientes, estados de servicio y reportes de facturación desde un panel central diseñado para accionistas y equipos de operaciones.</p>
            </div>
            <div className="rounded-3xl bg-white/95 px-5 py-4 text-sm font-semibold text-slate-900 shadow-md shadow-cyan-200/70">
              Banner corporativo | Flujo rápido | Datos prioritarios
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <Sidebar
            tabs={tabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            counts={{ customers: customerList.length, services: activeServices.length, invoices: invoices.length, payments: payments.length }}
            onRefresh={loadData}
            isLoading={isLoading}
          />

          <section className="space-y-6">
            {errorMessage && (
              <div className="rounded-[32px] border border-rose-500/50 bg-rose-100/95 p-4 text-sm text-rose-900 shadow-lg shadow-rose-200/80">
                <p className="font-semibold uppercase tracking-[0.16em] text-rose-700">⚠️ Alerta de sistema</p>
                <p className="mt-2">{errorMessage}</p>
              </div>
            )}

            <StatCards selectedCustomer={selectedCustomer} activeServices={activeServices} invoices={invoices} payments={payments} />

            {activeTab === 'dashboard' && <DashboardSection activeServices={activeServices} auditEvents={auditEvents} />}
            {activeTab === 'catalog' && <CatalogSection catalog={catalog} createProvisioningOrder={createProvisioningOrder} />}
            {activeTab === 'billing' && <BillingSection invoices={invoices} payments={payments} generateInvoice={generateInvoice} processPayment={processPayment} />}
            {activeTab === 'notifications' && <NotificationsSection notifications={notifications} channelIcon={channelIcon} />}
            {activeTab === 'account' && <AccountSection selectedCustomer={selectedCustomer} orders={orders} auditEvents={auditEvents} />}

            <ActivityLog log={log} onClear={() => setLog([])} />

            <div className="rounded-[32px] border border-slate-200/70 bg-white/90 p-6 shadow-lg shadow-slate-200/10">
              <h2 className="text-xl font-semibold text-slate-900">Operaciones rápidas</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <button onClick={createCustomer} className="rounded-2xl bg-telecom-500 px-4 py-3 text-sm font-semibold text-white hover:bg-telecom-400">Crear cliente</button>
                <button onClick={performOnboarding} className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-500">Ejecutar onboarding</button>
                <button onClick={loadData} className="rounded-2xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-300">Refrescar estado</button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

