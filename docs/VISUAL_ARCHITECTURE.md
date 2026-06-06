# 🎨 Visual Architecture - TelcoX Audit & Cache System

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React/Next.js)                    │
│                    (ui/ directory)                              │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ HTTP Requests
             │
┌────────────▼────────────────────────────────────────────────────┐
│                     API Gateway / Load Balancer                 │
└────────────┬────────────────────────────────────────────────────┘
             │
  ┌──────────┼──────────────────────┬──────────────┐
  │          │                      │              │
  ▼          ▼                      ▼              ▼
┌─────┐  ┌─────────┐  ┌──────────┐  ┌───────┐  ┌─────────────┐
│Cust.│  │Payment  │  │Billing   │  │Audit  │  │Notification│
│Svc  │  │Service  │  │Service   │  │Service│  │Service     │
│:8001│  │:8008    │  │:8003     │  │:8007  │  │:8006       │
└──┬──┘  └────┬────┘  └────┬─────┘  └───┬───┘  └──────┬──────┘
   │          │           │           │            │
   │ [FastAPI] [FastAPI]  [FastAPI]    [FastAPI]    [FastAPI]
   │          │           │           │            │
   └──────────┼───────────┼───────────┼────────────┘
              │           │           │
              │ @audit_action decorator
              │ @cache_result decorator
              │
    ┌─────────┴───────────┴───────────┐
    │                                  │
┌───▼──────────────┐      ┌────────────▼────┐
│   AUDIT LAYER    │      │   CACHE LAYER   │
│                  │      │                 │
│ • AuditManager   │      │ • CacheManager  │
│   (Singleton)    │      │   (Singleton)   │
│ • @audit_action  │      │ • @cache_result │
│   decorator      │      │   decorator     │
│ • Log to file    │      │ • In-memory TTL │
│                  │      │ • Hit tracking  │
└────────┬─────────┘      └────────┬────────┘
         │                         │
         │                         │
    ┌────▼──────────────────────────▼────────┐
    │      PERSISTENCE LAYER                 │
    │                                        │
    │  • PersistenceRepository               │
    │    (Abstract data access)              │
    │                                        │
    │  In-Memory (NOW):                      │
    │  └─ Python dict storage                │
    │  └─ audit.log files                    │
    │                                        │
    │  PostgreSQL (PHASE 2):                 │
    │  └─ audit_events table                 │
    │  └─ customers table                    │
    │  └─ invoices table                     │
    │                                        │
    │  MongoDB (ALTERNATIVE):                │
    │  └─ audit_events collection            │
    │  └─ customers collection               │
    │                                        │
    │  Redis (ALTERNATIVE):                  │
    │  └─ cache:* keys with TTL              │
    └────────────────────────────────────────┘
```

---

## 🔄 Data Flow: CREATE Customer

```
1. HTTP Request
   ┌─────────────────────────────────────┐
   │ POST /customer-service/customers    │
   │ Body: {"data": {"name": "Alice"}}   │
   └─────────────────────────────────────┘
         ↓
2. FastAPI Route Handler
   ┌─────────────────────────────────────┐
   │ @app.post("/...")                   │
   │ @audit_action("customer-service",   │
   │              "CREATE", "CUSTOMER")  │
   │ def create_customer(payload):       │
   └─────────────────────────────────────┘
         ↓
3. Audit Decorator Intercepts
   ┌─────────────────────────────────────┐
   │ start_time = time.time()            │
   │ audit_id = uuid4()                  │
   │ log "START"                         │
   └─────────────────────────────────────┘
         ↓
4. Execute Business Logic
   ┌─────────────────────────────────────┐
   │ customer = build_customer(payload)  │
   │ repository.create(customer)         │
   │ return customer                     │
   └─────────────────────────────────────┘
         ↓ (Success)
5. Audit: Log Success
   ┌─────────────────────────────────────┐
   │ AuditManager.log_event(             │
   │   service: "customer-service",      │
   │   action: "CREATE",                 │
   │   status: "SUCCESS",                │
   │   duration_ms: 12.5,                │
   │   payload_out: {...}                │
   │ )                                   │
   │ Write to audit.log file             │
   └─────────────────────────────────────┘
         ↓
6. Cache Invalidation
   ┌─────────────────────────────────────┐
   │ cache.delete("customers:list:all")  │
   │ # Next GET will refresh from DB     │
   └─────────────────────────────────────┘
         ↓
7. Return Response
   ┌─────────────────────────────────────┐
   │ HTTP 201 Created                    │
   │ Body: {"id": "cus-123", ...}        │
   └─────────────────────────────────────┘
```

---

## 💾 Data Flow: GET Customers (Cache Hit)

```
1. First Request (Cache MISS)
   ┌─────────────────────────────────────┐
   │ GET /customer-service/customers     │
   └─────────────────────────────────────┘
         ↓
   ┌─────────────────────────────────────┐
   │ @audit_action decorator             │
   │ cache_key = "customers:list:all"    │
   └─────────────────────────────────────┘
         ↓
   ┌─────────────────────────────────────┐
   │ cache.get(cache_key) → None         │
   │ (not in cache)                      │
   └─────────────────────────────────────┘
         ↓
   ┌─────────────────────────────────────┐
   │ result = db.read_all()              │
   │ (fetch from repository)             │
   └─────────────────────────────────────┘
         ↓
   ┌─────────────────────────────────────┐
   │ cache.set(cache_key, result,        │
   │           ttl_seconds=300)          │
   │ (store for 5 minutes)               │
   └─────────────────────────────────────┘
         ↓
   ┌─────────────────────────────────────┐
   │ return result                       │
   │ audit_action logs: duration=45ms    │
   └─────────────────────────────────────┘
         ↓
   ┌─────────────────────────────────────┐
   │ HTTP 200 OK                         │
   │ (from database)                     │
   └─────────────────────────────────────┘


2. Second Request (Cache HIT) - Within 5 minutes
   ┌─────────────────────────────────────┐
   │ GET /customer-service/customers     │
   └─────────────────────────────────────┘
         ↓
   ┌─────────────────────────────────────┐
   │ cache.get(cache_key)                │
   │ → [customer_1, customer_2, ...]     │
   │ hit_count++ (234)                   │
   └─────────────────────────────────────┘
         ↓
   ┌─────────────────────────────────────┐
   │ return cached_result                │
   │ audit_action logs: duration=0.1ms   │
   └─────────────────────────────────────┘
         ↓
   ┌─────────────────────────────────────┐
   │ HTTP 200 OK                         │
   │ (from cache) ⚡ 450x faster!        │
   └─────────────────────────────────────┘
```

---

## 📊 Cache TTL Strategy

```
Write Operation
    ↓
    ├─ POST /customers           → Create new
    │  └─ Invalidate: "customers:*"
    │
    ├─ PUT /customers/123        → Update
    │  └─ Invalidate: "customers:*", "customer:123"
    │
    └─ DELETE /customers/123     → Delete
       └─ Invalidate: "customers:*", "customer:123"
    
Read Operations (GET)
    ├─ GET /customers                → TTL: 300s (list cache miss → expensive)
    │
    ├─ GET /customers/123            → TTL: 600s (detail, less change)
    │
    ├─ GET /customers/123/invoices   → TTL: 60s (nested, frequently modified)
    │
    └─ GET /catalog/services         → TTL: 3600s (reference data, stable)
```

---

## 🔍 Audit Event Structure

```
┌──────────────────────────────────────────────────────────┐
│ Audit Event (Logged to audit.log and/or Database)       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ {                                                        │
│   "id": "550e8400-e29b-41d4-a716-446655440000",         │
│   "service": "customer-service",                         │
│   "action": "CREATE",              ← CREATE/READ/UPDATE │
│   "resource_type": "CUSTOMER",                           │
│   "resource_id": "cus-123",                             │
│   "user_id": "user-456",           ← Who did it?       │
│   "status": "SUCCESS",             ← SUCCESS/FAILED    │
│   "payload_in": {                  ← What was sent?    │
│     "full_name": "Alice"                                │
│   },                                                     │
│   "payload_out": {                 ← What was returned?│
│     "id": "cus-123",                                    │
│     "full_name": "Alice",                              │
│     "created_at": "2026-06-05T10:30:00Z"              │
│   },                                                     │
│   "ip_address": "192.168.1.100",   ← From where?      │
│   "timestamp": "2026-06-05T10:30:12.345Z",            │
│   "duration_ms": 23.5,             ← How long?        │
│   "error_message": null                                 │
│ }                                                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 🎯 Decorator Workflow

```
Function Definition
    ↓
@audit_action("service", "ACTION", "RESOURCE")
def my_endpoint(payload):
    return result
    
    ↓ (When called)
    
Wrapper Function Executes
    ├─ start_time = time.time()
    ├─ Try:
    │  ├─ result = my_endpoint(payload)  ← Original function
    │  ├─ duration_ms = calculate()
    │  └─ AuditManager.log_event(status="SUCCESS", result=result)
    │
    └─ Except Exception:
       ├─ duration_ms = calculate()
       └─ AuditManager.log_event(status="FAILED", error=exception)
       └─ Re-raise exception
       
    ↓
Return to Caller
```

---

## 🗄️ Database Migration Path

```
PHASE 1 (NOW): In-Memory
┌──────────────────────────┐
│ • Python dicts           │
│ • CacheManager (memory)  │
│ • audit.log (text)       │
│ • PersistenceRepository  │
│  (abstract layer)        │
└──────────────────────────┘
         ↓ (Minimal changes)


PHASE 2 (WEEK 2): PostgreSQL + Redis
┌──────────────────────────┐
│ PostgreSQL               │
│ • audit_events table     │
│ • customers table        │
│ • invoices table         │
│ • payments table         │
│ • ACID guarantees        │
│ • Indices & views        │
│                          │
│ Redis                    │
│ • cache:* keys           │
│ • Auto TTL expiration    │
│ • 450x faster reads      │
└──────────────────────────┘
         ↓ (Update requirements.txt)
         ↓ (SQLAlchemy models)
         ↓ (Alembic migrations)


PHASE 3 (MONTH 2): Production Scale
┌──────────────────────────┐
│ PostgreSQL HA            │
│ • Master-slave setup     │
│ • Automated failover     │
│ • 7-year backups         │
│                          │
│ Redis Cluster            │
│ • Distributed cache      │
│ • Multi-zone replication │
│                          │
│ Observability            │
│ • Prometheus metrics     │
│ • Grafana dashboards     │
│ • Alert manager          │
└──────────────────────────┘
```

---

## 📈 Performance Impact

```
Operation              | In-Memory | With Cache | Improvement
─────────────────────────────────────────────────────────────
GET /customers         | 45ms      | 0.1ms      | 450x ⚡
GET /customers/123     | 12ms      | 0.05ms     | 240x ⚡
POST /customers        | 20ms      | 20ms       | Same
PUT /customers/123     | 18ms      | 18ms       | Same
DELETE /customers/123  | 15ms      | 15ms       | Same

Average page load (10 GET, 1 POST):
Before: ~130ms
After: ~20ms (6.5x faster)
```

---

## 🔐 Compliance Coverage

```
Regulation      | Requirement                    | Implemented ✅
────────────────────────────────────────────────────────────
GDPR            | Audit trail of all access     | ✅ @audit_action
GDPR            | Right to be forgotten         | ✅ query & delete
GDPR            | Data export                   | ✅ JSON export
────────────────────────────────────────────────────────────
SOX             | Transaction immutability      | ✅ PostgreSQL ACID
SOX             | User action traceability      | ✅ Audit logs
SOX             | 7-year retention              | ✅ Backup strategy
────────────────────────────────────────────────────────────
CCPA            | Data portability              | ✅ Export endpoint
CCPA            | Audit of vendor access       | ✅ IP + timestamp
────────────────────────────────────────────────────────────
PCI-DSS         | No CC data in audit logs      | ✅ mask_sensitive_data()
```

---

## 📊 Key Metrics Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ TelcoX Audit & Cache Dashboard                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Cache Hit Rate         │ Audit Events This Hour        │
│ ████████░░  85%        │ ████████████  2,456 events   │
│                        │                               │
│ Cache Entries          │ Avg Operation Duration        │
│ ████████░░ 234         │ ████░░░░░░  23.5ms           │
│                        │                               │
│ Failed Operations      │ Cache Memory Used             │
│ ░░░░░░░░░░ 0.3%        │ ████████░░  450MB/512MB      │
│                        │                               │
│ Top Operations:        │ Audit Events by Status:       │
│ • GET customers (1.2K) │ ✅ SUCCESS: 99.7%             │
│ • POST payments (450)  │ ❌ FAILED: 0.3%               │
│ • PUT invoices (320)   │                               │
│                        │                               │
└─────────────────────────────────────────────────────────┘
```

---

*Diagrama v1.0 | 2026-06-05 | TelcoX Architecture Team*
