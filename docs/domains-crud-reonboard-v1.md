# Domains CRUD / Re-onboard v1

## Objetivo

Cerrar la operación de `/team/domains` para que el team pueda:

- editar metadata segura del dominio
- eliminar registros heredados
- recrear onboarding en Cloudflare sin reutilizar targets del flujo viejo
- detectar y marcar dominios `legacy` o `recreate required`

## Endpoints nuevos

- `PATCH /v1/domains/:id`
  - actualiza metadata del dominio
  - no permite cambiar el `host` cuando el dominio ya tiene onboarding iniciado
  - si se necesita cambiar host, debe usarse `recreate-onboarding`
- `DELETE /v1/domains/:id`
  - intenta eliminar el `custom hostname` en Cloudflare si existe
  - luego elimina el `Domain` local
  - por cascada también elimina publicaciones ligadas a ese dominio
- `POST /v1/domains/:id/recreate-onboarding`
  - limpia el `custom hostname` viejo en Cloudflare cuando aplica
  - resetea `cloudflareCustomHostnameId`, `cloudflareStatusJson`, `lastCloudflareSyncAt` y `activatedAt`
  - recalcula `dnsTarget` con el modelo nuevo
  - crea un `custom hostname` nuevo bajo el flujo actual
  - sincroniza estados persistidos y summary operativo

## Reglas de negocio

- El target sano del SaaS es siempre `customers.leadflow.kurukin.com`.
- `proxy-fallback.leadflow.kurukin.com` queda solo como `fallback origin` interno.
- Si un dominio usa un `dnsTarget` distinto al target sano, Leadflow lo marca:
  - `legacy`
  - `recreate required`
- Si Cloudflare sigue apuntando a un `custom_origin_server` distinto de `proxy-fallback.leadflow.kurukin.com`, también se marca `legacy`.
- Un dominio `legacy` no se muestra como flujo sano en la UI aunque Cloudflare diga `active`.

## UI `/team/domains`

La pantalla ahora muestra:

- hostname
- domain type
- dns target actual
- cloudflare status
- ssl status
- estado operativo
- last sync
- acciones `Editar`, `Eliminar`, `Refresh`, `Recrear onboarding`

También agrega badges:

- `legacy`
- `recreate required`

## Limpieza de dominios heredados

Caso típico heredado:

- `dnsTarget=proxy-fallback.exitosos.com`
- `custom_origin_server=proxy-fallback.exitosos.com`

Flujo correcto:

1. Abrir `/team/domains`.
2. Ubicar el dominio marcado `legacy` y `recreate required`.
3. Ejecutar `Recrear onboarding`.
4. Leadflow elimina el `custom hostname` viejo en Cloudflare.
5. Leadflow crea un `custom hostname` nuevo usando:
   - `dnsTarget=customers.leadflow.kurukin.com`
   - `custom_origin_server=proxy-fallback.leadflow.kurukin.com`
6. La UI vuelve a mostrar instrucciones DNS limpias y estado sincronizado.

## Ejemplo: `www.retodetransformacion.com`

Para recrearlo bajo el modelo nuevo:

1. Ir a `/team/domains`.
2. Buscar `www.retodetransformacion.com`.
3. Si aparece `legacy` o `recreate required`, pulsar `Recrear onboarding`.
4. Confirmar o ajustar:
   - `host=www.retodetransformacion.com`
   - `domainType=custom_subdomain`
5. Guardar.
6. Verificar que el dominio quede con:
   - `dnsTarget=customers.leadflow.kurukin.com`
   - `cloudflare status` en progreso o `active`
   - `ssl status` en progreso o `active`
   - sin badges `legacy` ni `recreate required`

## Nota operativa

Este flujo no agrega dominios cliente a Traefik ni a YAML. El stack sigue usando solo:

- `leadflow.kurukin.com`
- `api.leadflow.kurukin.com`
- `customers.leadflow.kurukin.com`
- `proxy-fallback.leadflow.kurukin.com`
