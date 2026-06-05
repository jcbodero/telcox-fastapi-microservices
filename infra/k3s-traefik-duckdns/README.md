# K3s Traefik + DuckDNS + Let's Encrypt

Esta configuracion prepara Traefik en K3s para emitir certificados gratuitos de Let's Encrypt usando DNS-01 con DuckDNS.

Usa un unico host publico de DuckDNS y enruta cada microservicio por base path:

```text
https://TU_SUBDOMINIO.duckdns.org/audit-service/health
https://TU_SUBDOMINIO.duckdns.org/customer-service/health
```

## 1. Crear subdominio en DuckDNS

En DuckDNS crea un subdominio, por ejemplo:

```text
telcox-demo.duckdns.org
```

Apunta el registro a tu IP publica. Aunque tu Kubernetes este en una IP privada, el DNS-01 challenge funciona porque Let's Encrypt valida un TXT en DuckDNS, no necesita entrar a tu servidor por HTTP.

## 2. Crear secret con token DuckDNS

No guardes el token real en Git.

```bash
KUBECONFIG=/home/julio/.kube/config kubectl create secret generic duckdns-token \
  --namespace kube-system \
  --from-literal=token='TU_TOKEN_DUCKDNS'
```

## 3. Configurar email y aplicar Traefik

Edita `traefik-duckdns-helmchartconfig.yaml` y reemplaza:

```text
TU_EMAIL@example.com
```

Luego aplica:

```bash
KUBECONFIG=/home/julio/.kube/config kubectl apply -f infra/k3s-traefik-duckdns/traefik-duckdns-helmchartconfig.yaml
```

Reinicia Traefik para que tome los valores:

```bash
KUBECONFIG=/home/julio/.kube/config kubectl rollout restart deployment/traefik -n kube-system
KUBECONFIG=/home/julio/.kube/config kubectl rollout status deployment/traefik -n kube-system
```

## 4. Desplegar Audit Service con DuckDNS

```bash
KUBECONFIG=/home/julio/.kube/config helm upgrade --install audit-service services/audit_service/setup/helm \
  --namespace telcox \
  --create-namespace \
  --set image.repository=ghcr.io/jcbodero/telcox-audit-service \
  --set image.tag=latest \
  --set ingress.host=TU_SUBDOMINIO.duckdns.org
```

## 5. Validar

```bash
KUBECONFIG=/home/julio/.kube/config kubectl get ingress -n telcox
KUBECONFIG=/home/julio/.kube/config kubectl logs -n kube-system deploy/traefik | grep -i acme
```

Probar:

```bash
curl -k https://TU_SUBDOMINIO.duckdns.org/audit-service/health
```

Cuando el certificado este emitido correctamente, prueba sin `-k`:

```bash
curl https://TU_SUBDOMINIO.duckdns.org/audit-service/health
```

## Notas

- DuckDNS puede tardar en propagar el TXT del DNS-01 challenge.
- El archivo `acme.json` se guarda en `/data/acme.json` dentro de Traefik mediante persistencia del chart.
- No uses `audit.telcox.local` con Let's Encrypt; `.local` no es un dominio publico valido.
