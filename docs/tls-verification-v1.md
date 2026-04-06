# TLS Verification v1 (Post-Fix)

## Objetivo
Validar, despues de actualizar el stack `leadflow` en Portainer, que TLS en origen ya es valido para Cloudflare `Full (strict)` y que no hay error 526.

## Alcance
- No despliega cambios automaticamente.
- Este checklist se ejecuta despues del `Update the stack` en Portainer.

## URLs a probar
- `https://exitosos.com`
- `https://members.exitosos.com`
- `https://admin.exitosos.com`
- `https://api.exitosos.com`

## Comandos OpenSSL (SNI al origen)
Usar la IP del origen:

```bash
ORIGIN_IP=${LEADFLOW_SWARM_ORIGIN_IP}
```

### 1) Apex
```bash
openssl s_client -connect ${ORIGIN_IP}:443 -servername exitosos.com </dev/null \
  | openssl x509 -noout -subject -issuer -ext subjectAltName
```

### 2) Members
```bash
openssl s_client -connect ${ORIGIN_IP}:443 -servername members.exitosos.com </dev/null \
  | openssl x509 -noout -subject -issuer -ext subjectAltName
```

### 3) Admin
```bash
openssl s_client -connect ${ORIGIN_IP}:443 -servername admin.exitosos.com </dev/null \
  | openssl x509 -noout -subject -issuer -ext subjectAltName
```

### 4) API
```bash
openssl s_client -connect ${ORIGIN_IP}:443 -servername api.exitosos.com </dev/null \
  | openssl x509 -noout -subject -issuer -ext subjectAltName
```

## Senales de exito
- Emisor confiable (por ejemplo Let's Encrypt), no certificado por defecto de Traefik.
- SANs que incluyan explicitamente el host consultado.
- Las 4 URLs responden sin 526 desde navegador/Cloudflare.

## Senales de fallo (526 probable)
- Subject o issuer muestran `TRAEFIK DEFAULT CERT`.
- SANs no incluyen el host consultado.
- Cloudflare devuelve 526 en uno o mas hosts.

## Verificaciones HTTP recomendadas
```bash
curl -I https://exitosos.com
curl -I https://members.exitosos.com
curl -I https://admin.exitosos.com
curl -I https://api.exitosos.com/health
```

Esperado:
- `HTTP/2 200` o `HTTP/2 3xx` para web.
- `HTTP/2 200` para `api.exitosos.com/health`.
- Sin `526`.

## Si continua el error 526
1. Revisar labels efectivos del servicio:
```bash
docker service inspect leadflow_web --format '{{json .Spec.Labels}}'
docker service inspect leadflow_api --format '{{json .Spec.Labels}}'
```
2. Confirmar presencia de:
- `traefik.http.routers.*.tls.certresolver=le`
- reglas Host correctas para `exitosos.com`, `members`, `admin`, `api`
3. Revisar estado de certificados de Traefik (acme) y logs de Traefik.

