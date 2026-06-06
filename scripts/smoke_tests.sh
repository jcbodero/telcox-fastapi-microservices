#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost"

echo "--- Smoke test: TelcoX mock flow ---"

CUSTOMER=$(curl -s -X POST "$BASE:8001/customer-service/customers" -H 'Content-Type: application/json' -d '{"data":{"full_name":"Smoke Test User","document_id":"0912345678","email":"smoke@example.com","phone":"+593987654321"}}')
CUSTOMER_ID=$(echo "$CUSTOMER" | jq -r '.id')
CUSTOMER_DOC=$(echo "$CUSTOMER" | jq -r '.document_id')
echo "Created customer: $CUSTOMER_ID"

ONBOARDING=$(curl -s -X POST "$BASE:8002/onboarding-service/onboarding-cases/verify" -H 'Content-Type: application/json' -d "{\"data\":{\"document_id\":\"$CUSTOMER_DOC\",\"full_name\":\"Smoke Test User\"}}")
ONBOARDING_STATUS=$(echo "$ONBOARDING" | jq -r '.status')
echo "Onboarding status: $ONBOARDING_STATUS"

PAYMENT=$(curl -s -X POST "$BASE:8003/payment-service/process" -H 'Content-Type: application/json' -d "{\"data\":{\"customer_id\":\"$CUSTOMER_ID\",\"amount\":9.99,\"currency\":\"USD\",\"method\":\"card\",\"mode\":\"success\"}}")
PAYMENT_STATUS=$(echo "$PAYMENT" | jq -r '.status')
PAYMENT_ID=$(echo "$PAYMENT" | jq -r '.id')
echo "Payment status: $PAYMENT_STATUS id=$PAYMENT_ID"

INVOICE=$(curl -s -X POST "$BASE:8006/billing-service/invoices/generate" -H 'Content-Type: application/json' -d "{\"data\":{\"customer_id\":\"$CUSTOMER_ID\",\"amount\":9.99,\"currency\":\"USD\",\"description\":\"Starter mobile plan\"}}")
INVOICE_ID=$(echo "$INVOICE" | jq -r '.id')
echo "Invoice generated: $INVOICE_ID"

ORDER=$(curl -s -X POST "$BASE:8004/provisioning-service/orders" -H 'Content-Type: application/json' -d "{\"data\":{\"customer_id\":\"$CUSTOMER_ID\",\"product_id\":\"prd-5g-20gb\",\"operation\":\"activate\",\"status\":\"pending\",\"channel\":\"web\",\"data_limit_gb\":20}}")
ORDER_STATUS=$(echo "$ORDER" | jq -r '.status')
ORDER_ID=$(echo "$ORDER" | jq -r '.id')
echo "Provisioning order: $ORDER_ID status=$ORDER_STATUS"

NOTIF=$(curl -s -X POST "$BASE:8005/notification-service/notifications/send" -H 'Content-Type: application/json' -d "{\"data\":{\"customer_id\":\"$CUSTOMER_ID\",\"channel\":\"email\",\"event_type\":\"customer_onboarded\",\"message\":\"Tu servicio TelcoX fue activado.\",\"mode\":\"success\"}}")
NOTIF_STATUS=$(echo "$NOTIF" | jq -r '.status')
echo "Notification status: $NOTIF_STATUS"

AUDIT_COUNT=$(curl -s "$BASE:8007/audit-service/audit-events" | jq '. | length')
ACTIVE_COUNT=$(curl -s "$BASE:8008/service-status-service/active-services" | jq '. | length')
echo "Audit events count: $AUDIT_COUNT"
echo "Active services count: $ACTIVE_COUNT"

echo "--- Smoke test completed ---"
