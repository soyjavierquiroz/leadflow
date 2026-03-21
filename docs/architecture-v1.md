# Architecture v1

## Objetivo de esta fase
Dejar Leadflow listo para ejecutar su shell web y una API con dominio de negocio v1, sin tocar produccion ni cerrar aun la capa de persistencia.

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
- Cada modulo expone DTOs, interfaces de agregado y servicio base.
- Persistencia real aun no conectada; los contratos quedan listos para adapters futuros.

### Shared packages
- `packages/config`: helpers simples de configuracion (`splitCsv`, `normalizeUrl`, `toNumber`).
- `packages/types`: tipos base de dominio y de configuracion.
- `packages/ui`: placeholder de componentes compartidos.

## Infraestructura de ejecucion v1

### Desarrollo local con contenedores
- Compose: `infra/docker/docker-compose.dev.yml`
- Servicios:
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
- Integraciones con PostgreSQL, Redis, n8n o Evolution.
- Auth real.
- Logica compleja de asignacion.

## Estado
Arquitectura lista para evolucionar el dominio y conectar persistencia en la siguiente fase, todavia sin cambios en produccion.
