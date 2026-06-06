# Configuracion Keycloak para la UI Next.js

La UI usa OAuth 2.0 / OpenID Connect con Authorization Code Flow + PKCE.

URL de Keycloak:

```text
https://reto1.telcox.site/auth
```

Realm:

```text
telcox
```

Cliente:

```text
telcox-web
```

## 1. Crear realm

En la consola:

```text
https://reto1.telcox.site/auth/admin
```

Crear realm:

```text
telcox
```

## 2. Crear cliente para Next.js

En el realm `telcox`:

```text
Clients > Create client
```

Valores:

```text
Client type: OpenID Connect
Client ID: telcox-web
Name: TelcoX Web
```

En capability config:

```text
Client authentication: Off
Authorization: Off
Standard flow: On
Direct access grants: Off
Implicit flow: Off
Service accounts roles: Off
```

En login settings:

```text
Valid redirect URIs:
https://reto1.telcox.site/login-callback
http://localhost:3000/login-callback

Valid post logout redirect URIs:
https://reto1.telcox.site/*
http://localhost:3000/*

Web origins:
https://reto1.telcox.site
http://localhost:3000
```

En advanced settings:

```text
Proof Key for Code Exchange Code Challenge Method: S256
```

## 3. Crear usuario de prueba

```text
Users > Add user
```

Ejemplo:

```text
Username: cliente.demo
Email: cliente.demo@telcox.com
Email verified: On
Enabled: On
```

Luego:

```text
Credentials > Set password
Temporary: Off
```

## 4. Configurar variables de Next

Crear `ui/.env.local`:

```bash
NEXT_PUBLIC_KEYCLOAK_URL=https://reto1.telcox.site/auth
NEXT_PUBLIC_KEYCLOAK_REALM=telcox
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=telcox-web
```

Para desarrollo local:

```bash
cd ui
npm install
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## 5. Flujo implementado

La UI:

- redirige a Keycloak con Authorization Code + PKCE
- recibe el callback en `/login-callback`
- intercambia el code por tokens
- guarda tokens en `localStorage`
- refresca token con refresh token
- envia `Authorization: Bearer <access_token>` en llamadas API
- cierra sesion usando el endpoint de logout OIDC

## 6. Endpoints utiles

OpenID configuration:

```text
https://reto1.telcox.site/auth/realms/telcox/.well-known/openid-configuration
```

Issuer:

```text
https://reto1.telcox.site/auth/realms/telcox
```
