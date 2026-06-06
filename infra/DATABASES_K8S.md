# Bases de datos en Kubernetes

Docker Compose queda solo para desarrollo local. Para Kubernetes, TelcoX despliega las bases de datos con charts Helm dentro de `infra/`.

## PostgreSQL

Responsabilidad principal:

- Auditoria transaccional.
- Consultas SQL sobre acciones de usuario.
- Indices compuestos para timelines por recurso, usuario, servicio y fecha.

Despliegue:

```bash
helm upgrade --install telcox-postgres infra/postgres/setup/helm \
  --namespace telcox \
  --create-namespace \
  --set auth.password='PASSWORD_POSTGRES'
```

Recursos creados:

- `StatefulSet/telcox-postgres`
- `Service/telcox-postgres`
- `Secret/telcox-postgres-auth`
- `ConfigMap/telcox-postgres-init`
- `PersistentVolumeClaim/data-telcox-postgres-0`

El Secret incluye la clave `url`, consumida por los microservicios como `POSTGRES_URL`.

## MongoDB

Responsabilidad principal:

- Persistencia documental alternativa.
- Eventos y modelos de lectura flexibles.
- Indices para busquedas por recurso, usuario, servicio, estado y texto.

Despliegue:

```bash
helm upgrade --install telcox-mongo infra/mongo/setup/helm \
  --namespace telcox \
  --create-namespace \
  --set auth.password='PASSWORD_MONGO'
```

Recursos creados:

- `StatefulSet/telcox-mongo`
- `Service/telcox-mongo`
- `Secret/telcox-mongo-auth`
- `ConfigMap/telcox-mongo-init`
- `PersistentVolumeClaim/data-telcox-mongo-0`

## Buenas practicas aplicadas

- `StatefulSet` para identidad estable y volumen persistente.
- `ClusterIP` para exponer las bases solo dentro del cluster.
- Credenciales en `Secret`, no en ConfigMap.
- Inicializacion de esquema en ConfigMap montado en `/docker-entrypoint-initdb.d`.
- Requests y limits por defecto.
- Probes de vida y disponibilidad.
- `ReadWriteOnce` para evitar multiples escritores sobre el mismo volumen.

## Integracion con microservicios

`customer_service` y `onboarding_service` usan por defecto:

```yaml
audit:
  backend: postgres
  postgresUrlSecretName: telcox-postgres-auth
  postgresUrlSecretKey: url
```

Si se usa un Secret externo o un operador de base de datos, cambiar esos valores en el chart del microservicio.
