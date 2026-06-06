# Guía de Implementación: Auditoría y Caché en Microservicios

## 🎯 Objetivo
Aplicar patrones de auditoría y caché consistentemente en todos los 9 microservicios de TelcoX.

## 📋 Checklist de Implementación

### Para cada microservicio (payment_service, billing_service, etc.):

#### Paso 1: Importar módulos compartidos
```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../'))

from shared.audit_logger import audit_action, AuditRepository
from shared.cache_manager import CacheManager
from shared.database import PersistenceRepository
```

#### Paso 2: Inicializar repositorios
```python
# En main.py, después de crear la app
SERVICE_NAME = "billing-service"  # Cambiar según el servicio
audit_repo = AuditRepository()
cache = CacheManager()
db = PersistenceRepository("invoices")  # Cambiar según la colección
```

#### Paso 3: Aplicar decoradores en todos los endpoints
```python
# ANTES
@app.post("/billing-service/invoices", status_code=201)
def create_invoice(payload: InvoicePayload):
    return invoices

# DESPUÉS
@app.post("/billing-service/invoices", status_code=201)
@audit_action(SERVICE_NAME, "CREATE", "INVOICE")
def create_invoice(payload: InvoicePayload):
    return invoices
```

#### Paso 4: Implementar caché en lecturas
```python
@app.get("/billing-service/invoices")
@audit_action(SERVICE_NAME, "READ", "INVOICES")
def list_invoices():
    cache_key = "invoices:list:all"
    
    # Intentar obtener del caché
    if cached := cache.get(cache_key):
        return cached
    
    # Si no está en caché, obtener de la base de datos
    result = db.read_all()  # o list(invoices.values()) en in-memory
    
    # Guardar en caché con TTL
    cache.set(cache_key, result, ttl_seconds=300)
    return result
```

#### Paso 5: Invalidar caché en escrituras
```python
@app.post("/billing-service/invoices", status_code=201)
@audit_action(SERVICE_NAME, "CREATE", "INVOICE")
def create_invoice(payload: InvoicePayload):
    # Crear la factura
    invoice = build_invoice(payload.data)
    
    # Invalidar caché relevante
    cache.delete("invoices:list:all")
    
    # Opcionalmente: invalidar por patrón
    # cache.invalidate("invoice:")
    
    return invoice
```

#### Paso 6: Agregar endpoints de observabilidad
```python
@app.get("/{service-name}/audit")
def get_audit_trail():
    """Get audit trail for all operations."""
    return [e.model_dump() for e in audit_repo.find_all()]

@app.get("/{service-name}/cache/stats")
def get_cache_stats():
    """Get cache statistics."""
    return cache.stats()

@app.post("/{service-name}/cache/cleanup")
def cleanup_cache():
    """Clean up expired cache entries."""
    removed = cache.cleanup_expired()
    return {"message": f"Removed {removed} expired entries"}
```

---

## 🔀 Matriz de Implementación

| Servicio | CRUD Endpoints | Caché | Decoradores | Auditoría | Estado |
|----------|---|---|---|---|---|
| customer_service | 5 | ✅ | ✅ | ✅ | **COMPLETADO** |
| payment_service | 5 | 🟡 | 🟡 | 🟡 | Pendiente |
| billing_service | 5 | 🟡 | 🟡 | 🟡 | Pendiente |
| audit_service | 4 | 🟡 | 🟡 | ✅ | Pendiente |
| notification_service | 4 | 🟡 | 🟡 | 🟡 | Pendiente |
| provisioning_service | 4 | 🟡 | 🟡 | 🟡 | Pendiente |
| onboarding_service | 4 | 🟡 | 🟡 | 🟡 | Pendiente |
| catalog_service | 3 | 🟡 | 🟡 | 🟡 | Pendiente |
| service_status_service | 4 | 🟡 | 🟡 | 🟡 | Pendiente |

---

## 🚀 Script de Migración Automática

Para aplicar el patrón a todos los servicios de una vez:

```python
# migration_script.py
import os
import re

SERVICES = [
    "payment_service",
    "billing_service",
    "audit_service",
    "notification_service",
    "provisioning_service",
    "onboarding_service",
    "catalog_service",
    "service_status_service",
]

def migrate_service(service_name):
    """Automatic migration of service to use audit/cache."""
    service_path = f"services/{service_name}/main.py"
    
    if not os.path.exists(service_path):
        print(f"❌ {service_name}: main.py not found")
        return
    
    with open(service_path, 'r') as f:
        content = f.read()
    
    # Add imports
    import_section = """import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../'))

from shared.audit_logger import audit_action, AuditRepository
from shared.cache_manager import CacheManager
from shared.database import PersistenceRepository
"""
    
    # Add after existing imports
    if "from shared" not in content:
        content = re.sub(
            r'(from fastapi.*?\n)',
            r'\1' + import_section,
            content,
            count=1
        )
    
    # Add initialization after app creation
    init_section = f"""
# Initialize repositories
SERVICE_NAME = "{service_name}"
audit_repo = AuditRepository()
cache = CacheManager()
"""
    
    if "SERVICE_NAME" not in content:
        content = re.sub(
            r'(app = FastAPI.*?\n\))',
            r'\1' + init_section,
            content
        )
    
    with open(service_path, 'w') as f:
        f.write(content)
    
    print(f"✅ {service_name}: Migrated successfully")

if __name__ == "__main__":
    for service in SERVICES:
        migrate_service(service)
```

---

## 📊 TTL Recomendado por Tipo de Operación

| Tipo de Dato | TTL | Justificación |
|---|---|---|
| Lista de clientes | 300s (5 min) | Datos cambian frecuentemente |
| Detalle de cliente | 600s (10 min) | Menos cambios que lista |
| Listado de facturas | 300s (5 min) | Estado puede cambiar rápido |
| Catálogo de servicios | 3600s (1 hora) | Datos de referencia estables |
| Último pago | 60s (1 min) | Crítico para concordancia |
| Notificaciones | 30s (30 seg) | Muy dinámico |

---

## 🔐 Seguridad en Auditoría

### Datos que NO deben quedar en auditoría:
- ❌ Contraseñas
- ❌ Números de tarjeta de crédito
- ❌ Códigos de seguridad
- ❌ Tokens de autenticación

### Mascarar datos sensibles:
```python
def mask_sensitive_data(data: dict) -> dict:
    """Remove sensitive fields before audit logging."""
    sensitive_fields = ['password', 'card_number', 'cvv', 'token']
    masked = data.copy()
    
    for field in sensitive_fields:
        if field in masked:
            masked[field] = '***REDACTED***'
    
    return masked

@audit_action("service", "UPDATE", "CUSTOMER")
def update_customer(payload):
    masked_payload = mask_sensitive_data(payload.data)
    # ... resto de la lógica
```

---

## 🧪 Testing de Auditoría y Caché

### Test unitario:
```python
import pytest
from shared.audit_logger import AuditManager
from shared.cache_manager import CacheManager

def test_audit_logging():
    manager = AuditManager()
    event_id = manager.log_event(
        service="test",
        action="CREATE",
        resource_type="TEST",
        resource_id="123",
        status="SUCCESS"
    )
    
    events = manager.get_events()
    assert len(events) > 0
    assert event_id is not None

def test_cache_ttl():
    cache = CacheManager()
    cache.set("key", "value", ttl_seconds=1)
    
    assert cache.get("key") == "value"
    
    # Esperar 2 segundos
    import time
    time.sleep(2)
    
    assert cache.get("key") is None

def test_cache_hit_count():
    cache = CacheManager()
    cache.set("key", "value")
    
    cache.get("key")
    cache.get("key")
    
    stats = cache.stats()
    entry = stats["entries"][0]
    assert entry["hit_count"] == 2
```

---

## 📈 Monitoreo en Producción

### Consultas PostgreSQL útiles:
```sql
-- Operaciones más lentas
SELECT service, action, AVG(duration_ms) as avg_ms
FROM audit_events
GROUP BY service, action
ORDER BY avg_ms DESC
LIMIT 10;

-- Fallos por servicio
SELECT service, COUNT(*) as failures
FROM audit_events
WHERE status = 'FAILED'
GROUP BY service
ORDER BY failures DESC;

-- Actividad por hora
SELECT DATE_TRUNC('hour', timestamp) as hour, COUNT(*) as events
FROM audit_events
GROUP BY hour
ORDER BY hour DESC;
```

---

## 🎓 Ejemplos Completos

### payment_service (Ejemplo):
Ver [migration example](./examples/payment_service_migrated.py)

### billing_service (Ejemplo):
Ver [migration example](./examples/billing_service_migrated.py)

---

## ✅ Validación Post-Migración

```bash
# 1. Verificar que el servicio inicia sin errores
cd services/customer_service
python -m uvicorn main:app --port 8000

# 2. Probar endpoints de auditoría
curl http://localhost:8000/customer-service/audit

# 3. Verificar estadísticas de caché
curl http://localhost:8000/customer-service/cache/stats

# 4. Ejecutar tests
pytest tests/ -v

# 5. Verificar logs
tail -f logs/audit.log
```

---

*Guía de implementación - TelcoX Architecture v1.0*
