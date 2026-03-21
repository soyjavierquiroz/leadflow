# Environment v1

## Objetivo
Definir una convencion de variables para que Leadflow sea domain-agnostic y el cambio de dominio se haga por configuracion, no por cambios de codigo.

## Convencion base
Variables transversales recomendadas:
- `APP_ENV` (por ejemplo: `development`, `staging`, `production`)
- `APP_BASE_DOMAIN` (dominio base del entorno)

Variables de URLs funcionales:
- `SITE_URL`
- `MEMBERS_URL`
- `ADMIN_URL`
- `API_URL`

## Frontend (`apps/web/.env.example`)

Variables:
- `APP_ENV`
- `APP_BASE_DOMAIN`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_ENV`
- `NEXT_PUBLIC_APP_BASE_DOMAIN`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MEMBERS_URL`
- `NEXT_PUBLIC_ADMIN_URL`
- `NEXT_PUBLIC_API_URL`

Valores de referencia en staging temporal:
- `APP_ENV=staging`
- `APP_BASE_DOMAIN=exitosos.com`
- `NEXT_PUBLIC_APP_NAME=Leadflow`
- `NEXT_PUBLIC_APP_ENV=staging`
- `NEXT_PUBLIC_APP_BASE_DOMAIN=exitosos.com`
- `NEXT_PUBLIC_SITE_URL=https://exitosos.com`
- `NEXT_PUBLIC_MEMBERS_URL=https://members.exitosos.com`
- `NEXT_PUBLIC_ADMIN_URL=https://admin.exitosos.com`
- `NEXT_PUBLIC_API_URL=https://api.exitosos.com`

Nota:
- Si faltan URLs explicitas, `apps/web/lib/public-env.ts` puede derivarlas desde `NEXT_PUBLIC_APP_BASE_DOMAIN`.

## Backend (`apps/api/.env.example`)

Variables:
- `NODE_ENV`
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

Valores de referencia en staging temporal:
- `APP_ENV=staging`
- `APP_BASE_DOMAIN=exitosos.com`
- `API_BASE_URL=https://api.exitosos.com`
- `SITE_URL=https://exitosos.com`
- `MEMBERS_URL=https://members.exitosos.com`
- `ADMIN_URL=https://admin.exitosos.com`
- `CORS_ALLOWED_ORIGINS=https://exitosos.com,https://members.exitosos.com,https://admin.exitosos.com`

Nota:
- Si faltan URLs explicitas, `apps/api/src/config/runtime.ts` puede derivarlas desde `APP_BASE_DOMAIN`.

## Infraestructura (`infra/*/.env.example`)

### Compose local (`infra/docker/.env.example`)
- `COMPOSE_PROJECT_NAME`
- `WEB_PORT`
- `API_PORT`

### Swarm (`infra/swarm/.env.example`)
Variables de dominio/entorno:
- `APP_ENV`
- `APP_BASE_DOMAIN`
- `LEADFLOW_SITE_HOST`
- `LEADFLOW_MEMBERS_HOST`
- `LEADFLOW_ADMIN_HOST`
- `LEADFLOW_API_HOST`
- `SITE_URL`
- `MEMBERS_URL`
- `ADMIN_URL`
- `API_URL`
- `CORS_ALLOWED_ORIGINS`

Variables de replicas:
- `LEADFLOW_WEB_REPLICAS`
- `LEADFLOW_API_REPLICAS`

## Politica operativa
1. El dominio temporal de staging se define solo en archivos `*.env.example` y en docs de staging.
2. El dominio final de lanzamiento se cambia actualizando variables, sin rehacer codigo ni arquitectura.
3. Componentes y logica de negocio no deben hardcodear hostnames.

## Estado explicito
Todavia no hay deploy ni DNS aplicados en esta fase.
