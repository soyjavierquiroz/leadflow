# Architecture v1

## Objetivo de esta fase
Dejar Leadflow listo para ejecutar su shell web y una API con dominio de negocio v1, persistencia real en PostgreSQL y una propuesta estructural clara para funnels, tracking y handoff, sin tocar produccion.

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
- Modulos base:
  - `workspaces`
  - `teams`
  - `sponsors`
  - `rotation-pools`
  - `funnels`
  - `visitors`
  - `leads`
  - `assignments`
  - `events`
- Cada modulo expone DTOs, interfaces de agregado, servicio base y repository adapter Prisma.
- Endpoints minimos de validacion expuestos para `workspaces`, `sponsors`, `leads` y `rotation-pools`.

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
- `Funnel`
- `Visitor`
- `Lead`
- `Assignment`
- `DomainEvent`

Este modelo ya soporta la base multi-tenant y de asignacion, pero el area de funnel/tracking todavia esta en expansion conceptual.

## Expansion estructural recomendada para funnel/tracking
Para soportar SaaS multi-domain, multi-funnel y tracking por proveedor, la arquitectura recomienda evolucionar hacia:
- `FunnelTemplate`
- `FunnelInstance`
- `FunnelStep`
- `TrackingProfile`
- `ConversionEventMapping`
- `DomainBinding`
- `HandoffStrategy`

Objetivo de esa expansion:
- separar plantilla de despliegue operativo
- modelar pasos con semantica real
- desacoplar funnel de dominio/DNS
- permitir tracking por perfil y proveedor
- soportar handoff inmediato o diferido sin hardcodes

Esta expansion queda documentada en:
- `docs/funnel-tracking-model-v1.md`
- `docs/funnel-domain-expansion-v1.md`

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
- Redis, n8n o Evolution.
- Auth real.
- Logica compleja de asignacion.
- Cambios de persistencia para la expansion funnel/tracking.

## Estado
Arquitectura lista para seguir con flows de captacion, tracking y handoff sobre una base documental mas fuerte, todavia sin cambios en produccion ni en la persistencia de la expansion propuesta.
