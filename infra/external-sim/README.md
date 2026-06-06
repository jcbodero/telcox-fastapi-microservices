# External Simulated Services

Namespace separado para los servicios externos simulados de TelcoX.

Incluye:

- `kyc-identity-mock`
- `network-oss-mock`
- `notification-gateway-mock`
- `payment-gateway-mock`
- `sri-service`

Despliegue:

```bash
helm upgrade --install external-sim infra/external-sim/setup/helm \
  --namespace external-sim \
  --create-namespace
```

Este namespace se usa para separar proveedores simulados y componentes externos del namespace principal de TelcoX.
