# Simple TLS Recovery v1

## Objetivo
Aplicar la ruta mas simple y menos invasiva para recuperar TLS valido en `members.exitosos.com` y `admin.exitosos.com` sin modificar Traefik compartido.

## Diagnostico resumido
- Leadflow ya publica routers validos para `members` y `admin` con:
  - `tls=true`
  - `tls.certresolver=le`
- Traefik reporta fallos ACME para ambos hosts con el mismo error:
  - `Cannot negotiate ALPN protocol "acme-tls/1" for tls-alpn-01 challenge`
- Adicionalmente hubo rate limit de Let's Encrypt para `members.exitosos.com`.
- Resultado actual en origen:
  - `members.exitosos.com` -> `TRAEFIK DEFAULT CERT`
  - `admin.exitosos.com` -> `TRAEFIK DEFAULT CERT`

## Estrategia simple (sin tocar Traefik)
Intentar emision directa temporal quitando proxy Cloudflare solo en los subdominios problematicos.

## Pasos para Javier (Cloudflare)
1. En DNS de Cloudflare, cambiar temporalmente a `DNS only` (nube gris):
   - `members.exitosos.com`
   - `admin.exitosos.com`
2. Mantener sin cambios:
   - `exitosos.com`
   - `api.exitosos.com`
3. Esperar propagacion corta (normalmente minutos).
4. Verificar desde origen que ya no llega trafico de proxy de Cloudflare para esos hosts.

## Pasos para reintentar emision
1. Esperar fin de rate-limit si aparece en logs (buscar `retry after ... UTC`).
2. Forzar reevaluacion de routers/certificados de Leadflow (manual):
   - Opcion Portainer (recomendada): `Update the stack` de `leadflow`.
   - Opcion CLI equivalente:
     ```bash
     docker service update --force leadflow_web
     ```
3. Revisar logs de Traefik:
   ```bash
   docker service logs traefik_traefik --since 30m 2>&1 \
     | rg -i 'members\.exitosos\.com|admin\.exitosos\.com|acme|unable to obtain|rate|alpn'
   ```

## Verificacion OpenSSL (origen)
Usar IP del servidor:
```bash
ORIGIN_IP=${LEADFLOW_SWARM_ORIGIN_IP}
```

```bash
openssl s_client -connect ${ORIGIN_IP}:443 -servername members.exitosos.com </dev/null \
  | openssl x509 -noout -subject -issuer -ext subjectAltName

openssl s_client -connect ${ORIGIN_IP}:443 -servername admin.exitosos.com </dev/null \
  | openssl x509 -noout -subject -issuer -ext subjectAltName
```

## Senales de exito
- Subject/issuer de LE (u otra CA valida), no `TRAEFIK DEFAULT CERT`.
- SAN incluye el host consultado (`members.exitosos.com` o `admin.exitosos.com`).
- Cloudflare `Full (strict)` deja de devolver 526 en esos subdominios.

## Cuándo volver a proxy naranja
Volver `members` y `admin` a proxied (nube naranja) solo cuando:
1. OpenSSL en origen muestre certificado valido para ambos hosts.
2. Prueba HTTPS directa no falle.
3. Cloudflare en strict responda normal (sin 526) tras volver a proxied.

## Si falla nuevamente
Si persiste el error ALPN aun con DNS only y sin rate limit, escalar a correccion de Traefik compartido (challenge strategy), segun `docs/traefik-acme-diagnosis-v1.md`.
