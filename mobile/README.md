# TelcoX Mobile

App Expo minima con dos pantallas:

- `Login`
- `Onboarding`

Arranque:

```bash
cd mobile
npm install
npm start
```

## Keycloak

La app usa el cliente OIDC:

```text
telcox-mobile
```

En Keycloak, configurar:

```text
Client authentication: Off
Standard flow: On
PKCE: S256
```

Para Expo web local:

```text
Valid redirect URIs:
http://localhost:8081/login-callback
http://localhost:19006/login-callback

Valid post logout redirect URIs:
http://localhost:8081/
http://localhost:19006/

Web origins:
http://localhost:8081
http://localhost:19006
```

Para pruebas rapidas puedes usar comodines:

```text
http://localhost:8081/*
http://localhost:19006/*
```
