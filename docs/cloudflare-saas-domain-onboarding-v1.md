# Cloudflare SaaS Domain Onboarding v1

## Objetivo

Permitir que un team admin registre dominios externos desde Leadflow y dejar la plataforma preparada para gestionar custom hostnames en Cloudflare for SaaS por API.

## Modelo final

`Domain` ahora combina dos capas:

- capa operativa:
  - `status`
  - `normalizedHost`
  - `domainType`
- capa de onboarding SaaS:
  - `onboardingStatus`
  - `verificationStatus`
  - `sslStatus`
  - `verificationMethod`
  - `cloudflareCustomHostnameId`
  - `cloudflareStatusJson`
  - `dnsTarget`
  - `lastCloudflareSyncAt`
  - `activatedAt`

Relación con publicaciones:

- `team` 1:N `domains`
- `domain` 1:N `funnel_publications`
- el resolver final de publicaciones sigue funcionando por `host + path`

## Estados soportados

### Onboarding

- `draft`
- `pending_dns`
- `pending_validation`
- `active`
- `error`

### Verification

- `unverified`
- `pending`
- `verified`
- `failed`

### SSL

- `unconfigured`
- `pending`
- `active`
- `failed`

## Variables de entorno

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_SAAS_FALLBACK_ORIGIN`
- `CLOUDFLARE_API_BASE_URL` opcional
- `CLOUDFLARE_REQUEST_TIMEOUT_MS` opcional

## Cloudflare adapter

Archivo principal:

- `apps/api/src/modules/domains/cloudflare-saas.client.ts`

Operaciones v1:

- crear custom hostname
- consultar custom hostname
- refrescar estado
- actualizar lo mínimo
- eliminar básico

El adapter:

- usa timeout por request
- devuelve errores claros
- mantiene el payload de vendor acotado en `cloudflareStatusJson`
- expone arriba campos neutrales de producto para no acoplar el resto del sistema al shape crudo de Cloudflare

## Flujo de onboarding

1. el team registra el domain desde `/team/domains`
2. Leadflow persiste el domain
3. si Cloudflare está configurado, Leadflow intenta crear o actualizar el custom hostname
4. Leadflow guarda estados neutrales y metadata del vendor
5. la UI muestra instrucciones DNS
6. el team puede ejecutar `refresh`
7. cuando hostname + SSL quedan activos, el domain pasa a operativo

## Diferencias por tipo

### `custom_subdomain`

- flujo principal vía `CNAME`
- la UI muestra `dnsTarget`
- si Cloudflare devuelve TXT/HTTP adicionales para ownership o DCV, también se muestran

### `custom_apex`

- el onboarding queda modelado
- el estado se puede sincronizar
- queda documentado que la activación final depende de soporte real de apex proxying / flattening en Cloudflare y en la cuenta

### `system_subdomain`

- no requiere DNS manual del cliente
- queda gestionado internamente por Leadflow

## Endpoints

- `GET /v1/domains`
- `POST /v1/domains`
- `PATCH /v1/domains/:id`
- `POST /v1/domains/:id/refresh`

## Backoffice v1

Nueva superficie:

- `/team/domains`

Capacidades:

- registrar dominio
- elegir `domainType`
- ver `onboardingStatus`, `verificationStatus`, `sslStatus`
- ver `dnsTarget`
- leer instrucciones DNS claras
- refrescar estado
- marcar dominio principal

## Conexión con el resolver `host + path`

No cambia la resolución final:

- lookup exacto por `normalizedHost`
- longest-prefix-match por `pathPrefix`

La diferencia es que ahora un domain puede pasar por un ciclo real de onboarding antes de entrar a operación.

## Qué queda fuera todavía

- validación end-to-end real contra una cuenta Cloudflare del entorno actual
- soporte productivo completo para apex proxying
- polling continuo o jobs de reconciliación
- wizard completo de ownership/verificación con colas
- automatización del DNS del registrador del cliente
- cualquier cambio en Traefik o en el stack por dominio individual
