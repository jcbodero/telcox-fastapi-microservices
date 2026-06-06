# TelcoX - Arquitectura Aplicada, On-Premise y AWS

## Resumen

Este documento consolida lo que ya fue aplicado en el proyecto TelcoX y como se organiza la arquitectura actual en una maquina virtual on-premise, junto con una propuesta equivalente en AWS.

La solucion esta basada en microservicios FastAPI, frontend web en Next.js, una app movil en Expo/React Native, autenticacion OIDC con Keycloak, auditoria centralizada, observabilidad con Loki/Grafana/Promtail y despliegue Kubernetes con Helm.

Los diagramas editables de arquitectura y datos estan disponibles en `docs/TELCOX_ARCHITECTURE.drawio`.
La version HTML navegable con Mermaid, Draw.io integrado y descarga a PDF esta disponible en `docs/ARCHITECTURE_ONPREM_AWS.html`.

## Lo Aplicado En El Proyecto

### Frontend Web

- Login OIDC con Keycloak usando Authorization Code Flow con PKCE.
- Bloqueo del dashboard hasta completar onboarding.
- `OnboardingGate` como barrera de entrada antes del panel principal.
- Flujo de onboarding con verificacion de identidad y habilitacion de metodos de acceso.

### Frontend Movil

- App Expo/React Native en `mobile/`.
- Pantalla de login conectada al mismo flujo OIDC.
- Pantalla principal de onboarding con verificacion de identidad y habilitacion de acceso.
- React Native se eligio porque permite reutilizar logica compartida de autenticacion, validacion, contratos de API y flujo de onboarding entre web y movil, sin compartir componentes visuales. Eso reduce duplicacion y mantiene independencia de UI por plataforma.

### Microservicios

- `customer_service`
- `catalog_service`
- `service_status_service`
- `provisioning_service`
- `billing_service`
- `payment_service`
- `notification_service`
- `onboarding_service`
- `audit_service`
- servicios externos simulados para KYC, OSS, pagos y notificaciones

### Seguridad Y Autenticacion

- Keycloak como proveedor de identidad.
- PKCE para web y movil.
- Tokens de vida corta con refresco.
- Bloqueo de acceso al portal si el onboarding no esta verificado.
- Certificados SSL/TLS aplicados en las comunicaciones expuestas por Ingress, gateway y frontend.
- Cifrado en base de datos para proteger informacion sensible en reposo.
- Politica de seguridad de datos aplicable desde el inicio del sistema, incluyendo clasificacion, retencion, consentimiento y minimizacion de datos.

### Auditoria

- Registro de acciones por usuario en `customer_service` y `onboarding_service`.
- Servicio dedicado `audit_service`.
- Persistencia de auditoria en memoria para desarrollo y opcion de PostgreSQL para escenarios persistentes.
- Preparacion para observabilidad de eventos con logs estructurados.

### Persistencia Y Consultas Frecuentes

- Propuesta de patron `Cache-Aside` para lecturas frecuentes.
- Patron `Repository` para desacoplar acceso a datos.
- Alternativa de cache distribuida con Redis.
- Separacion entre auditoria transaccional y observabilidad.

### Diagramas De Base De Datos De Microservicios

Los microservicios implementados manejan un modelo logico por servicio. En el entorno actual de demo/laboratorio, la mayoria de repositorios usan diccionarios en memoria; la infraestructura Kubernetes ya incluye PostgreSQL y MongoDB, y la auditoria puede persistir en PostgreSQL cuando `AUDIT_BACKEND=postgres` esta habilitado.

El diagrama editable correspondiente esta incluido como pagina **Datos MS** en `docs/TELCOX_ARCHITECTURE.drawio`.

```mermaid
erDiagram
  CUSTOMERS {
    string id PK
    string document_id
    string full_name
    string email
    string phone
    string status
    string segment
    string identity_status
    string identity_provider
    string created_at
    string updated_at
  }

  PRODUCTS {
    string id PK
    string name
    string type
    float monthly_price
    string currency
    json features
    string created_at
    string updated_at
  }

  ACTIVE_SERVICES {
    string id PK
    string customer_id FK
    string product_id FK
    string status
    float data_used_gb
    float data_limit_gb
    float balance
    string created_at
    string updated_at
  }

  PROVISIONING_ORDERS {
    string id PK
    string customer_id FK
    string product_id FK
    string operation
    string status
    string channel
    string network_reference_id
    string network_node
    string external_system
    string created_at
    string updated_at
  }

  INVOICES {
    string id PK
    string customer_id FK
    float amount
    string currency
    string status
    string due_date
    string sri_status
    string sri_access_key
    string external_system
    string created_at
    string updated_at
  }

  PAYMENTS {
    string id PK
    string customer_id FK
    string invoice_id FK
    float amount
    string currency
    string method
    string status
    string gateway_reference
    string external_system
    string created_at
    string updated_at
  }

  NOTIFICATIONS {
    string id PK
    string customer_id FK
    string channel
    string event_type
    string message
    string status
    int attempts
    string gateway_message_id
    string external_system
    string created_at
    string updated_at
  }

  ONBOARDING_CASES {
    string id PK
    string document_id
    string full_name
    string email
    string phone
    string document_type
    boolean consent_accepted
    string document_check
    string face_match
    string liveness_check
    string risk_level
    string status
    string identity_provider
    string kyc_verification_id
    string created_at
    string updated_at
  }

  CONSENTS {
    string id PK
    string user_id FK
    boolean accepted
    string consent_version
    json consent_scope
    string accepted_at
    string source
  }

  AUDIT_EVENTS {
    string id PK
    string service
    string action
    string resource_type
    string resource_id
    string status
    json payload_in
    json payload_out
    string timestamp
    float duration_ms
    string error_message
    json metadata
  }

  CUSTOMERS ||--o{ ACTIVE_SERVICES : customer_id
  PRODUCTS ||--o{ ACTIVE_SERVICES : product_id
  CUSTOMERS ||--o{ PROVISIONING_ORDERS : customer_id
  PRODUCTS ||--o{ PROVISIONING_ORDERS : product_id
  CUSTOMERS ||--o{ INVOICES : customer_id
  INVOICES ||--o{ PAYMENTS : invoice_id
  CUSTOMERS ||--o{ PAYMENTS : customer_id
  CUSTOMERS ||--o{ NOTIFICATIONS : customer_id
  CUSTOMERS ||--o{ CONSENTS : user_id
  ONBOARDING_CASES ||--o{ AUDIT_EVENTS : resource_id
```

Resumen por microservicio:

- `customer_service`: entidad logica `customers`, cache TTL y eventos de auditoria locales.
- `catalog_service`: entidad logica `products` para planes, paquetes y addons.
- `service_status_service`: entidad logica `active_services`, relacionada con cliente y producto.
- `provisioning_service`: entidad logica `provisioning_orders`, relacionada con cliente, producto y OSS externo.
- `billing_service`: entidad logica `invoices`, relacionada con cliente y SRI externo.
- `payment_service`: entidad logica `payments`, relacionada con cliente, factura y gateway de pagos.
- `notification_service`: entidad logica `notifications`, relacionada con cliente y gateway de notificaciones.
- `onboarding_service`: entidad logica `onboarding_cases` y consentimientos explicitos de privacidad, documentos y biometria.
- `audit_service`: entidad logica `audit_events`; ademas `customer_service` y `onboarding_service` pueden escribir `audit_events` en PostgreSQL si se configura el backend persistente.

### Infraestructura

- Helm charts por microservicio.
- Helm charts propios para PostgreSQL y MongoDB en Kubernetes.
- Helm para observabilidad con Grafana, Loki y Promtail.
- Helm para Keycloak.
- WAF de Cloudflare aplicado al dominio publico del sistema.
- Despliegues CI/CD con GitHub Actions para microservicios, UI y observabilidad.
- Dockerfiles mas livianos con imagenes `slim` y `alpine` donde aplica.
- Contenedores no-root para los servicios Python.
- `uvicorn` limitado a un solo worker por contenedor.
- Requests y limits ajustados para poder convivir en una maquina pequena.

### Portal De Manuales

La UI incorpora una seccion de manuales en `/manuales`, generada desde los archivos de `docs/` y servida como contenido estatico dentro de la misma imagen del frontend.

El despliegue de manuales ya queda integrado al pipeline `ui-ci.yml`:

- El workflow se dispara tambien cuando cambian archivos en `docs/**` o scripts de generacion de manuales.
- El paso `Prepare manuals static files` ejecuta `scripts/prepare_ui_manuals.py`.
- El script regenera `docs/ARCHITECTURE_ONPREM_AWS.html` y copia los manuales a `ui/public/manuales`.
- Next.js incluye esos archivos estaticos en la imagen Docker de la UI.
- Kubernetes sirve los manuales desde la misma aplicacion en `/manuales`.

La seguridad de esta seccion no usa Keycloak. Se aplica Basic Auth en Traefik mediante un `Middleware` dedicado y un Ingress especifico para `/manuales`, con prioridad mayor que el Ingress general de la UI.

El secreto requerido se llama `telcox-manuals-basic-auth` y se crea automaticamente desde GitHub Actions usando el secret `MANUALS_BASIC_AUTH_USERS`, cuyo valor debe ser una linea `htpasswd`, por ejemplo:

```bash
htpasswd -nbB usuario 'contrasena-segura'
```

Con este esquema:

- `/` mantiene el flujo normal de la UI y Keycloak.
- `/manuales` usa usuario y contrasena via Basic Auth.
- Los archivos HTML, Markdown, Draw.io, Word, imagenes y otros manuales quedan servidos desde `/manuales`.

## Arquitectura On-Premise

La arquitectura on-premise actual esta pensada para correr sobre una maquina virtual o un cluster Kubernetes pequeno, con exposicion publica via Traefik o Cloudflare Tunnel si existe CGNAT.

### Diagrama General

```mermaid
flowchart LR
  U[Usuario web o movil] --> K[Keycloak]
  U --> M[App movil React Native]
  K --> G[API Gateway / Traefik]
  M --> G
  G --> S[Microservicios FastAPI]
  S --> A[Audit Service]
  S --> P[(PostgreSQL)]
  S --> N[(MongoDB)]
  S --> L[Loki]
  L --> F[Grafana]
```

### Componentes

- **UI web**: Next.js
- **UI movil**: Expo / React Native
- **Gateway de entrada**: Traefik
- **Identidad**: Keycloak
- **Servicios de negocio**: microservicios FastAPI
- **Auditoria**: servicio dedicado + logs centralizados
- **Bases de datos**: PostgreSQL y MongoDB en Kubernetes
- **Observabilidad**: Grafana + Loki + Promtail
- **Exposicion externa alternativa**: Cloudflare Tunnel
- **Servicios externos simulados**: namespace independiente `external-sim` para KYC, OSS, pago, notificaciones y SRI.

### Caracteristicas Operativas

- Rolling updates.
- Liveness/readiness probes con delays para evitar reinicios prematuros.
- Auto-healing por Kubernetes.
- Tolerancia a fallos por replica unica controlada, con reinicio automatico de pods.
- Logs centralizados para diagnostico.
- Separacion por charts y releases para cada componente.

### Consideraciones De On-Premise

- Adecuado para un laboratorio, demo o entorno de despliegue inicial.
- El punto mas sensible es la disponibilidad del nodo unico.
- Si la VM cae, la recuperacion depende de backups y de la capacidad de reconstruccion del entorno.
- Para alta disponibilidad real, habria que pasar a un cluster con varios nodos.
- El despliegue actual corre sobre un servidor con 3 CPU y 4 GB de RAM, por lo que los recursos fueron ajustados para operar dentro de ese presupuesto.

## Arquitectura Objetivo En AWS

La version en AWS debe conservar la modularidad actual, pero usando servicios gestionados para reducir carga operativa.

### Propuesta Base

- **Frontend web**: S3 + CloudFront, o ECS/App Runner si se necesita SSR.
- **Frontend movil**: distribucion nativa iOS/Android, consumiendo la misma API.
- **Microservicios**: ECS Fargate o EKS.
- **Base transaccional**: RDS PostgreSQL.
- **Cache**: ElastiCache Redis.
- **Auditoria y logs**: CloudWatch Logs, con opcion de Grafana administrado.
- **Almacenamiento de archivos**: S3.
- **Seguridad**: IAM, Secrets Manager, WAF, ACM.
- **Balanceo**: ALB.

### Diagrama AWS

```mermaid
flowchart LR
  U[Usuario web o movil] --> CF[CloudFront / ALB]
  CF --> ID[Keycloak / OIDC]
  CF --> E[ECS Fargate o EKS]
  E --> R[(RDS PostgreSQL)]
  E --> X[(ElastiCache Redis)]
  E --> B[(S3)]
  E --> W[CloudWatch / Grafana]
```

### Alta Disponibilidad En AWS

- Despliegue multi-AZ.
- RDS Multi-AZ.
- Auto Scaling para microservicios.
- Health checks en ALB.
- Reinicio automatico de tareas fallidas.
- Backups automaticos y snapshots.
- IaC con Terraform o AWS CDK.

### Recuperacion Ante Desastres

- Backups programados de bases de datos.
- Versionado de imagenes en ECR.
- Infraestructura reproducible con IaC.
- Runbooks de recuperacion.
- Exportacion de logs y metricas.

## Cumplimiento Normativo

La solucion ya incorpora controles base de cumplimiento normativo para telecom y datos sensibles. Estos controles no sustituyen una certificacion formal, pero dejan la arquitectura preparada para operar bajo marcos regulatorios locales, regionales y sectoriales.

La solucion ya tiene:

- Consideracion de la ley local de proteccion de datos del pais de operacion como marco principal de tratamiento de datos personales.
- Preparacion para GDPR cuando exista tratamiento de datos de usuarios de la Union Europea, incluyendo minimizacion, consentimiento, trazabilidad y eliminacion de datos.
- Separacion del `payment_service` y simulacion de pasarela externa, dejando el alcance preparado para PCI DSS si se procesan pagos con tarjeta.
- Consideracion de normativa especifica de seguridad de comunicaciones aplicable al sector telecom.
- SSL/TLS en transito mediante certificados aplicados en Ingress, gateway y frontend.
- WAF implementado con Cloudflare para proteger el dominio publico ante trafico malicioso, ataques comunes de capa web y reglas de filtrado perimetral.
- Cifrado en reposo para proteger informacion sensible almacenada en base de datos.
- Politicas de clasificacion, retencion y eliminacion segura de datos desde el diseno de seguridad.
- Consentimiento explicito para procesos de onboarding que involucren biometria, documentos o verificacion de identidad.
- Trazabilidad de acciones de usuario y accesos privilegiados mediante `audit_service`, registros de eventos y logs centralizados.
- Observabilidad operativa con Grafana, Loki y Promtail para facilitar investigacion, evidencia tecnica y respuesta ante incidentes.

## Flujo De Despliegue CI/CD DevOps

El proyecto ya tiene implementado un flujo DevOps CI/CD con GitHub Actions, GitHub Container Registry, Docker, Helm y Kubernetes.

Flujo aplicado:

- Los cambios en `main` o la ejecucion manual con `workflow_dispatch` disparan los pipelines.
- Los workflows detectan cambios por ruta para evitar despliegues innecesarios.
- Los servicios Python se validan con compilacion previa mediante `python3 -m compileall`.
- Las imagenes Docker se construyen con tags por `GITHUB_SHA` y `latest`.
- Las imagenes se publican en GitHub Container Registry (`ghcr.io`).
- El runner self-hosted valida acceso al cluster Kubernetes.
- Los despliegues se realizan con `helm upgrade --install`.
- Kubernetes verifica el rollout de cada deployment antes de cerrar el pipeline.
- Si ocurre una falla, el pipeline muestra diagnosticos con `kubectl get`, `kubectl describe` y `kubectl logs`.

Pipelines implementados:

- `microservices-ci.yml`: construye, publica y despliega los microservicios FastAPI.
- `ui-ci.yml`: construye la UI Next.js, publica la imagen y despliega el frontend.
- `audit-service-ci.yml`: permite despliegue manual del servicio de auditoria.
- `external-services-ci.yml`: construye, publica y despliega los servicios externos simulados en el namespace `external-sim`.

Este flujo puede evolucionar a DevSecOps incorporando controles de seguridad automatizados dentro del pipeline, por ejemplo:

- Analisis SAST de codigo.
- Escaneo de dependencias y SBOM.
- Escaneo de imagenes Docker antes de publicarlas.
- Validacion de secretos expuestos.
- Analisis de IaC y manifiestos Helm/Kubernetes.
- Firmado de imagenes y politicas de admision en Kubernetes.
- Gates de cumplimiento para impedir despliegues con vulnerabilidades criticas.

## Recomendacion De Diseno

- Mantener los microservicios desacoplados.
- No compartir modulos `shared` entre servicios.
- Reutilizar contratos, no logica de dominio.
- Usar patrones `Repository`, `Strategy` y `Cache-Aside`.
- Tratar la auditoria como un flujo separado de la observabilidad.

## Estado De Entrega

La solucion ya incorpora:

- login web con Keycloak
- bloqueo de dashboard hasta verificar onboarding
- onboarding web funcional
- app movil base con login y onboarding
- infraestructura de bases de datos en Kubernetes
- observabilidad con Loki/Grafana/Promtail
- ajustes de imagenes y recursos para un entorno de recursos limitados

## Conclusion

La arquitectura actual es adecuada como plataforma on-premise sobre una VM o cluster pequeno. Para AWS, la misma solucion puede evolucionar a una plataforma gestionada con ECS Fargate, RDS, CloudFront, CloudWatch y Secrets Manager, manteniendo el desacoplamiento y mejorando disponibilidad, escalabilidad y resiliencia.

## Glosario De Siglas

- `PKCE`: Proof Key for Code Exchange. Extension del flujo OAuth 2.0 para proteger clientes publicos.
- `OIDC`: OpenID Connect. Capa de autenticacion construida sobre OAuth 2.0.
- `OAuth 2.0`: Protocolo de autorizacion para conceder acceso a recursos sin compartir contrasenas.
- `TLS`: Transport Layer Security. Protocolo de cifrado en transito.
- `SSL`: Secure Sockets Layer. Nombre historico usado comunmente para referirse a TLS.
- `KYC`: Know Your Customer. Verificacion de identidad y riesgo del usuario.
- `BSS`: Business Support Systems. Sistemas de soporte al negocio en telecom.
- `OSS`: Operations Support Systems. Sistemas de soporte operativo en telecom.
- `SRI`: Servicio de Rentas Internas. En este proyecto, referencia a validacion fiscal.
- `MFA`: Multi-Factor Authentication. Autenticacion multifactor.
- `SSR`: Server-Side Rendering. Renderizado en servidor.
- `CQRS`: Command Query Responsibility Segregation. Separacion de comandos y consultas.
- `DR`: Disaster Recovery. Recuperacion ante desastres.
- `HA`: High Availability. Alta disponibilidad.
- `WAF`: Web Application Firewall. Firewall de aplicaciones web.
- `IAM`: Identity and Access Management. Gestion de identidades y permisos.
- `ALB`: Application Load Balancer. Balanceador de aplicaciones de AWS.
- `ECS`: Elastic Container Service. Orquestacion de contenedores en AWS.
- `EKS`: Elastic Kubernetes Service. Kubernetes administrado en AWS.
- `RDS`: Relational Database Service. Base de datos relacional administrada por AWS.
- `ECR`: Elastic Container Registry. Registro de imagenes de AWS.
- `S3`: Simple Storage Service. Almacenamiento de objetos de AWS.
- `SNS`: Simple Notification Service. Servicio de notificaciones de AWS.
- `SQS`: Simple Queue Service. Servicio de colas de AWS.
