# Observability Stack

Stack liviano de observabilidad para K3s:

- Grafana para consultar logs.
- Loki para almacenar logs.
- Promtail como DaemonSet para recolectar logs de todos los pods.

## Despliegue

Desde la raiz del repositorio en el servidor Ubuntu:

```bash
cd ~/actions-runner/_work/telcox-fastapi-microservices/telcox-fastapi-microservices

KUBECONFIG=/home/julio/.kube/config helm upgrade --install observability infra/observability/setup/helm \
  --namespace observability \
  --create-namespace \
  --set global.host=reto1.telcox.site \
  --set grafana.adminPassword='CAMBIA_ESTA_PASSWORD' \
  --wait \
  --timeout 5m
```

Validar:

```bash
KUBECONFIG=/home/julio/.kube/config kubectl get pods,svc,ingress -n observability
KUBECONFIG=/home/julio/.kube/config kubectl logs -n observability -l app.kubernetes.io/name=promtail --tail=50
```

Abrir:

```text
https://reto1.telcox.site/grafana
```

Usuario por defecto:

```text
admin
```

La clave es el valor de `grafana.adminPassword`.

## Consultas utiles en Grafana

Logs de todos los pods de TelcoX:

```logql
{namespace="telcox"}
```

Logs de un microservicio:

```logql
{namespace="telcox", app="customer-service"}
```

Errores:

```logql
{namespace="telcox"} |= "ERROR"
```

Keycloak:

```logql
{namespace="identity"}
```

## Exposicion

Solo Grafana se expone por Ingress. Loki queda interno dentro del cluster:

```text
Grafana -> http://loki.observability.svc.cluster.local:3100
Promtail -> Loki interno
```

