# 🗄️ Guía de Selección de Bases de Datos para TelcoX

## 📊 Comparativa de Opciones

### 1. **PostgreSQL** (Recomendado para Auditoría)

#### Características
```yaml
Tipo: Relacional SQL
Licencia: Open Source (Apache 2.0)
Performance: Excelente para consultas complejas
Escalabilidad: Vertical (sharding manual)
Consistencia: ACID completa
Índices: B-tree, Hash, GiST, GIN, BRIN
Replicación: Streaming replication (12 replicas)
```

#### Ventajas ✅
- **ACID guarantees**: Todos los cambios son seguros
- **Auditoría perfecta**: Ideal para compliance (GDPR, SOX)
- **Integridad referencial**: Foreign keys automáticas
- **Transacciones**: Multi-statement transactions
- **Full-text search**: Soporte nativo
- **JSON/JSONB**: Flexible + queryable
- **Vistas**: Para reportes complejos
- **Performance**: Excelente con índices correctos

#### Desventajas ❌
- Escalabilidad horizontal requiere sharding manual
- Almacenamiento más denso que documentales
- Requiere más memoria que SQLite

#### Instalación con Docker
```bash
docker run --name postgres_telcox \
  -e POSTGRES_USER=telcox \
  -e POSTGRES_PASSWORD=secure_2026 \
  -e POSTGRES_DB=telcox_audit \
  -v postgres_data:/var/lib/postgresql/data \
  -p 5432:5432 \
  -d postgres:15-alpine
```

#### Conexión desde Python
```python
from sqlalchemy import create_engine

# Desarrollo
DATABASE_URL = "postgresql://telcox:secure_2026@localhost:5432/telcox_audit"

# Producción
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://telcox:secure_2026@postgres:5432/telcox_audit"
)

engine = create_engine(DATABASE_URL, echo=False, pool_size=20, max_overflow=40)
```

#### Coste Estimado
```
Desarrollo: $0 (Open Source)
AWS RDS: $0.20-0.50/hora (t3.micro a t3.small)
Producción escalada: $1-5/hora
Backup: Incluido en servicios administrados
```

---

### 2. **MongoDB** (Flexible, Escalable)

#### Características
```yaml
Tipo: Documento NoSQL
Licencia: Server Side Public License (SSPL)
Performance: Rápido para writes, BSON binary format
Escalabilidad: Horizontal (sharding automático)
Consistencia: Transacciones multi-documento (4.0+)
Índices: Campo único, compuesto, geoespacial, texto
Replicación: Replica set (hasta 50 miembros)
```

#### Ventajas ✅
- **Escalabilidad horizontal**: Sharding automático
- **Esquema flexible**: Campos dinámicos
- **Rendimiento de escritura**: Excelente throughput
- **TTL nativo**: Expiración automática de documentos
- **Atlas (cloud)**: Servicio completamente administrado
- **Análisis**: Agregaciones poderosas
- **Geoespacial**: Queries por localización

#### Desventajas ❌
- Transacciones más lenta que SQL
- Mayor consumo de almacenamiento (BSON overhead)
- Licencia SSPL (conflicto con open source)
- Requiere más RAM que PostgreSQL
- Consistencia eventual en replicación

#### Instalación con Docker
```bash
docker run --name mongo_telcox \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=secure_2026 \
  -e MONGO_INITDB_DATABASE=telcox_audit \
  -v mongo_data:/data/db \
  -p 27017:27017 \
  -d mongo:6.0
```

#### Conexión desde Python
```python
from pymongo import MongoClient

MONGO_URL = os.getenv(
    "MONGO_URL",
    "mongodb://admin:secure_2026@localhost:27017/telcox_audit"
)

client = MongoClient(MONGO_URL)
db = client.telcox_audit
audit_events = db.audit_events
```

#### Coste Estimado
```
Desarrollo: $0 (Open Source, pero SSPL)
MongoDB Atlas: $0.30-1.00/hora (M10 a M30)
Producción escalada: $2-10/hora
Backup: Incluido en Atlas
```

---

### 3. **Redis** (Caché - No para Auditoría)

#### Características
```yaml
Tipo: Key-Value en memoria
Licencia: BSD 3-Clause
Performance: Ultra rápido (microsegundos)
Persistencia: RDB + AOF (ambos opcionales)
Escalabilidad: Cluster (6 shards mínimo)
Consistencia: Eventual (in-memory)
```

#### Ventajas ✅
- **Performance**: Más rápido que cualquier DB
- **TTL nativo**: Expiración automática
- **Data structures**: Strings, lists, sets, sorted sets, hashes
- **Pub/Sub**: Message queuing integrado
- **Persistencia**: Optional RDB o AOF
- **Lua scripting**: Transacciones atómicas

#### Desventajas ❌
- ⚠️ **No para auditoría**: Pérdida de datos con restart
- Almacenamiento limitado a RAM
- Consistencia eventual
- No soporta transacciones complejas

#### Instalación con Docker
```bash
docker run --name redis_telcox \
  -v redis_data:/data \
  -p 6379:6379 \
  -d redis:7-alpine \
  redis-server --appendonly yes --maxmemory 512mb
```

#### Conexión desde Python
```python
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL)

# Caché con TTL
redis_client.setex("customers:list", 300, json.dumps(data))
cached = redis_client.get("customers:list")
```

#### Coste Estimado
```
Desarrollo: $0 (Open Source)
AWS ElastiCache: $0.10-0.30/hora
Producción escalada: $0.50-2/hora
```

---

## 🎯 Matriz de Decisión

| Caso de Uso | PostgreSQL | MongoDB | Redis |
|---|---|---|---|
| **Auditoría** | ✅ Excelente | ✅ Bueno | ❌ No |
| **Datos transaccionales** | ✅ Excelente | ⚠️ Bueno | ❌ No |
| **Caché de lectura** | ⚠️ Aceptable | ⚠️ Aceptable | ✅ Excelente |
| **Escalabilidad horizontal** | ⚠️ Manual | ✅ Automática | ✅ Cluster |
| **Esquema flexible** | ❌ No | ✅ Sí | ✅ Sí |
| **Cumplimiento normativo** | ✅ Excelente | ✅ Bueno | ❌ No |
| **Coste** | $ Bajo | $$ Medio | $ Bajo |
| **Complejidad** | Medio | Bajo | Bajo |

---

## 💾 Recomendación para TelcoX

### Arquitectura Recomendada:

```
┌─────────────────────────────────────┐
│        API FastAPI Services         │
└─────────────────────────────────────┘
           ↙ (audit_action)
    ┌──────────────────────────────────┐
    │                                  │
┌───▼─────────┐              ┌────▼───────┐
│ PostgreSQL  │              │   Redis    │
│  (Auditoría)│              │  (Caché)   │
└────────────┘              └────────────┘
```

### Justificación:

1. **PostgreSQL para Auditoría**
   - ✅ ACID garantizado
   - ✅ Compliance GDPR/SOX
   - ✅ Integridad referencial
   - ✅ Queries complejas de reportes
   - ✅ Vistas para análisis

2. **Redis para Caché**
   - ✅ Performance ultra rápido
   - ✅ TTL automático
   - ✅ Reduce carga en PostgreSQL
   - ✅ Bajo coste
   - ✅ Escalable horizontalmente

### Configuración Híbrida:
```python
# cache_manager.py (Redis)
redis_client = redis.from_url(os.getenv("REDIS_URL"))

# audit_logger.py (PostgreSQL)
db_engine = create_engine(os.getenv("DATABASE_URL"))

# application.py
@app.get("/customers")
@cache_result(ttl=300)  # Redis
@audit_action("customer-service", "READ", "CUSTOMERS")  # PostgreSQL
def get_customers():
    return db.query(Customer).all()
```

---

## 📋 Plan de Implementación

### Fase 1: Desarrollo (Actual)
```python
# En memoria + archivos
cache_manager.py → CacheManager (singleton)
audit_logger.py → AuditManager (singleton) → audit.log
```

### Fase 2: Staging (Próximas semanas)
```python
# PostgreSQL + Redis
database.py → SQLAlchemy + psycopg2
cache_manager.py → Redis
audit_logger.py → PostgreSQL
```

### Fase 3: Producción (Futuro)
```python
# PostgreSQL HA + Redis Cluster
- Master-Slave replication
- Automated failover
- Backup strategy (7 años)
- Monitoring con Prometheus/Grafana
```

---

## 🔧 Configuración por Ambiente

### Development (.env.local)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/telcox_dev
REDIS_URL=redis://localhost:6379/0
LOG_LEVEL=DEBUG
AUDIT_TYPE=file
```

### Staging (.env.staging)
```env
DATABASE_URL=postgresql://user:pass@postgres-staging.rds.amazonaws.com:5432/telcox
REDIS_URL=redis://redis-staging.elasticache.amazonaws.com:6379/0
LOG_LEVEL=INFO
AUDIT_TYPE=postgresql
```

### Production (.env.prod)
```env
DATABASE_URL=postgresql://user:pass@postgres-prod-cluster.rds.amazonaws.com:5432/telcox
REDIS_URL=redis://redis-prod-cluster.elasticache.amazonaws.com:6379/0
LOG_LEVEL=WARNING
AUDIT_TYPE=postgresql
BACKUP_RETENTION_DAYS=2555
```

---

## ⚡ Optimizaciones

### PostgreSQL Performance
```sql
-- Crear índices apropiados
CREATE INDEX idx_audit_timestamp ON audit_events(timestamp DESC);
CREATE INDEX idx_audit_service_action ON audit_events(service, action);

-- Autovacuum para mantenimiento
ALTER TABLE audit_events SET (autovacuum_vacuum_scale_factor = 0.01);

-- Particionamiento por fecha
CREATE TABLE audit_events_2026_q1 PARTITION OF audit_events
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
```

### Redis Performance
```python
# Pipeline para múltiples operaciones
pipe = redis_client.pipeline()
for key, value in data.items():
    pipe.setex(key, 300, value)
pipe.execute()

# Usar hashing para namespaces
redis_client.hset("cache:customers", "123", customer_data)
```

---

## 📚 Recursos

- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [MongoDB Docs](https://docs.mongodb.com/)
- [Redis Docs](https://redis.io/documentation)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/en/20/)
- [PyMongo](https://pymongo.readthedocs.io/)
- [redis-py](https://redis-py.readthedocs.io/)

---

*Seleccionado: PostgreSQL + Redis | Versión: 1.0 | Última actualización: 2026-06-05*
