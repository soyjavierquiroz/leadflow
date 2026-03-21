# Leadflow

Leadflow es una plataforma SaaS para captacion, asignacion y automatizacion de leads.

## Estado actual (v1 base)
La base del monorepo ya incluye:
- Shell funcional de `web` (site, members, admin).
- Shell funcional de `api` (NestJS + Fastify + health).
- Configuracion por entorno para dominios objetivo.
- Baseline de ejecucion con Dockerfiles, Compose de desarrollo y stack Swarm.
- Variante de stack local para primer despliegue controlado desde Portainer.

No hay deploy aplicado en esta fase.

## Stack tecnico
- Frontend: Next.js + React + TypeScript + Tailwind.
- Backend: NestJS + Fastify.
- Monorepo: pnpm workspaces + Turborepo.
- Ejecucion: Docker + Docker Compose (dev) + Docker Swarm stack.

## Dominios objetivo (planeados)
- `https://exitosos.com` -> sitio publico.
- `https://members.exitosos.com` -> panel sponsors.
- `https://admin.exitosos.com` -> panel admin.
- `https://api.exitosos.com` -> API publica controlada.

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
- `docs/infrastructure-v1.md`
- `docs/deployment-v1.md`
- `docs/deployment-local-v1.md`
- `docs/deploy-checklist-v1.md`
- `docs/domain-strategy-v1.md`
- `docs/environment-v1.md`

## Estado de despliegue
- Preparado para despliegue en Portainer con dos variantes de stack:
  - `infra/swarm/docker-stack.local.yml` (sin GHCR, primer despliegue en nodo unico)
  - `infra/swarm/docker-stack.yml` (con GHCR, ruta objetivo de escalado)
- Runtime de contenedores para Swarm:
  - Web: `node apps/web/server.js` (Next standalone, produccion)
  - API: `node apps/api/dist/main.js` (Nest compilado, produccion)
- Deploy aun no ejecutado.

## Nota operativa
Esta fase prepara ejecucion y despliegue futuro, pero no realiza deploy ni modifica infraestructura productiva del servidor.
