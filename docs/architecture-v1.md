# Architecture v1

## Objetivo de esta fase
Dejar Leadflow listo para ejecutar su shell web y una API con dominio de negocio v1 mas una primera capa de persistencia real en PostgreSQL, sin tocar produccion.

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
- Redis, n8n o Evolution.
- Auth real.
- Logica compleja de asignacion.

## Estado
Arquitectura lista para evolucionar el dominio sobre persistencia real y continuar con casos de uso en la siguiente fase, todavia sin cambios en produccion.
