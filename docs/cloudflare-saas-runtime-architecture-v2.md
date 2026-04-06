# Cloudflare SaaS Runtime Architecture v2

## Objetivo

Reestructurar Leadflow para que el onboarding de dominios siga un patrón SaaS simple:

- Cloudflare edge presenta el certificado del dominio del cliente.
- Cloudflare usa un `fallback origin` fijo para llegar al runtime.
- Traefik expone un router público catch-all.
- Leadflow resuelve publicaciones por `host + path`.
- No se enumeran dominios cliente en YAML ni en labels de Traefik.

## Hostnames fijos del SaaS

- `proxy-fallback.leadflow.kuruk.in`
  - `fallback origin` fijo
  - se configura como `custom_origin_server` en Cloudflare
  - es el hostname que necesita TLS válido en origen
- `customers.leadflow.kuruk.in`
  - `CNAME target` único para clientes
  - Leadflow lo devuelve en `/team/domains`
  - no crea routers dedicados por cliente

## Flujo principal de onboarding

1. Team admin registra un `custom_subdomain`.
2. Leadflow crea o actualiza el custom hostname en Cloudflare.
3. Leadflow devuelve un único `CNAME target`: `customers.leadflow.kuruk.in`.
4. El cliente crea el CNAME de su hostname hacia ese target.
5. Team admin pulsa `Refresh`.
6. Leadflow reimpulsa la validación y consulta el estado en Cloudflare.
7. Cuando hostname + SSL quedan `active`, el dominio queda operativo.

## Qué hace cada capa

### Cloudflare edge

- termina TLS del dominio del cliente
- emite y presenta el certificado del custom hostname
- reenvía tráfico hacia `proxy-fallback.leadflow.kuruk.in`

### Fallback origin

- hostname fijo del SaaS
- siempre apunta al mismo runtime público de Leadflow
- evita que el origen tenga que conocer cada dominio cliente

### Leadflow

- mantiene routers explícitos para `leadflow.kuruk.in` y `api.leadflow.kuruk.in`
- usa un router público catch-all para el tráfico del sitio y clientes
- resuelve tenant/publicación por `host + path`

## Cómo queda Traefik

- `leadflow-site`: router explícito por `leadflow.kuruk.in`
- `leadflow-api`: router explícito por `api.leadflow.kuruk.in`
- `leadflow-public`: router catch-all `HostRegexp({host:.+})` con prioridad baja

El catch-all sirve:

- `proxy-fallback.leadflow.kuruk.in`
- `customers.leadflow.kuruk.in`
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

- el cliente debe crear el CNAME hacia `customers.leadflow.kuruk.in`
- el team debe usar `Refresh` hasta que Cloudflare refleje el cambio DNS
- si se intenta `custom_apex`, el DNS del cliente debe soportar flattening/ALIAS
- la cuenta Cloudflare del entorno debe tener `zone` y `token` configurados
