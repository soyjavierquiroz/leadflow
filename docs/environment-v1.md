# Environment v1

## Objetivo
Definir variables minimas para operar shell frontend y backend de forma coherente entre entornos.

## Frontend (`apps/web/.env.example`)

Variables:
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MEMBERS_URL`
- `NEXT_PUBLIC_ADMIN_URL`
- `NEXT_PUBLIC_API_URL`

Valores de referencia en esta fase:
- `NEXT_PUBLIC_APP_NAME=Leadflow`
- `NEXT_PUBLIC_SITE_URL=https://exitosos.com`
- `NEXT_PUBLIC_MEMBERS_URL=https://members.exitosos.com`
- `NEXT_PUBLIC_ADMIN_URL=https://admin.exitosos.com`
- `NEXT_PUBLIC_API_URL=https://api.exitosos.com`

## Backend (`apps/api/.env.example`)

Variables:
- `NODE_ENV`
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

Valores de referencia en esta fase:
- `API_NAME=leadflow-api`
- `API_VERSION=0.2.0`
- `API_HOST=0.0.0.0`
- `API_PORT=3001`
- `API_GLOBAL_PREFIX=v1`
- `API_BASE_URL=https://api.exitosos.com`
- `SITE_URL=https://exitosos.com`
- `MEMBERS_URL=https://members.exitosos.com`
- `ADMIN_URL=https://admin.exitosos.com`
- `CORS_ALLOWED_ORIGINS=https://exitosos.com,https://members.exitosos.com,https://admin.exitosos.com`

## Infraestructura (`infra/*/.env.example`)

### Compose local (`infra/docker/.env.example`)
- `COMPOSE_PROJECT_NAME`
- `WEB_PORT`
- `API_PORT`

### Swarm futuro (`infra/swarm/.env.example`)
- `LEADFLOW_WEB_IMAGE`
- `LEADFLOW_API_IMAGE`
- `LEADFLOW_SITE_HOST`
- `LEADFLOW_MEMBERS_HOST`
- `LEADFLOW_ADMIN_HOST`
- `LEADFLOW_API_HOST`
- `LEADFLOW_WEB_REPLICAS`
- `LEADFLOW_API_REPLICAS`

## Variables que Javier debera definir antes de deploy real
1. `LEADFLOW_WEB_IMAGE` y `LEADFLOW_API_IMAGE` con tags versionados reales.
2. Hosts finales en caso de cambio de dominio/subdominios.
3. Cantidad de replicas por servicio segun capacidad esperada.
4. Valores de entorno productivo para web/api en Swarm (si difieren de ejemplos).

## Notas
- `GET /health` se mantiene accesible sin prefijo global.
- El prefijo global (`v1`) aplica a endpoints futuros de API.
- Las URLs de dominio aqui son objetivo de configuracion, no despliegue activo.

## Estado explicito
Todavia no hay deploy ni DNS aplicados en esta fase.
