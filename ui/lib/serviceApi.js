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
  // External systems (BSS ↔ External)
  sri: process.env.NEXT_PUBLIC_SRI_PORT || '8010',
  paymentGateway: process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_PORT || '8011',
  networkOss: process.env.NEXT_PUBLIC_NETWORK_OSS_PORT || '8012',
  kycIdentity: process.env.NEXT_PUBLIC_KYC_PORT || '8013',
  notificationGateway: process.env.NEXT_PUBLIC_NOTIFICATION_GATEWAY_PORT || '8014',
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

export const buildUrl = (service, path) => {
  if (API_BASE_URL !== undefined) return `${API_BASE_URL}${path}`
  return `http://localhost:${SERVICE_PORTS[service]}${path}`
}

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
  // External systems
  sriAuthorizations: '/sri-service/authorizations',
  sriHealth: '/sri-service/health',
  paymentGatewayTransactions: '/payment-gateway/transactions',
  paymentGatewayHealth: '/payment-gateway/health',
  networkOssProvisions: '/network-oss/provision',
  networkOssStatus: '/network-oss/network-status',
  networkOssHealth: '/network-oss/health',
  kycVerifications: '/kyc/verify',
  kycHealth: '/kyc/health',
  notificationGatewayMessages: '/notification-gateway/messages',
  notificationGatewayStats: '/notification-gateway/stats',
  notificationGatewayHealth: '/notification-gateway/health',
}

export const postJson = async (service, path, payload, token = null) => {
  const response = await fetchJson(buildUrl(service, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload }),
  }, token)
  return response
}

export const patchJson = async (service, path, payload, token = null) => {
  const response = await fetchJson(buildUrl(service, path), {
    method: 'PATCH',
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

/** Load data from all 5 external systems in parallel. Never throws — each resolves with null on error. */
export const loadExternalSystemsData = async () => {
  const safe = async (fn) => { try { return await fn() } catch { return null } }
  const [
    sriAuths, sriHealth,
    gwTxns, gwHealth,
    ossOrders, ossNetStatus, ossHealth,
    kycVerifs, kycHealth,
    ngwMessages, ngwStats, ngwHealth,
  ] = await Promise.all([
    safe(() => fetchJson(buildUrl('sri', apiMap.sriAuthorizations))),
    safe(() => fetchJson(buildUrl('sri', apiMap.sriHealth))),
    safe(() => fetchJson(buildUrl('paymentGateway', apiMap.paymentGatewayTransactions))),
    safe(() => fetchJson(buildUrl('paymentGateway', apiMap.paymentGatewayHealth))),
    safe(() => fetchJson(buildUrl('networkOss', apiMap.networkOssProvisions))),
    safe(() => fetchJson(buildUrl('networkOss', apiMap.networkOssStatus))),
    safe(() => fetchJson(buildUrl('networkOss', apiMap.networkOssHealth))),
    safe(() => fetchJson(buildUrl('kycIdentity', apiMap.kycVerifications))),
    safe(() => fetchJson(buildUrl('kycIdentity', apiMap.kycHealth))),
    safe(() => fetchJson(buildUrl('notificationGateway', apiMap.notificationGatewayMessages))),
    safe(() => fetchJson(buildUrl('notificationGateway', apiMap.notificationGatewayStats))),
    safe(() => fetchJson(buildUrl('notificationGateway', apiMap.notificationGatewayHealth))),
  ])
  return {
    sri: { authorizations: sriAuths || [], health: sriHealth },
    paymentGateway: { transactions: gwTxns || [], health: gwHealth },
    networkOss: { orders: ossOrders || [], networkStatus: ossNetStatus, health: ossHealth },
    kyc: { verifications: kycVerifs || [], health: kycHealth },
    notificationGateway: { messages: ngwMessages || [], stats: ngwStats, health: ngwHealth },
  }
}
