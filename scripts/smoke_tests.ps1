$ErrorActionPreference = 'Stop'

$baseUrls = @{ 
    customer = 'http://localhost:8001/customer-service'
    onboarding = 'http://localhost:8002/onboarding-service'
    payment = 'http://localhost:8003/payment-service'
    provisioning = 'http://localhost:8004/provisioning-service'
    notification = 'http://localhost:8005/notification-service'
    billing = 'http://localhost:8006/billing-service'
    audit = 'http://localhost:8007/audit-service'
    status = 'http://localhost:8008/service-status-service'
}

function PostJson($url, $body) {
    return Invoke-RestMethod -Uri $url -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 10)
}

Write-Host '--- Smoke test: TelcoX mock flow ---'

$customer = PostJson "$($baseUrls.customer)/customers" @{ data = @{ full_name = 'Smoke Test User'; document_id = '0912345678'; email = 'smoke@example.com'; phone = '+593987654321' } }
Write-Host "Created customer: $($customer.id)"

$onboarding = PostJson "$($baseUrls.onboarding)/onboarding-cases/verify" @{ data = @{ document_id = $customer.document_id; full_name = $customer.full_name } }
Write-Host "Onboarding status: $($onboarding.status)"

$payment = PostJson "$($baseUrls.payment)/process" @{ data = @{ customer_id = $customer.id; amount = 9.99; currency = 'USD'; method = 'card'; mode = 'success' } }
Write-Host "Payment status: $($payment.status) id=$($payment.id)"

$invoice = PostJson "$($baseUrls.billing)/invoices/generate" @{ data = @{ customer_id = $customer.id; amount = 9.99; currency = 'USD'; description = 'Starter mobile plan'; } }
Write-Host "Invoice generated: $($invoice.id) status=$($invoice.status)"

$order = PostJson "$($baseUrls.provisioning)/orders" @{ data = @{ customer_id = $customer.id; product_id = 'prd-5g-20gb'; operation = 'activate'; status = 'pending'; channel = 'web'; data_limit_gb = 20 } }
Write-Host "Provisioning order: $($order.id) status=$($order.status)"

$notification = PostJson "$($baseUrls.notification)/notifications/send" @{ data = @{ customer_id = $customer.id; channel = 'email'; event_type = 'customer_onboarded'; message = 'Tu servicio TelcoX fue activado.'; mode = 'success'; } }
Write-Host "Notification delivered: $($notification.status)"

$auditEvents = Invoke-RestMethod "$($baseUrls.audit)/audit-events"
Write-Host "Audit events count: $($auditEvents.Count)"

$statusServices = Invoke-RestMethod "$($baseUrls.status)/active-services"
Write-Host "Active services count: $($statusServices.Count)"

Write-Host '--- Smoke test completed ---'