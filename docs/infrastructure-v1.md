# Infrastructure v1

## Objetivo
Definir la base de ejecucion de Leadflow para desarrollo local en Docker y despliegue futuro en Docker Swarm.

## Artefactos creados

### Dockerfiles
- `apps/web/Dockerfile`
  - targets: `deps`, `builder`, `runner`, `dev`
- `apps/api/Dockerfile`
  - targets: `deps`, `builder`, `runner`, `dev`

### Ignore de build
- `/.dockerignore` en raiz para reducir contexto y evitar copiar artefactos temporales.

### Compose dev
- `infra/docker/docker-compose.dev.yml`
- Servicios: `web`, `api`
- Volumenes:
  - `leadflow_node_modules`
  - `leadflow_pnpm_store`
- Red local:
  - `leadflow_core`

### Stack Swarm baseline
- `infra/swarm/docker-stack.yml`
- Servicios: `web`, `api`
- Redes:
  - `traefik_public` (external)
  - `leadflow_core` (overlay)
  - `leadflow_automation` (overlay placeholder)

## Routers / Hosts Traefik planificados

### Web
- Router `leadflow-site` -> Host `exitosos.com`
- Router `leadflow-members` -> Host `members.exitosos.com`
- Router `leadflow-admin` -> Host `admin.exitosos.com`
- Service Traefik: `leadflow-web` (port 3000)

### API
- Router `leadflow-api` -> Host `api.exitosos.com`
- Service Traefik: `leadflow-api` (port 3001)

## Healthchecks
- Web: `GET /`
- API: `GET /health`

## Variables de infraestructura
- Compose defaults: `infra/docker/.env.example`
- Swarm defaults/placeholders: `infra/swarm/.env.example`
- App env base:
  - `apps/web/.env.example`
  - `apps/api/.env.example`

## Comandos recomendados
- `pnpm docker:dev:up`
- `pnpm docker:dev:logs`
- `pnpm docker:dev:down`
- `pnpm docker:build:web`
- `pnpm docker:build:api`
- `pnpm docker:stack:validate`

## Nota
Este baseline no ejecuta deploy real ni modifica redes/stacks del servidor.
