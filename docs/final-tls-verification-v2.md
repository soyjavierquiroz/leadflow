# Final TLS Verification v2

Fecha: 2026-03-21 (UTC)

## Objetivo
Documentar el paso final de verificacion TLS para `exitosos.com` y `api.exitosos.com` despues del `force update` de Traefik.

## Precondicion
- Ya se ejecuto:
  ```bash
  docker service update --force traefik_traefik
  ```

## Comandos OpenSSL (origen con SNI)
Usar la IP origen:

```bash
ORIGIN_IP=104.236.36.75
```

### 1) Apex: `exitosos.com`
```bash
openssl s_client -connect ${ORIGIN_IP}:443 -servername exitosos.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

### 2) API: `api.exitosos.com`
```bash
openssl s_client -connect ${ORIGIN_IP}:443 -servername api.exitosos.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

## Criterio de exito
Para ambos hostnames:
- `issuer` muestra Let's Encrypt.
- `notAfter` esta en fecha futura (respecto al momento de validacion).
- `subjectAltName` incluye el hostname consultado (`exitosos.com` o `api.exitosos.com`).

## Paso siguiente si exito
1. Volver ambos registros en Cloudflare a `Proxied` (nube naranja):
   - `exitosos.com`
   - `api.exitosos.com`
2. Probar en navegador:
   - `https://exitosos.com`
   - `https://api.exitosos.com/health`
3. Validar por CLI:
   ```bash
   curl -I https://exitosos.com
   curl -i https://api.exitosos.com/health
   ```
   Esperado: sin `526`; apex con `200/3xx`; `/health` con `200`.

## Paso siguiente si falla
- Aplicar el plan de limpieza selectiva de ACME (solo dominios afectados: `exitosos.com` y `api.exitosos.com`) y luego reintentar el ciclo de emision/validacion.
- Referencia tecnica base: `docs/traefik-acme-diagnosis-v1.md`.
