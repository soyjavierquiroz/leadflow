# Cloudflare SaaS Runtime Architecture v2

## Objetivo

Reestructurar Leadflow para que el onboarding de dominios siga un patrón SaaS simple:

- Cloudflare edge presenta el certificado del dominio del cliente.
- Cloudflare usa un `fallback origin` fijo para llegar al runtime.
- Traefik expone un router público catch-all.
- Leadflow resuelve publicaciones por `host + path`.
- No se enumeran dominios cliente en YAML ni en labels de Traefik.

## Hostnames fijos del SaaS

- `proxy-fallback.exitosos.com`
  - `fallback origin` fijo
  - se configura como `custom_origin_server` en Cloudflare
  - es el hostname que necesita TLS válido en origen
- `customers.exitosos.com`
  - `CNAME target` único para clientes
  - Leadflow lo devuelve en `/team/domains`
  - no crea routers dedicados por cliente

## Flujo principal de onboarding

1. Team admin registra un `custom_subdomain`.
2. Leadflow crea o actualiza el custom hostname en Cloudflare.
3. Leadflow devuelve un único `CNAME target`: `customers.exitosos.com`.
4. El cliente crea el CNAME de su hostname hacia ese target.
5. Team admin pulsa `Refresh`.
6. Leadflow reimpulsa la validación y consulta el estado en Cloudflare.
7. Cuando hostname + SSL quedan `active`, el dominio queda operativo.

## Qué hace cada capa

### Cloudflare edge

- termina TLS del dominio del cliente
- emite y presenta el certificado del custom hostname
- reenvía tráfico hacia `proxy-fallback.exitosos.com`

### Fallback origin

- hostname fijo del SaaS
- siempre apunta al mismo runtime público de Leadflow
- evita que el origen tenga que conocer cada dominio cliente

### Leadflow

- mantiene routers explícitos solo para `admin`, `members` y `api`
- usa un router público catch-all para el tráfico del sitio y clientes
- resuelve tenant/publicación por `host + path`

## Cómo queda Traefik

- `leadflow-api`: router explícito por host y prioridad alta
- `leadflow-members`: router explícito por host y prioridad alta
- `leadflow-admin`: router explícito por host y prioridad alta
- `leadflow-public`: router catch-all `HostRegexp({host:.+})` con prioridad baja

El catch-all sirve:

- host público principal del SaaS
- `proxy-fallback.exitosos.com`
- `customers.exitosos.com`
- cualquier hostname cliente proxied por Cloudflare

## Cómo queda `/team/domains`

- hostname solicitado
- CNAME target único
- fallback origin fijo
- estado Cloudflare
- estado SSL
- refresh
- estado operativo: `active`, `pending_dns`, `pending_validation`, `error`

## Qué pasos manuales quedan

- el cliente debe crear el CNAME hacia `customers.exitosos.com`
- el team debe usar `Refresh` hasta que Cloudflare refleje el cambio DNS
- si se intenta `custom_apex`, el DNS del cliente debe soportar flattening/ALIAS
- la cuenta Cloudflare del entorno debe tener `zone` y `token` configurados
