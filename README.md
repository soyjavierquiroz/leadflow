# Leadflow

Leadflow es una plataforma SaaS para captacion, asignacion y automatizacion de leads.

## Estado actual (v1 base)
La base del monorepo ya incluye:
- Shell funcional de `web` (site, members, admin).
- Shell funcional de `api` (NestJS + Fastify + health).
- Foundation de dominio v1 en `apps/api` con modulos, DTOs e interfaces.
- Persistence Foundation v1 con PostgreSQL + Prisma en `apps/api`.
- Configuracion por entorno para dominios y URLs.
- Baseline de ejecucion con Dockerfiles, Compose de desarrollo y stack Swarm.
- Variante de stack local para primer despliegue controlado desde Portainer.

No hay deploy aplicado en esta fase.

## Stack tecnico
- Frontend: Next.js + React + TypeScript + Tailwind.
- Backend: NestJS + Fastify.
- Monorepo: pnpm workspaces + Turborepo.
- Ejecucion: Docker + Docker Compose (dev) + Docker Swarm stack.

## Estrategia de dominio
- `exitosos.com` es dominio temporal de staging.
- El dominio de lanzamiento sera distinto y se definira en ventana de release.
- El codigo de aplicacion debe ser domain-agnostic.
- El dominio vive solo en configuracion centralizada (`*.env.example`, variables de stack) y documentacion de staging.

Hosts funcionales esperados por convencion:
- `SITE_URL`
- `MEMBERS_URL`
- `ADMIN_URL`
- `API_URL`

Variables transversales:
- `APP_ENV`
- `APP_BASE_DOMAIN`

## Rutas de infraestructura
- Dockerfile web: `apps/web/Dockerfile`
- Dockerfile api: `apps/api/Dockerfile`
- Docker Compose dev: `infra/docker/docker-compose.dev.yml`
- Stack Swarm GHCR: `infra/swarm/docker-stack.yml`
- Stack Swarm local: `infra/swarm/docker-stack.local.yml`
- Variables ejemplo compose: `infra/docker/.env.example`
- Variables ejemplo swarm: `infra/swarm/.env.example`

## Redes objetivo
- `traefik_public` (externa existente en servidor)
- `leadflow_core` (interna del proyecto)
- `leadflow_automation` (placeholder para integraciones futuras)

## Scripts utiles
Desde la raiz del repo:

Desarrollo app:
- `pnpm dev`
- `pnpm dev:web`
- `pnpm dev:api`

Calidad:
- `pnpm build`
- `pnpm lint`
- `pnpm test`

Docker local:
- `pnpm docker:dev:up`
- `pnpm docker:dev:down`
- `pnpm docker:dev:logs`

Build imagenes locales (primer deploy):
- `pnpm docker:build:web:local`
- `pnpm docker:build:api:local`
- `pnpm docker:build:local`
- Estos builds usan runtime de produccion (`--target runner`), no modo `dev`.

Build/publicacion GHCR (futuro):
- `TAG=latest pnpm docker:ghcr:build:web`
- `TAG=latest pnpm docker:ghcr:build:api`
- `TAG=latest pnpm docker:ghcr:push:web`
- `TAG=latest pnpm docker:ghcr:push:api`
- `GHCR_USERNAME=<user> GHCR_TOKEN=<token> TAG=latest pnpm docker:ghcr:publish`

Validacion de stacks:
- `pnpm docker:stack:validate`
- `pnpm docker:stack:validate:local`

## Variables de entorno
- Web: `apps/web/.env.example`
- API: `apps/api/.env.example`
- Referencia completa: `docs/environment-v1.md`

## Documentacion clave
- `docs/architecture-v1.md`
- `docs/domain-model-v1.md`
- `docs/persistence-v1.md`
- `docs/infrastructure-v1.md`
- `docs/deployment-v1.md`
- `docs/deployment-local-v1.md`
- `docs/tls-verification-v1.md`
- `docs/deploy-checklist-v1.md`
- `docs/domain-strategy-v1.md`
- `docs/domain-lifecycle-v1.md`
- `docs/environment-v1.md`

## Dominio v1
- Modulos base API:
  - `workspaces`
  - `teams`
  - `sponsors`
  - `rotation-pools`
  - `funnels`
  - `visitors`
  - `leads`
  - `assignments`
  - `events`
- La fase actual deja contratos, DTOs y servicios draft listos para conectar persistencia despues.
- Persistencia real, auth y motor avanzado de asignacion siguen fuera de alcance por ahora.

## Persistencia v1
- Prisma integrado en `apps/api/prisma/schema.prisma`.
- Migracion inicial creada para PostgreSQL.
- Seed minimo de desarrollo con workspace, team, sponsors, funnel y rotation pool.
- Endpoints de validacion expuestos:
  - `GET /v1/workspaces`
  - `GET /v1/sponsors`
  - `GET /v1/leads`
  - `GET /v1/rotation-pools`

## Estado de despliegue
- Preparado para despliegue en Portainer con dos variantes de stack:
  - `infra/swarm/docker-stack.local.yml` (sin GHCR, primer despliegue en nodo unico)
  - `infra/swarm/docker-stack.yml` (con GHCR, ruta objetivo de escalado)
- Runtime de contenedores para Swarm:
  - Web: `node apps/web/server.js` (Next standalone, produccion)
  - API: `node apps/api/dist/main.js` (Nest compilado, produccion)
- TLS para Cloudflare Full (strict) en stack local:
  - Routers `site`, `members`, `admin`, `api` con `tls.certresolver=le`.
  - Dominio principal y SANs explicitos en `leadflow-site` para cubrir apex y subdominios operativos.
- Verificacion post-fix TLS:
  - Checklist y comandos OpenSSL en `docs/tls-verification-v1.md`.
- Deploy aun no ejecutado.

## Nota operativa
Esta fase prepara ejecucion y despliegue futuro, pero no realiza deploy ni modifica infraestructura productiva del servidor.
