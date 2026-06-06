# TelcoX - Analisis y Microservicios FastAPI

Este entregable convierte el reto de arquitectura TelcoX en una propuesta de microservicios con CRUD basico en Python y FastAPI. No usa base de datos: cada servicio mantiene sus datos en memoria mediante diccionarios, por lo que la informacion se reinicia al apagar el proceso.

Cada microservicio es autocontenido: su `main.py` define su propia aplicacion FastAPI, modelos Pydantic, almacenamiento en memoria y endpoints CRUD. No existe una clase o fabrica CRUD compartida entre servicios.

## Analisis del reto

TelcoX necesita una capa de integracion entre canales digitales web/movil y sistemas core como BSS, facturacion, provision, inventario, SRI y gateways de pago. El objetivo principal es unificar la experiencia del cliente para consultar servicios activos, contratar o modificar productos, pagar facturas y recibir notificaciones confiables.

La arquitectura recomendada es desacoplada:

- API Gateway como punto de entrada para web y movil.
- OAuth 2.0 / OpenID Connect para autenticacion y autorizacion.
- Microservicios por dominio de negocio.
- Eventos asincronos para pagos, cambios de servicio, notificaciones y auditoria.
- Cache para consultas frecuentes, aplicando Cache-Aside o CQRS para separar lecturas rapidas de procesos transaccionales.
- Auditoria centralizada para registrar acciones de usuario y operaciones sensibles.
- Observabilidad con logs estructurados, metricas, trazas y alertas.

## Microservicios incluidos

| Servicio | Puerto sugerido | Base path | Recurso CRUD | Responsabilidad |
| --- | ---: | --- | --- | --- |
| Customer Service | 8001 | `/customer-service` | `/customers` | Datos basicos de clientes simulando consulta al BSS. |
| Catalog Service | 8002 | `/catalog-service` | `/products` | Planes, paquetes y servicios adicionales. |
| Service Status Service | 8003 | `/service-status-service` | `/active-services` | Estado de servicios activos, uso de datos y saldo. |
| Provisioning Service | 8004 | `/provisioning-service` | `/orders` | Ordenes de alta, cambio de plan y servicios adicionales. |
| Billing Service | 8005 | `/billing-service` | `/invoices` | Facturas, estado SRI y reenvio logico de comprobantes. |
| Payment Service | 8006 | `/payment-service` | `/payments` | Pagos e historial, simulando gateway externo. |
| Notification Service | 8007 | `/notification-service` | `/notifications` | Notificaciones por SMS, email y push. |
| Onboarding Service | 8008 | `/onboarding-service` | `/onboarding-cases` | Registro de nuevos clientes con documento y biometria. |
| Audit Service | 8009 | `/audit-service` | `/audit-events` | Registro auditable de acciones y eventos. |

## Endpoints CRUD comunes

Cada servicio expone:

- `GET /{basePath}/health`
- `GET /{basePath}/{recurso}`
- `POST /{basePath}/{recurso}`
- `GET /{basePath}/{recurso}/{item_id}`
- `PUT /{basePath}/{recurso}/{item_id}`
- `PATCH /{basePath}/{recurso}/{item_id}`
- `DELETE /{basePath}/{recurso}/{item_id}`

Formato para crear o actualizar:

```json
{
  "data": {
    "campo": "valor"
  }
}
```

Ejemplo:

```powershell
curl -X POST http://localhost:8001/customer-service/customers `
  -H "Content-Type: application/json" `
  -d "{\"data\":{\"document_id\":\"0922222222\",\"full_name\":\"Luis Perez\",\"status\":\"active\"}}"
```

## Ejecucion local

Crear entorno e instalar dependencias:

```powershell
cd outputs\telcox-fastapi-microservices
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Levantar un servicio:

```powershell
uvicorn services.customer_service.main:app --reload --port 8001
```

Levantar todos los servicios en ventanas ocultas de PowerShell:

```powershell
.\run_all.ps1
```

## Despliegue con Docker

Cada microservicio tiene su propio Dockerfile en una carpeta `setup`:

- `services/customer_service/setup/Dockerfile`
- `services/catalog_service/setup/Dockerfile`
- `services/service_status_service/setup/Dockerfile`
- `services/provisioning_service/setup/Dockerfile`
- `services/billing_service/setup/Dockerfile`
- `services/payment_service/setup/Dockerfile`
- `services/notification_service/setup/Dockerfile`
- `services/onboarding_service/setup/Dockerfile`
- `services/audit_service/setup/Dockerfile`

El contexto de build debe ser la raiz del proyecto `telcox-fastapi-microservices`, porque cada Dockerfile copia `requirements.txt` y la carpeta del servicio correspondiente.

Ejemplo para Customer Service:

```powershell
docker build -f services/customer_service/setup/Dockerfile -t telcox/customer-service:1.0.0 .
docker run --rm -p 8001:8000 telcox/customer-service:1.0.0
```

Comandos sugeridos:

```powershell
docker build -f services/catalog_service/setup/Dockerfile -t telcox/catalog-service:1.0.0 .
docker build -f services/service_status_service/setup/Dockerfile -t telcox/service-status-service:1.0.0 .
docker build -f services/provisioning_service/setup/Dockerfile -t telcox/provisioning-service:1.0.0 .
docker build -f services/billing_service/setup/Dockerfile -t telcox/billing-service:1.0.0 .
docker build -f services/payment_service/setup/Dockerfile -t telcox/payment-service:1.0.0 .
docker build -f services/notification_service/setup/Dockerfile -t telcox/notification-service:1.0.0 .
docker build -f services/onboarding_service/setup/Dockerfile -t telcox/onboarding-service:1.0.0 .
docker build -f services/audit_service/setup/Dockerfile -t telcox/audit-service:1.0.0 .
```

## CI/CD de Audit Service con GitHub Actions

El microservicio `audit_service` tiene configurado un pipeline en:

- `.github/workflows/audit-service-ci.yml`

El workflow usa:

- `runs-on: self-hosted`
- GitHub Container Registry: `ghcr.io`
- Imagen: `ghcr.io/jcbodero/telcox-audit-service`
- Helm chart: `services/audit_service/setup/helm`
- Namespace Kubernetes: `telcox`
- Variable GitHub Actions: `PUBLIC_HOST`

El pipeline se ejecuta cuando hay cambios en:

- `requirements.txt`
- `services/audit_service/**`
- `.github/workflows/audit-service-ci.yml`

Tambien puede ejecutarse manualmente desde GitHub con `workflow_dispatch`.

Configura esta variable en GitHub:

```text
Repository > Settings > Secrets and variables > Actions > Variables
PUBLIC_HOST=reto1.telcox.site
```

Requisitos en el servidor Ubuntu donde corre el runner:

```bash
docker --version
python3 --version
kubectl version --client
helm version
```

El usuario que ejecuta el runner debe poder usar Docker sin `sudo`:

```bash
sudo usermod -aG docker $USER
```

Despues de ese comando, cerrar sesion y volver a entrar.

Si la imagen queda privada en GHCR, crear un secret en Kubernetes:

```bash
kubectl create secret docker-registry ghcr-secret \
  --namespace telcox \
  --docker-server=ghcr.io \
  --docker-username=jcbodero \
  --docker-password=TU_TOKEN_GITHUB \
  --docker-email=TU_EMAIL
```

Y activar el secret en `services/audit_service/setup/helm/values.yaml`:

```yaml
imagePullSecrets:
  - name: ghcr-secret
```

Si la imagen es publica, no hace falta `imagePullSecrets`.

## Helm por microservicio

Cada microservicio tiene su propio chart Helm en una carpeta `helm`:

- `services/customer_service/setup/helm`
- `services/catalog_service/setup/helm`
- `services/service_status_service/setup/helm`
- `services/provisioning_service/setup/helm`
- `services/billing_service/setup/helm`
- `services/payment_service/setup/helm`
- `services/notification_service/setup/helm`
- `services/onboarding_service/setup/helm`
- `services/audit_service/setup/helm`

Cada chart incluye:

- `Chart.yaml`
- `values.yaml`
- `templates/deployment.yaml`
- `templates/service.yaml`

Ejemplo de despliegue manual para Audit Service:

```bash
helm upgrade --install audit-service services/audit_service/setup/helm \
  --namespace telcox \
  --create-namespace \
  --set image.repository=ghcr.io/jcbodero/telcox-audit-service \
  --set image.tag=latest
```

Ejemplo para Customer Service:

```bash
helm upgrade --install customer-service services/customer_service/setup/helm \
  --namespace telcox \
  --create-namespace \
  --set image.repository=ghcr.io/jcbodero/telcox-customer-service \
  --set image.tag=latest
```

## Traefik Ingress

Los charts Helm incluyen soporte para Traefik mediante `Ingress`:

- `templates/ingress.yaml`
- `values.yaml > ingress`

En K3s, Traefik suele venir instalado por defecto. Validar:

```bash
KUBECONFIG=/home/julio/.kube/config kubectl get pods -n kube-system | grep traefik
KUBECONFIG=/home/julio/.kube/config kubectl get ingressclass
```

Audit Service queda expuesto por defecto con Traefik, TLS :

```yaml
ingress:
  enabled: true
  className: traefik
  host: reto1.telcox.site
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
basePath: /audit-service
```

Los demas microservicios tienen `ingress.enabled: false` y pueden activarse con `--set ingress.enabled=true`.



Probar Audit Service sin `port-forward`:

```bash
curl https://reto1.telcox.site/audit-service/health
curl https://reto1.telcox.site/audit-service/audit-events
```

Si quieres activar Traefik para otro microservicio:

```bash
helm upgrade --install customer-service services/customer_service/setup/helm \
  --namespace telcox \
  --create-namespace \
  --set image.repository=ghcr.io/jcbodero/telcox-customer-service \
  --set image.tag=latest \
  --set ingress.enabled=true \
  --set ingress.host=reto1.telcox.site
```


## Cloudflare Tunnel para evitar CGNAT

Si tu proveedor usa CGNAT puede resolver el dominio pero el trafico externo no llega a tu router. Para ese caso el proyecto incluye una alternativa con Cloudflare Tunnel:

- `infra/cloudflare-tunnel/README.md`
- `infra/cloudflare-tunnel/config.example.yml`
- `infra/cloudflare-tunnel/cloudflared-telcox.service`

Cloudflare Tunnel abre una conexion saliente desde tu VM Ubuntu hacia Cloudflare, por lo que no necesitas abrir puertos en el router.

Flujo recomendado:

```text
https://reto1.telcox.site/audit-service/health
  -> Cloudflare Tunnel
    -> cloudflared en Ubuntu
      -> Traefik HTTPS NodePort
        -> audit-service
```

Para CI/CD, configura una variable en GitHub:

```text
Repository > Settings > Secrets and variables > Actions > Variables
PUBLIC_HOST=reto1.telcox.site
```

El workflow de `audit_service` usa `PUBLIC_HOST` para actualizar el host del Ingress durante el despliegue. Si no existe `PUBLIC_HOST`

## Autenticacion OAuth2/OIDC con Keycloak

El proyecto incluye una propuesta desplegable de Keycloak en el mismo dominio bajo otra ruta:

```text
https://reto1.telcox.site/auth
```

Archivos:

```text
infra/identity/keycloak
```

El flujo recomendado para web y movil es:

```text
Authorization Code Flow + PKCE
```

Para llamadas internas entre microservicios:

```text
Client Credentials Flow
```

Despliegue:

```bash
KUBECONFIG=/home/julio/.kube/config kubectl create namespace identity
KUBECONFIG=/home/julio/.kube/config kubectl create secret generic keycloak-admin \
  --namespace identity \
  --from-literal=username=admin \
  --from-literal=password='PASSWORD_ADMIN'
KUBECONFIG=/home/julio/.kube/config kubectl create secret generic keycloak-db \
  --namespace identity \
  --from-literal=password='PASSWORD_DB'
KUBECONFIG=/home/julio/.kube/config helm upgrade --install keycloak ./infra/identity/keycloak/setup/helm \
  --namespace identity \
  --create-namespace \
  --set global.host=reto1.telcox.site
```

Mas detalle:

```text
infra/identity/keycloak/README.md
```

La UI Next.js ya incluye login OIDC con PKCE usando Keycloak. Configuracion de consola y variables:

```text
ui/KEYCLOAK_SETUP.md
```

Documentacion OpenAPI por servicio:

- `http://localhost:8001/customer-service/docs`
- `http://localhost:8002/catalog-service/docs`
- `http://localhost:8003/service-status-service/docs`
- `http://localhost:8004/provisioning-service/docs`
- `http://localhost:8005/billing-service/docs`
- `http://localhost:8006/payment-service/docs`
- `http://localhost:8007/notification-service/docs`
- `http://localhost:8008/onboarding-service/docs`
- `http://localhost:8009/audit-service/docs`

## Frontend recomendado

Para la SPA web: React con TypeScript. Es una opcion madura, con gran ecosistema, buen soporte para OAuth/OIDC, componentes reutilizables y alta disponibilidad de talento.

Para la aplicacion movil multiplataforma: Flutter. Permite una experiencia consistente en iOS y Android, buen rendimiento y soporte robusto para biometria, push notifications y flujos de onboarding.

## Autenticacion recomendada

Usar OAuth 2.0 con OpenID Connect y Authorization Code Flow con PKCE. Es el flujo mas adecuado para SPA y movil porque evita manejar secretos de cliente en dispositivos del usuario y reduce el riesgo de interceptacion del codigo de autorizacion.

Para seguridad adicional:

- MFA adaptativo para operaciones sensibles.
- Biometria local del dispositivo para reautenticacion.
- Tokens de vida corta con refresh token rotativo.
- Scopes por dominio: `customers:read`, `payments:write`, `services:manage`.

Herramientas posibles: Auth0, Okta, Azure AD B2C / Microsoft Entra External ID, Amazon Cognito o Keycloak.

## Onboarding y biometria

El onboarding debe validar identidad con documento, prueba de vida y comparacion facial. Herramientas de industria posibles: Onfido, Jumio, Veriff, Facephi, AWS Rekognition o Azure AI Vision, dependiendo de requisitos legales, cobertura regional y presupuesto.

En esta implementacion, `Onboarding Service` expone un flujo simulado de KYC:

- `POST /onboarding-service/onboarding-cases/verify`: valida documento, consentimiento, prueba de vida y comparacion facial simulada.
- `POST /onboarding-service/onboarding-cases/{case_id}/auth-methods`: habilita metodos de acceso solo si la verificacion quedo `completed`.
- `GET /onboarding-service/security-recommendations`: lista herramientas recomendadas para identidad, documento, rostro y MFA.

El servicio no guarda imagenes ni plantillas biometricas crudas. Las evidencias enviadas se representan como referencias `sha256:*`; en produccion deberian almacenarse cifradas en un repositorio seguro o delegarse al proveedor KYC. La contrasena y passkeys se consideran responsabilidad del proveedor OIDC, por ejemplo Keycloak, Auth0, Okta, Microsoft Entra External ID o Amazon Cognito. La huella y el rostro para login se modelan como biometria local del dispositivo o WebAuthn/passkeys, no como datos biometricos centralizados.

## Notificaciones confiables

Para cumplir con la exigencia de al menos dos metodos, se recomienda email + SMS como base y push como canal adicional. En produccion, este servicio deberia usar cola de mensajes, reintentos, idempotencia, dead-letter queue y trazabilidad por evento.

## Persistencia y consultas frecuentes

Para persistencia y consultas frecuentes, la arquitectura objetivo usa:

- Base transaccional por microservicio.
- Base de auditoria append-only.
- Cache distribuida con Redis aplicando Cache-Aside.
- CQRS para separar comandos de consultas frecuentes.
- Patron Repository para reutilizar componentes de acceso a datos cuando exista persistencia real.

La implementacion incluye bases locales para desarrollo en `docker-compose.yml`, pero produccion no depende de Docker Compose. Para Kubernetes se agregan charts Helm propios:

- `infra/postgres/setup/helm`: PostgreSQL con `StatefulSet`, PVC, Secret, Service e inicializacion SQL.
- `infra/mongo/setup/helm`: MongoDB con `StatefulSet`, PVC, Secret, Service e inicializacion JS.

PostgreSQL queda como alternativa principal para auditoria por su consistencia, SQL, indices compuestos y soporte JSONB; MongoDB queda como alternativa documental para eventos flexibles. El script `infra/postgres/init.sql` crea `audit_events`, indices por `service`, `resource_id`, `resource_type`, `user_id`, `timestamp` y vistas de resumen/fallos. El script `infra/mongo/init.js` crea la coleccion equivalente con validacion e indices.

Buenas practicas aplicadas:

- `AuditRepository` + `AuditManager`: centralizan el registro de acciones de usuario.
- `AuditSink` como Strategy: permite escribir en memoria/archivo para desarrollo y en PostgreSQL cuando `AUDIT_BACKEND=postgres`.
- Redaccion de datos sensibles: tokens, contrasenas, imagenes y plantillas biometricas no se escriben en auditoria.
- `CachedRepository`: wrapper Cache-Aside reutilizable sobre cualquier repositorio.
- Invalidacion en escrituras: `create`, `update` y `delete` invalidan claves de lista e item.
- TTL configurable para consultas frecuentes.

Despliegue Kubernetes recomendado:

```bash
helm upgrade --install telcox-postgres infra/postgres/setup/helm \
  --namespace telcox \
  --create-namespace \
  --set auth.password='PASSWORD_POSTGRES'

helm upgrade --install telcox-mongo infra/mongo/setup/helm \
  --namespace telcox \
  --create-namespace \
  --set auth.password='PASSWORD_MONGO'
```

Los charts de `customer_service` y `onboarding_service` leen `POSTGRES_URL` desde el Secret `telcox-postgres-auth`, clave `url`. Si se usa un gestor de secretos externo, sobrescribir `audit.postgresUrlSecretName` y `audit.postgresUrlSecretKey` en los valores Helm del microservicio.

## Cumplimiento normativo

Considerar:

- Ley Organica de Proteccion de Datos Personales de Ecuador si aplica al mercado local.
- GDPR para usuarios o procesamiento relacionado con la Union Europea.
- PCI DSS para pagos con tarjeta.
- Normativas de telecomunicaciones del regulador local.
- Seguridad de comunicaciones con TLS, cifrado en reposo, gestion de secretos y minimo privilegio.
- Retencion de auditoria, consentimiento, derechos ARCO/DSAR y trazabilidad de cambios sensibles.

## Alta disponibilidad y nube

Para AWS, una implementacion razonable podria usar API Gateway, ECS Fargate o EKS, RDS/DynamoDB por servicio, ElastiCache Redis, SQS/SNS/EventBridge, CloudWatch, X-Ray, WAF y Secrets Manager.

Para Azure, una alternativa seria API Management, Azure Container Apps o AKS, Azure SQL/Cosmos DB, Azure Cache for Redis, Service Bus/Event Grid, Application Insights, Front Door/WAF y Key Vault.

Recomendaciones transversales:

- Despliegue multi-AZ.
- Auto-scaling y auto-healing.
- Health checks por servicio.
- Circuit breakers y timeouts en integraciones externas.
- DR con backups, IaC y runbooks.
- Observabilidad desde el inicio.

## Limitaciones de esta implementacion

- Los datos son en memoria y no sobreviven reinicios.
- No hay autenticacion real implementada; queda documentada como decision de arquitectura.
- No hay llamadas reales al BSS, SRI, inventario ni gateways.
- Los modelos son flexibles para mantener el CRUD basico y evitar acoplarse a una base de datos.
- Hay duplicacion intencional de codigo CRUD porque el objetivo es que cada microservicio sea independiente.

