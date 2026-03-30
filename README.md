# Leadflow

Leadflow es un SaaS de captación, asignación y automatización de leads construido como monorepo con `web` y `api`.

## Arquitectura actual

Flujo operativo real:

`Traefik -> Docker Swarm -> web -> api -> Prisma/Postgres -> n8n dispatcher`

Piezas principales:

- `apps/web`: Next.js. Atiende el sitio principal y el runtime público por `HostRegexp`.
- `apps/api`: NestJS + Fastify. Expone auth, runtime público, asignación de leads e integraciones.
- `Prisma/Postgres`: persistencia transaccional del backend.
- `n8n`: recibe eventos del dispatcher y automatizaciones complementarias.

## Fuente de verdad de despliegue

Usa solo estos archivos:

- producción: `infra/swarm/docker-stack.yml`
- local Swarm: `infra/swarm/docker-stack.local.yml`
- desarrollo con Compose: `infra/docker/docker-compose.dev.yml`
- variables ejemplo de Swarm: `infra/swarm/.env.example`
- variables ejemplo de API: `apps/api/.env.example`
- variables ejemplo de web: `apps/web/.env.example`

Archivos obsoletos retirados:

- `docker-swarm.yml`
- `README_INIT.md`
- `temp_jakawi_src/`

## Requisitos

- Node.js `>= 20.16`
- `pnpm@9`
- Docker
- acceso a PostgreSQL para la API
- acceso a Traefik y Swarm para producción

## Estructura del repo

```text
apps/
  api/   NestJS + Prisma
  web/   Next.js app router
infra/
  docker/  entorno local con docker compose
  swarm/   stacks y ejemplos de variables para Swarm
packages/
  config/
  types/
  ui/
```

## Variables de entorno críticas

### API

La API necesita como mínimo:

- `DATABASE_URL`
- `APP_BASE_DOMAIN`
- `API_URL`
- `SITE_URL`
- `MEMBERS_URL`
- `ADMIN_URL`
- `CORS_ALLOWED_ORIGINS`
- `N8N_DISPATCHER_WEBHOOK_URL`

Variables de integración frecuentes:

- `EVOLUTION_API_INTERNAL_BASE_URL`
- `EVOLUTION_API_KEY`
- `N8N_WEBHOOK_INTERNAL_BASE`
- `N8N_WEBHOOK_ID`
- `N8N_DISPATCHER_API_KEY`
- `N8N_AUTOMATION_WEBHOOK_BASE_URL`
- `MESSAGING_AUTOMATION_WEBHOOK_BASE_URL`

### Web

La web publica y consume:

- `NEXT_PUBLIC_APP_BASE_DOMAIN`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MEMBERS_URL`
- `NEXT_PUBLIC_ADMIN_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SAAS_CUSTOMER_CNAME_TARGET`
- `NEXT_PUBLIC_SAAS_FALLBACK_ORIGIN`

## Desarrollo local

Instalar dependencias:

```bash
pnpm install
```

Levantar web y api en modo desarrollo:

```bash
pnpm dev
```

Levantar infraestructura local con Docker:

```bash
pnpm docker:dev:up
```

Comandos útiles:

```bash
pnpm dev:web
pnpm dev:api
pnpm build
pnpm test
pnpm typecheck
pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed
```

## Despliegue a Swarm

1. Crea un archivo de entorno a partir de `infra/swarm/.env.example`.
2. Define al menos `DATABASE_URL` y `N8N_DISPATCHER_WEBHOOK_URL`.
3. Construye y publica imágenes.
4. Despliega el stack canónico.

Ejemplo de despliegue desde la raíz:

```bash
set -a
source infra/swarm/.env.deploy
set +a

docker build \
  --target runner \
  -f apps/api/Dockerfile \
  -t ghcr.io/soyjavierquiroz/leadflow-api:latest \
  .

docker build \
  --target runner \
  -f apps/web/Dockerfile \
  -t ghcr.io/soyjavierquiroz/leadflow-web:latest \
  .

docker stack deploy \
  --with-registry-auth \
  --resolve-image never \
  -c infra/swarm/docker-stack.yml \
  leadflow
```

## Dispatcher n8n

El dispatcher de contexto de lead sale desde:

- `apps/api/src/modules/public-funnel-runtime/lead-capture-assignment.service.ts`
- `apps/api/src/modules/messaging-automation/lead-dispatcher.service.ts`

Logs productivos preservados:

- `Dispatcher URL: ...`
- `Sending payload to n8n...`
- `Lead dispatcher failed`

Ver logs del servicio:

```bash
docker service logs -f --tail 200 leadflow_api 2>&1 | grep --line-buffered -E 'Dispatcher URL:|Sending payload to n8n|Lead dispatcher failed'
```

## Estado operativo conocido

Según el código actual:

- la web enruta tráfico SaaS por `HostRegexp`
- la API depende explícitamente de `DATABASE_URL`
- el dispatcher depende explícitamente de `N8N_DISPATCHER_WEBHOOK_URL`
- ya se verificó en producción que la API arranca y que la URL del dispatcher se carga
- aún falta observar un submit real para cerrar la verificación end-to-end hacia n8n

## Verificación rápida

Validar tipos en la API:

```bash
pnpm --filter @leadflow/api typecheck
```

Validar el stack:

```bash
pnpm docker:stack:validate
pnpm docker:stack:validate:local
```
