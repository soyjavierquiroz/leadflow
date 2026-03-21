# @leadflow/api

Backend base de Leadflow con NestJS + Fastify.

## Endpoints iniciales
- `GET /health` (sin prefijo global)
- Prefijo global para modulos de API: `/<API_GLOBAL_PREFIX>` (default `v1`)

## Modulos disponibles
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

## Persistencia actual
- Prisma integrado con schema en `prisma/schema.prisma`.
- PostgreSQL como datasource objetivo.
- Seed disponible en `prisma/seed.js`.
- Compatibilidad transicional con `Funnel` legacy.

## Endpoints minimos
- `GET /v1/workspaces`
- `GET /v1/sponsors`
- `GET /v1/leads`
- `GET /v1/rotation-pools`
- `GET /v1/domains`
- `GET /v1/funnel-templates`
- `GET /v1/funnel-instances`
- `GET /v1/funnel-publications`

## Configuracion por entorno
Definida en `src/config/runtime.ts`.

Variables soportadas:
- `APP_ENV`
- `APP_BASE_DOMAIN`
- `API_NAME`
- `API_VERSION`
- `API_HOST`
- `API_PORT`
- `API_GLOBAL_PREFIX`
- `API_BASE_URL`
- `DATABASE_URL`
- `SITE_URL`
- `MEMBERS_URL`
- `ADMIN_URL`
- `CORS_ALLOWED_ORIGINS`
