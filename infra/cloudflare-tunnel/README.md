# Cloudflare Tunnel para TelcoX

Esta opcion evita CGNAT porque el servidor Ubuntu inicia una conexion saliente hacia Cloudflare. No necesitas abrir puertos en el router.

Arquitectura:

```text
Internet
  -> Cloudflare HTTPS
    -> cloudflared en Ubuntu
      -> Traefik/K3s NodePort HTTPS
        -> audit-service
```

## Requisito importante

Para tener un dominio estable como:

```text
https://reto1.telcox.site/audit-service/health
```

necesitas un dominio administrado en Cloudflare. Cloudflare Tunnel es gratis, pero el dominio debe existir y estar en Cloudflare.

Si no tienes dominio propio, puedes usar `trycloudflare`, pero el dominio cambia al reiniciar:

```bash
cloudflared tunnel --url https://127.0.0.1:31645 --no-tls-verify
```

## Opcion recomendada: tunnel nombrado

### 1. Instalar cloudflared en Ubuntu

```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

### 2. Iniciar sesion con Cloudflare

```bash
cloudflared tunnel login
```

Esto abrira una URL. Inicia sesion y selecciona tu dominio.

### 3. Crear el tunnel

```bash
cloudflared tunnel create telcox-tunnel
```

Guarda el ID que imprime Cloudflare. Tambien creara un archivo parecido a:

```text
/home/julio/.cloudflared/TUNNEL_ID.json
```

### 4. Crear DNS publico hacia el tunnel

Ejemplo con host `reto1.telcox.site`:

```bash
cloudflared tunnel route dns telcox-tunnel reto1.telcox.site
```

### 5. Crear configuracion del tunnel

Copia el ejemplo:

```bash
mkdir -p /home/julio/.cloudflared
cp infra/cloudflare-tunnel/config.example.yml /home/julio/.cloudflared/telcox-tunnel.yml
```

Edita:

```bash
nano /home/julio/.cloudflared/telcox-tunnel.yml
```

Reemplaza:

```text
TUNNEL_ID
reto1.telcox.site
/home/julio/.cloudflared/TUNNEL_ID.json
```

El servicio apunta a:

```text
https://127.0.0.1:31645
```

Ese puerto corresponde al NodePort HTTPS de Traefik en tu K3s.

Valida tu puerto real:

```bash
KUBECONFIG=/home/julio/.kube/config kubectl get svc -n kube-system traefik
```

### 6. Actualizar host del Ingress

Desplegar Audit Service con el mismo host publico:

```bash
KUBECONFIG=/home/julio/.kube/config helm upgrade --install audit-service ./services/audit_service/setup/helm \
  --namespace telcox \
  --create-namespace \
  --set image.repository=ghcr.io/jcbodero/telcox-audit-service \
  --set image.tag=latest \
  --set ingress.host=reto1.telcox.site
```

En GitHub Actions configura:

```text
Repository > Settings > Secrets and variables > Actions > Variables
PUBLIC_HOST=reto1.telcox.site
```

### 7. Instalar systemd para arranque automatico

Copia el servicio:

```bash
sudo cp infra/cloudflare-tunnel/cloudflared-telcox.service /etc/systemd/system/cloudflared-telcox.service
```

Si tu usuario no es `julio`, edita el archivo:

```bash
sudo nano /etc/systemd/system/cloudflared-telcox.service
```

Valida la ruta del binario:

```bash
which cloudflared
```

Si no devuelve `/usr/bin/cloudflared`, ajusta `ExecStart` en el servicio.

Activar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudflared-telcox
sudo systemctl start cloudflared-telcox
sudo systemctl status cloudflared-telcox
```

Ver logs:

```bash
journalctl -u cloudflared-telcox -f
```

### 8. Probar

```bash
curl https://reto1.telcox.site/audit-service/health
curl https://reto1.telcox.site/audit-service/audit-events
```

## Notas

- No necesitas DuckDNS para Cloudflare Tunnel.
- No necesitas abrir puertos 80/443 en el router.
- Si Traefik cambia de NodePort HTTPS, actualiza `config.example.yml` y `/home/julio/.cloudflared/telcox-tunnel.yml`.
- Si prefieres apuntar a HTTP de Traefik, usa el NodePort HTTP y cambia el Ingress a entrypoint `web`.

