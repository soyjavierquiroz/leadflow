# Architecture v1

## Objetivo de esta fase
Dejar Leadflow listo para ejecutar su shell web y una API con dominio de negocio v1, persistencia real en PostgreSQL y expansion implementada para ownership, publicacion, funnels, tracking y handoff, sin tocar produccion.

## Componentes

### Frontend (`apps/web`)
- Next.js App Router.
- Segmentos:
  - `/(site)`
  - `/(members)`
  - `/(admin)`
- Config publica centralizada en `apps/web/lib/public-env.ts`.
- Build preparado para contenedor con `output: standalone`.

### Backend (`apps/api`)
- NestJS + Fastify.
- Config runtime centralizada en `apps/api/src/config/runtime.ts`.
- Prefijo global configurable (`API_GLOBAL_PREFIX`, default `v1`).
- `GET /health` sin prefijo global.
- CORS preparado para hosts web objetivo.
- Prisma integrado como adapter de persistencia.
- `PrismaModule` global con `PrismaService`.
- `DomainModule` como agregador de dominio.
- Modulos disponibles:
  - `workspaces`
  - `teams`
  - `sponsors`
  - `funnels`
  - `domains`
  - `funnel-templates`
  - `funnel-instances`
  - `funnel-steps`
  - `funnel-publications`
  - `tracking-profiles`
  - `handoff-strategies`
  - `conversion-event-mappings`
  - `rotation-pools`
  - `visitors`
  - `leads`
  - `assignments`
  - `events`
- Endpoints minimos de validacion expuestos para `workspaces`, `sponsors`, `leads`, `rotation-pools`, `domains`, `funnel-templates`, `funnel-instances` y `funnel-publications`.

### Shared packages
- `packages/config`: helpers simples de configuracion (`splitCsv`, `normalizeUrl`, `toNumber`).
- `packages/types`: tipos base de dominio y de configuracion.
- `packages/ui`: placeholder de componentes compartidos.

## Capa de dominio actual
El dominio operativo actual se apoya en:
- `Workspace`
- `Team`
- `Sponsor`
- `RotationPool`
- `RotationMember`
- `Funnel` legacy
- `Domain`
- `FunnelTemplate`
- `FunnelInstance`
- `FunnelStep`
- `FunnelPublication`
- `TrackingProfile`
- `ConversionEventMapping`
- `HandoffStrategy`
- `Visitor`
- `Lead`
- `Assignment`
- `DomainEvent`

## Expansion implementada
La arquitectura ya implementa:
- ownership operativo real en `Team`
- publicacion por `host + path`
- separacion entre `FunnelTemplate` y `FunnelInstance`
- modelado de steps tipados para runtime JSON-driven
- configuracion declarativa de tracking y handoff
- compatibilidad transicional con `Funnel` legacy

Decision de transicion:
- `Funnel` se mantiene para compatibilidad
- `FunnelInstance.legacyFunnelId` enlaza el modelo nuevo con el anterior
- `Lead` y `Assignment` conservan `funnelId` y agregan referencias opcionales a `funnelInstanceId` y `funnelPublicationId`

## Infraestructura de ejecucion v1

### Desarrollo local con contenedores
- Compose: `infra/docker/docker-compose.dev.yml`
- Servicios:
  - `postgres`
  - `web`
  - `api`
- Red:
  - `leadflow_core`

### Baseline Swarm (futuro deploy)
- Stack: `infra/swarm/docker-stack.yml`
- Servicios:
  - `web`
  - `api`
- Redes:
  - `traefik_public` (externa)
  - `leadflow_core`
  - `leadflow_automation` (placeholder)
- Routing Traefik por host:
  - `exitosos.com` -> `web`
  - `members.exitosos.com` -> `web`
  - `admin.exitosos.com` -> `web`
  - `api.exitosos.com` -> `api`

## Fuera de alcance en esta fase
- Deploy real en servidor.
- DNS real aplicado.
- Integracion real con Meta o TikTok.
- Handoff real con WhatsApp.
- Editor libre de templates para teams.
- Redis, n8n o Evolution.
- Auth real.
- Logica compleja de asignacion.

## Estado
Arquitectura lista para la siguiente fase de runtime publico, flows de captura/asignacion y auth sobre el modelo consolidado, todavia sin cambios en produccion.
