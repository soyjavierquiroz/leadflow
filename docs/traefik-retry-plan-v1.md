# Traefik ACME Retry Plan v1

## Objetivo
Forzar un nuevo intento de emision ACME en Traefik para `members.exitosos.com` y `admin.exitosos.com` con el metodo minimo y seguro, sin tocar configuracion de Leadflow.

## Servicio Traefik real
- `traefik_traefik` (Swarm)

## Estado actual resumido
- DNS de `members` y `admin` ya apunta directo al origen (`104.236.36.75`) en resolvers publicos.
- Certificado servido actualmente por origen:
  - `members.exitosos.com` -> `TRAEFIK DEFAULT CERT`
  - `admin.exitosos.com` -> `TRAEFIK DEFAULT CERT`
- Ultimos errores relevantes (Traefik logs):
  - `Cannot negotiate ALPN protocol "acme-tls/1"`
  - `rateLimited` para `members.exitosos.com` con `retry after 2026-03-21 02:53:33 UTC`
- No se observaron errores nuevos en los ultimos 20 minutos al momento de este plan.

## Paso 1: Verificar ventana de rate-limit
```bash
date -u '+%Y-%m-%d %H:%M:%S UTC'
docker service logs traefik_traefik --since 6h 2>&1 \
  | rg -i 'members\.exitosos\.com|admin\.exitosos\.com|rateLimited|retry after' \
  | tail -n 100
```

Criterio:
- Si aparece `retry after ... UTC`, esperar a pasar ese timestamp antes de reintentar.
- Si no aparecen eventos nuevos de rate limit, continuar.

## Paso 2: Accion minima para forzar nuevo intento ACME

### Opcion recomendada (Portainer)
1. Abrir stack `traefik` en Portainer.
2. Pulsar `Update the stack` sin cambiar contenido.
3. Esto recrea la tarea de `traefik_traefik` y fuerza reevaluacion ACME.

### Opcion CLI equivalente
```bash
docker service update --force traefik_traefik
```

Nota:
- Esta accion reinicia Traefik (1 replica), puede haber una ventana corta de impacto mientras sube la nueva tarea.

## Paso 3: Observar si Traefik vuelve a intentar emision
```bash
docker service logs traefik_traefik --since 10m -f 2>&1 \
  | rg -i 'members\.exitosos\.com|admin\.exitosos\.com|acme|unable to obtain|rateLimited|acme-tls/1'
```

## Paso 4: Verificar el nuevo certificado
```bash
ORIGIN_IP=104.236.36.75

openssl s_client -connect ${ORIGIN_IP}:443 -servername members.exitosos.com </dev/null \
  | openssl x509 -noout -subject -issuer -ext subjectAltName

openssl s_client -connect ${ORIGIN_IP}:443 -servername admin.exitosos.com </dev/null \
  | openssl x509 -noout -subject -issuer -ext subjectAltName
```

## Senales de exito
- Ya no aparece `TRAEFIK DEFAULT CERT`.
- Subject/issuer muestran LE (u otra CA valida).
- SAN incluye `members.exitosos.com` y `admin.exitosos.com` respectivamente.

## Senales de fallo
- Sigue saliendo `TRAEFIK DEFAULT CERT`.
- Logs vuelven a mostrar `Cannot negotiate ALPN protocol \"acme-tls/1\"`.
- Reaparece `rateLimited`.

## Si falla nuevamente
Escalar a ajuste de Traefik compartido (estrategia de challenge), segun:
- `docs/traefik-acme-diagnosis-v1.md`
