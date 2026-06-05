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

| Servicio | Puerto sugerido | Recurso CRUD | Responsabilidad |
| --- | ---: | --- | --- |
| Customer Service | 8001 | `/customers` | Datos basicos de clientes simulando consulta al BSS. |
| Catalog Service | 8002 | `/products` | Planes, paquetes y servicios adicionales. |
| Service Status Service | 8003 | `/active-services` | Estado de servicios activos, uso de datos y saldo. |
| Provisioning Service | 8004 | `/orders` | Ordenes de alta, cambio de plan y servicios adicionales. |
| Billing Service | 8005 | `/invoices` | Facturas, estado SRI y reenvio logico de comprobantes. |
| Payment Service | 8006 | `/payments` | Pagos e historial, simulando gateway externo. |
| Notification Service | 8007 | `/notifications` | Notificaciones por SMS, email y push. |
| Onboarding Service | 8008 | `/onboarding-cases` | Registro de nuevos clientes con documento y biometria. |
| Audit Service | 8009 | `/audit-events` | Registro auditable de acciones y eventos. |

## Endpoints CRUD comunes

Cada servicio expone:

- `GET /health`
- `GET /{recurso}`
- `POST /{recurso}`
- `GET /{recurso}/{item_id}`
- `PUT /{recurso}/{item_id}`
- `PATCH /{recurso}/{item_id}`
- `DELETE /{recurso}/{item_id}`

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
curl -X POST http://localhost:8001/customers `
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

Documentacion OpenAPI por servicio:

- `http://localhost:8001/docs`
- `http://localhost:8002/docs`
- `http://localhost:8003/docs`
- `http://localhost:8004/docs`
- `http://localhost:8005/docs`
- `http://localhost:8006/docs`
- `http://localhost:8007/docs`
- `http://localhost:8008/docs`
- `http://localhost:8009/docs`

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

## Notificaciones confiables

Para cumplir con la exigencia de al menos dos metodos, se recomienda email + SMS como base y push como canal adicional. En produccion, este servicio deberia usar cola de mensajes, reintentos, idempotencia, dead-letter queue y trazabilidad por evento.

## Persistencia y consultas frecuentes

Aunque este codigo no usa base de datos por solicitud del usuario, la arquitectura objetivo podria usar:

- Base transaccional por microservicio.
- Base de auditoria append-only.
- Cache distribuida con Redis aplicando Cache-Aside.
- CQRS para separar comandos de consultas frecuentes.
- Patron Repository para reutilizar componentes de acceso a datos cuando exista persistencia real.

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
