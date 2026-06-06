# Keycloak OAuth2/OIDC para TelcoX

Este despliegue agrega un proveedor de identidad autohospedado usando Keycloak en el mismo dominio del proyecto:

```text
https://reto1.telcox.site/auth
```

El flujo recomendado para TelcoX es:

```text
Authorization Code Flow + PKCE
```

Uso:

- SPA web: Authorization Code + PKCE.
- App movil: Authorization Code + PKCE con navegador del sistema.
- Microservicio a microservicio: Client Credentials.

## Arquitectura

```text
Usuario
  -> https://reto1.telcox.site/auth
    -> Cloudflare Tunnel
      -> Traefik
        -> Keycloak
          -> PostgreSQL
```

Los microservicios no almacenan usuarios ni contrasenas. Deben validar JWT emitidos por Keycloak.

## Archivos

```text
infra/identity/keycloak/setup/helm
```

Incluye:

- Keycloak Deployment
- PostgreSQL Deployment
- PVC para PostgreSQL
- Services
- Ingress en `/auth`

## 1. Crear namespace

```bash
KUBECONFIG=/home/julio/.kube/config kubectl create namespace identity
```

Si ya existe:

```bash
KUBECONFIG=/home/julio/.kube/config kubectl get namespace identity
```

## 2. Crear secretos

Generar passwords:

```bash
openssl rand -base64 24
openssl rand -base64 24
```

Crear secretos:

```bash
KUBECONFIG=/home/julio/.kube/config kubectl create secret generic keycloak-admin \
  --namespace identity \
  --from-literal=username=admin \
  --from-literal=password='PASSWORD_ADMIN'
```

```bash
KUBECONFIG=/home/julio/.kube/config kubectl create secret generic keycloak-db \
  --namespace identity \
  --from-literal=password='PASSWORD_DB'
```

No subas estas claves al repositorio.

## 3. Desplegar Keycloak

Desde la raiz del repositorio:

```bash
KUBECONFIG=/home/julio/.kube/config helm upgrade --install keycloak ./infra/identity/keycloak/setup/helm \
  --namespace identity \
  --create-namespace \
  --set global.host=reto1.telcox.site
```

Verificar:

```bash
KUBECONFIG=/home/julio/.kube/config kubectl get pods,svc,ingress -n identity
KUBECONFIG=/home/julio/.kube/config kubectl rollout status deployment/keycloak -n identity --timeout=180s
```

## 4. Probar acceso

```bash
curl -I https://reto1.telcox.site/auth
```

Abrir en navegador:

```text
https://reto1.telcox.site/auth
```

Admin console:

```text
https://reto1.telcox.site/auth/admin
```

## 5. Configurar realm TelcoX

Entrar con:

```text
usuario: admin
password: PASSWORD_ADMIN
```

Crear realm:

```text
telcox
```

Issuer esperado:

```text
https://reto1.telcox.site/auth/realms/telcox
```

OpenID configuration:

```text
https://reto1.telcox.site/auth/realms/telcox/.well-known/openid-configuration
```

## 6. Crear clientes

### SPA web

Cliente:

```text
telcox-web
```

Configuracion:

```text
Client type: OpenID Connect
Client authentication: Off
Standard flow: On
Direct access grants: Off
PKCE: S256
```

Redirect URIs de ejemplo:

```text
https://reto1.telcox.site/*
http://localhost:3000/*
```

### App movil

Cliente:

```text
telcox-mobile
```

Configuracion:

```text
Client authentication: Off
Standard flow: On
PKCE: S256
```

Redirect URI ejemplo:

```text
com.telcox.app://callback
```

### Servicios backend

Cliente:

```text
telcox-services
```

Configuracion:

```text
Client authentication: On
Service accounts roles: On
Client Credentials Flow
```

Usar para llamadas internas entre microservicios.

## 7. Roles y scopes sugeridos

Roles:

```text
customer
support-agent
admin
service-account
```

Scopes:

```text
customers:read
services:read
services:write
payments:read
payments:write
audit:write
```

## 8. Seguridad recomendada

- Access token corto: 5 a 15 minutos.
- Refresh token rotativo.
- MFA para pagos, cambio de plan y datos personales.
- WebAuthn/passkeys para usuarios administrativos.
- Auditoria de login, logout y cambios sensibles.
- No usar Password Grant ni Implicit Flow.

## 9. Validacion desde microservicios

Los microservicios FastAPI deben validar:

- issuer: `https://reto1.telcox.site/auth/realms/telcox`
- firma JWT via JWKS
- expiracion
- audience
- roles/scopes

JWKS se obtiene desde el `jwks_uri` publicado en:

```text
https://reto1.telcox.site/auth/realms/telcox/.well-known/openid-configuration
```
