# @leadflow/api

Backend base de Leadflow con NestJS + Fastify.

## Endpoints iniciales
- `GET /health` (sin prefijo global)
- Prefijo global para modulos de API: `/<API_GLOBAL_PREFIX>` (default `v1`)

## Dominio v1
Modulos base disponibles:
- `workspaces`
- `teams`
- `sponsors`
- `rotation-pools`
- `funnels`
- `visitors`
- `leads`
- `assignments`
- `events`

La fase actual deja contratos, DTOs y servicios draft listos para conectar persistencia despues.

## Persistencia v1
- Prisma integrado con schema en `prisma/schema.prisma`.
- PostgreSQL como datasource objetivo.
- Seed disponible en `prisma/seed.js`.
- Endpoints minimos:
  - `GET /v1/workspaces`
  - `GET /v1/sponsors`
  - `GET /v1/leads`
  - `GET /v1/rotation-pools`

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
- `SITE_URL`
- `MEMBERS_URL`
- `ADMIN_URL`
- `CORS_ALLOWED_ORIGINS`

`APP_BASE_DOMAIN` permite derivar defaults de `site/members/admin/api` cuando
no se pasan URLs explicitas por entorno.
