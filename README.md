# Leadflow

Leadflow es una plataforma SaaS para captacion, asignacion y automatizacion de leads.

## Estado actual (v1 base)
La base del monorepo ya incluye:
- Shell funcional de `web` (site, members, admin).
- Shell funcional de `api` (NestJS + Fastify + health).
- Configuracion por entorno para dominios objetivo.
- Baseline de ejecucion con Dockerfiles, Compose de desarrollo y stack Swarm inicial.

No hay deploy aplicado en esta fase.

## Stack tecnico
- Frontend: Next.js + React + TypeScript + Tailwind.
- Backend: NestJS + Fastify.
- Monorepo: pnpm workspaces + Turborepo.
- Ejecucion: Docker + Docker Compose (dev) + Docker Swarm stack (baseline).

## Dominios objetivo (planeados)
- `https://exitosos.com` -> sitio publico.
- `https://members.exitosos.com` -> panel sponsors.
- `https://admin.exitosos.com` -> panel admin.
- `https://api.exitosos.com` -> API publica controlada.

## Rutas de infraestructura
- Dockerfile web: `apps/web/Dockerfile`
- Dockerfile api: `apps/api/Dockerfile`
- Docker Compose dev: `infra/docker/docker-compose.dev.yml`
- Stack Swarm base: `infra/swarm/docker-stack.yml`
- Variables ejemplo compose: `infra/docker/.env.example`
- Variables ejemplo swarm: `infra/swarm/.env.example`

## Redes objetivo
- `traefik_public` (externa existente en servidor)
- `leadflow_core` (interna del proyecto)
- `leadflow_automation` (placeholder para integraciones futuras)

## Scripts utiles
Desde la raiz del repo:
- Desarrollo app:
  - `pnpm dev`
  - `pnpm dev:web`
  - `pnpm dev:api`
- Calidad:
  - `pnpm build`
  - `pnpm lint`
  - `pnpm test`
- Docker local:
  - `pnpm docker:dev:up`
  - `pnpm docker:dev:down`
  - `pnpm docker:dev:logs`
- Imagenes:
  - `pnpm docker:build:web`
  - `pnpm docker:build:api`
  - `TAG=latest pnpm docker:ghcr:build:web`
  - `TAG=latest pnpm docker:ghcr:build:api`
  - `TAG=latest pnpm docker:ghcr:push:web`
  - `TAG=latest pnpm docker:ghcr:push:api`
  - `GHCR_USERNAME=<user> GHCR_TOKEN=<token> TAG=latest pnpm docker:ghcr:publish`
- Stack validation:
  - `pnpm docker:stack:validate`

## Variables de entorno
- Web: `apps/web/.env.example`
- API: `apps/api/.env.example`
- Referencia completa: `docs/environment-v1.md`

## Documentacion clave
- `docs/architecture-v1.md`
- `docs/infrastructure-v1.md`
- `docs/deployment-v1.md`
- `docs/deploy-checklist-v1.md`
- `docs/domain-strategy-v1.md`
- `docs/environment-v1.md`

## Nota operativa
Esta fase prepara ejecucion y despliegue futuro, pero no realiza deploy ni modifica infraestructura productiva del servidor.

## Estado de despliegue (preflight)
- Stack `leadflow` validado a nivel de sintaxis y routing.
- Imagenes objetivo fijadas en GHCR:
  - `ghcr.io/soyjavierquiroz/leadflow-web:latest`
  - `ghcr.io/soyjavierquiroz/leadflow-api:latest`
- Estado de publicacion de imagenes: pendiente de validar/publicar con credenciales GHCR.
- Checklist operativo final disponible en `docs/deploy-checklist-v1.md`.
- Deploy aun no ejecutado.

## Portainer (stack `leadflow`)
- Imagen web esperada: `ghcr.io/soyjavierquiroz/leadflow-web:latest`
- Imagen api esperada: `ghcr.io/soyjavierquiroz/leadflow-api:latest`
- Archivo de stack: `infra/swarm/docker-stack.yml`
- Variables de stack: `infra/swarm/.env.example`

Pasos resumidos:
1. Publicar imagenes en GHCR.
2. En Portainer, crear/actualizar stack `leadflow` con `infra/swarm/docker-stack.yml`.
3. Cargar variables del stack.
4. Desplegar en ventana controlada.
