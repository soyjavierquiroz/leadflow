# Simple SaaS Domain Activation v1

## Objetivo

Dejar el onboarding de dominios con un flujo simple y soportado oficialmente para `custom_subdomain`.

## Hostnames fijos del SaaS

- `customers.leadflow.kurukin.com`
  - target CNAME único para clientes
- `proxy-fallback.leadflow.kurukin.com`
  - fallback origin fijo para Cloudflare

## Flujo soportado oficialmente en v1

1. el usuario registra un `custom_subdomain`
2. Leadflow crea o actualiza el custom hostname en Cloudflare
3. Leadflow devuelve `customers.leadflow.kurukin.com`
4. el usuario configura ese CNAME
5. pulsa `Refresh`
6. cuando Cloudflare y SSL quedan activos, el dominio pasa a `active`

## Principios del producto

- no usar TXT/manual como camino principal
- no enumerar dominios cliente en Traefik/YAML
- mantener el resolver público por `host + path`
- dejar `custom_apex` como caso no principal en esta fase

## Qué muestra `/team/domains`

- hostname solicitado
- tipo
- target CNAME único
- estado Cloudflare
- estado SSL
- refresh
- activo / pendiente / error

## Qué queda fuera en v1

- `custom_apex` como camino principal
- activación automática apex-to-www
- validación Cloudflare end-to-end en este entorno sin credenciales/infra reales
