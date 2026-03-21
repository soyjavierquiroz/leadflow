# @leadflow/api

Backend base de Leadflow con NestJS + Fastify.

## Endpoints iniciales
- `GET /health` (sin prefijo global)
- Prefijo global para modulos de API: `/<API_GLOBAL_PREFIX>` (default `v1`)

## Configuracion por entorno
Definida en `src/config/runtime.ts`.

Variables soportadas:
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

CORS queda preparado para `exitosos.com`, `members.exitosos.com` y
`admin.exitosos.com` via variables de entorno.
