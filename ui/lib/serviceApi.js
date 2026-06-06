const SERVICE_PORTS = {
  customer: process.env.NEXT_PUBLIC_CUSTOMER_PORT || '8001',
  onboarding: process.env.NEXT_PUBLIC_ONBOARDING_PORT || '8002',
  payment: process.env.NEXT_PUBLIC_PAYMENT_PORT || '8003',
  provisioning: process.env.NEXT_PUBLIC_PROVISIONING_PORT || '8004',
  notification: process.env.NEXT_PUBLIC_NOTIFICATION_PORT || '8005',
  billing: process.env.NEXT_PUBLIC_BILLING_PORT || '8006',
  audit: process.env.NEXT_PUBLIC_AUDIT_PORT || '8007',
  status: process.env.NEXT_PUBLIC_STATUS_PORT || '8008',
  catalog: process.env.NEXT_PUBLIC_CATALOG_PORT || '8009',
}

export const buildUrl = (service, path) => `http://localhost:${SERVICE_PORTS[service]}${path}`

const handleResponse = async (res) => {
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${errorText}`)
  }
  return res.json()
}

const buildHeaders = (token, headers = {}) => {
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const fetchJson = async (url, options = {}, token = null) => {
  const nextOptions = {
    ...options,
    headers: buildHeaders(token, options.headers),
  }
  const res = await fetch(url, nextOptions)
  return handleResponse(res)
}

export const apiMap = {
  customer: '/customer-service/customers',
  onboarding: '/onboarding-service/onboarding-cases/verify',
  payment: '/payment-service/process',
  provisioning: '/provisioning-service/orders',
  notification: '/notification-service/notifications/send',
  notificationList: '/notification-service/notifications',
  billingInvoices: '/billing-service/invoices',
  billingGenerate: '/billing-service/invoices/generate',
  paymentList: '/payment-service/payments',
  audit: '/audit-service/audit-events',
  status: '/service-status-service/active-services',
  catalog: '/catalog-service/products',
  provisioningOrders: '/provisioning-service/orders',
}

export const postJson = async (service, path, payload, token = null) => {
  const response = await fetchJson(buildUrl(service, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload }),
  }, token)
  return response
}

export const loadAllData = async (token = null) => {
  return Promise.all([
    fetchJson(buildUrl('customer', apiMap.customer), {}, token),
    fetchJson(buildUrl('status', apiMap.status), {}, token),
    fetchJson(buildUrl('catalog', apiMap.catalog), {}, token),
    fetchJson(buildUrl('billing', apiMap.billingInvoices), {}, token),
    fetchJson(buildUrl('payment', apiMap.paymentList), {}, token),
    fetchJson(buildUrl('notification', apiMap.notificationList), {}, token),
    fetchJson(buildUrl('audit', apiMap.audit), {}, token),
    fetchJson(buildUrl('provisioning', apiMap.provisioningOrders), {}, token),
  ])
}
