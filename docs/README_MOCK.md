# TelcoX Mock - Run Instructions

This document explains how to run the mock TelcoX services and UI locally.

Prerequisites
- Python 3.11+
- Node.js 18+ and npm/yarn (for UI)

Install Python deps:

```bash
pip install -r requirements.txt
```

Run all microservices (PowerShell):

```powershell
# from project root
./run_all.ps1
```

This script will start services on these default ports:
- customer_service: 8001
- onboarding_service: 8002
- payment_service: 8003
- provisioning_service: 8004
- notification_service: 8005
- billing_service: 8006
- audit_service: 8007
- service_status_service: 8008
- catalog_service: 8009

Start the UI (Next.js) locally:

```bash
cd ui
npm install
npm run dev
# then open http://localhost:3000
```

Seed demo data (after services are up):

```bash
python scripts/seed_mock_data.py
```

Smoke tests (scripts):
- PowerShell: `./scripts/smoke_tests.ps1`
- Bash: `./scripts/smoke_tests.sh` (requires `jq`)

Manual smoke flow endpoints:
- Create a customer: `POST http://localhost:8001/customer-service/customers`
- Verify onboarding: `POST http://localhost:8002/onboarding-service/onboarding-cases/verify`
- Process payment: `POST http://localhost:8003/payment-service/process`
- Create provisioning order: `POST http://localhost:8004/provisioning-service/orders`
- Send notification: `POST http://localhost:8005/notification-service/notifications/send`
- Generate invoice: `POST http://localhost:8006/billing-service/invoices/generate`
- Read audit events: `GET http://localhost:8007/audit-service/audit-events`
- Read active services: `GET http://localhost:8008/service-status-service/active-services`

Notes:
- Services are in-memory and intended for quick mocks only.
- Environment variable `PORT` is set by `run_all.ps1` for convenience; services also accept `--port` passed to `uvicorn`.
- For deployment, configure environment variables and use containerization/helm (left as backlog tasks).
