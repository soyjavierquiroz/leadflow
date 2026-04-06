# Apex + API TLS Diagnosis v1

## Contexto
Analisis no destructivo enfocado en `exitosos.com` (apex) y `api.exitosos.com`.

Fecha: 2026-03-21 (UTC)

## 1) Routers efectivos en Traefik
Confirmados como habilitados en proveedor Docker:

- `leadflow-site@docker`
  - rule: `Host(\`exitosos.com\`)`
  - entrypoint: `websecure`
  - tls: `true`
  - certResolver: `le`
  - domains: `main=exitosos.com`, `sans=members.exitosos.com,admin.exitosos.com,api.exitosos.com`
  - service: `leadflow-web`

- `leadflow-api@docker`
  - rule: `Host(\`api.exitosos.com\`)`
  - entrypoint: `websecure`
  - tls: `true`
  - certResolver: `le`
  - service: `leadflow-api`

## 2) Labels efectivas (servicios)
`leadflow_web`:
- `traefik.http.routers.leadflow-site.tls=true`
- `traefik.http.routers.leadflow-site.tls.certresolver=le`
- `traefik.http.services.leadflow-web.loadbalancer.server.port=3000`

`leadflow_api`:
- `traefik.http.routers.leadflow-api.tls=true`
- `traefik.http.routers.leadflow-api.tls.certresolver=le`
- `traefik.http.services.leadflow-api.loadbalancer.server.port=3001`

Conclusion de routing/labels: **consistente**.

## 3) Certificado servido por origen (SNI)
Verificado contra `${LEADFLOW_SWARM_ORIGIN_IP}:443`.

### `exitosos.com`
- subject: `CN=exitosos.com`
- issuer: `Let's Encrypt R13`
- SANs: `DNS:exitosos.com`
- Cobertura del hostname: **si**
- Estado cadena/validez: **expirado**
  - `notAfter=Feb 4 11:28:12 2026 GMT`
  - `Verify return code: 10 (certificate has expired)`

### `api.exitosos.com`
- subject: `CN=api.exitosos.com`
- issuer: `Let's Encrypt R13`
- SANs: `DNS:api.exitosos.com`
- Cobertura del hostname: **si**
- Estado cadena/validez: **expirado**
  - `notAfter=Feb 23 19:19:53 2026 GMT`
  - `Verify return code: 10 (certificate has expired)`

## 4) Logs recientes Traefik (ACME)
Se observan errores de emision/renovacion para apex + api:
- `Error renewing certificate from LE: {exitosos.com ...} ... Cannot negotiate ALPN protocol "acme-tls/1"`
- `Error renewing certificate from LE: {api.exitosos.com ...} ... Cannot negotiate ALPN protocol "acme-tls/1"`
- En eventos del router `leadflow-site@docker` aparece fallo combinado para `exitosos.com,members,admin,api`.

## 5) Estado en almacenamiento ACME (`acme.json`)
Certificados presentes:
- `exitosos.com` -> existe (LE), pero expirado
- `api.exitosos.com` -> existe (LE), pero expirado

No es un problema de ausencia de cert en storage para estos dos hosts; el problema es que el cert existente ya no es valido y Traefik no logra renovarlo correctamente.

## Diagnostico final
Para `exitosos.com` y `api.exitosos.com` el origen **no esta bien** en este momento para Cloudflare Full (strict) porque entrega certificados LE expirados.

Causa probable del 526 restante:
1. Certificados apex/api expirados en origen.
2. Renovacion ACME fallando por challenge (`acme-tls/1`) en Traefik.

## Accion exacta recomendada para Javier
1. Forzar nuevo intento de emision en Traefik:
   - Portainer: stack `traefik` -> `Update the stack` (sin cambios),
   - o CLI: `docker service update --force traefik_traefik`.
2. Monitorear logs inmediatamente:
   ```bash
   docker service logs traefik_traefik --since 10m -f 2>&1 \
     | rg -i 'exitosos\.com|api\.exitosos\.com|acme|unable to obtain|acme-tls/1|rateLimited'
   ```
3. Verificar validez nueva de certificados:
   ```bash
   openssl s_client -connect ${LEADFLOW_SWARM_ORIGIN_IP}:443 -servername exitosos.com </dev/null 2>/dev/null \
     | openssl x509 -noout -subject -issuer -dates

   openssl s_client -connect ${LEADFLOW_SWARM_ORIGIN_IP}:443 -servername api.exitosos.com </dev/null 2>/dev/null \
     | openssl x509 -noout -subject -issuer -dates
   ```
4. Confirmar que `notAfter` sea futuro (respecto a 2026-03-21) antes de validar nuevamente en Cloudflare strict.
