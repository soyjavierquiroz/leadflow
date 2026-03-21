# Deployment v1

## Estado
No se realizo deploy en esta fase.

El objetivo de este documento es dejar pasos exactos para que Javier pueda desplegar el stack `leadflow` desde Portainer cuando se abra la ventana de release.

## Imagenes esperadas (GHCR)
- `ghcr.io/soyjavierquiroz/leadflow-web:latest`
- `ghcr.io/soyjavierquiroz/leadflow-api:latest`

Estas imagenes ya estan definidas de forma fija en `infra/swarm/docker-stack.yml`.

## Publicacion manual a GHCR

### 1) Login GHCR
```bash
docker login ghcr.io -u <github-user>
```
(usar un token con permisos para `write:packages`)

### 2) Build y push (opcion script unica)
```bash
GHCR_USERNAME=<github-user> GHCR_TOKEN=<github-token> TAG=latest pnpm docker:ghcr:publish
```

### 3) Build y push (opcion paso a paso)
```bash
TAG=latest pnpm docker:ghcr:build:web
TAG=latest pnpm docker:ghcr:build:api
TAG=latest pnpm docker:ghcr:push:web
TAG=latest pnpm docker:ghcr:push:api
```

## Publicacion automatica opcional (GitHub Actions)
Se incluye workflow base en:
- `.github/workflows/publish-ghcr.yml`

Ejecucion:
1. GitHub -> Actions -> `Publish GHCR Images`
2. `Run workflow`
3. Tag sugerido: `latest` o version semantica (`v0.3.0`)

## Variables para stack en Portainer
Referencia base: `infra/swarm/.env.example`

Variables configurables en Portainer:
- `LEADFLOW_SITE_HOST` (default `exitosos.com`)
- `LEADFLOW_MEMBERS_HOST` (default `members.exitosos.com`)
- `LEADFLOW_ADMIN_HOST` (default `admin.exitosos.com`)
- `LEADFLOW_API_HOST` (default `api.exitosos.com`)
- `LEADFLOW_WEB_REPLICAS` (default `1`)
- `LEADFLOW_API_REPLICAS` (default `1`)

## Pasos exactos para Javier en Portainer

### A) Preparar precondiciones
1. Confirmar que existe la red externa `traefik_public` en Swarm.
2. Confirmar que Portainer puede descargar imagenes GHCR privadas/publicas segun configuracion.
3. Confirmar DNS de:
   - `exitosos.com`
   - `members.exitosos.com`
   - `admin.exitosos.com`
   - `api.exitosos.com`

### B) Crear/actualizar stack `leadflow`
1. Portainer -> Stacks -> Add stack.
2. Name: `leadflow`.
3. Pegar contenido de `infra/swarm/docker-stack.yml`.
4. En Environment variables de Portainer, cargar valores de `infra/swarm/.env.example`.
5. Deploy the stack.

### C) Verificacion post-deploy (cuando corresponda)
1. Verificar servicios `leadflow_web` y `leadflow_api` en estado `running`.
2. Verificar salud:
   - `https://api.exitosos.com/health`
3. Verificar rutas web:
   - `https://exitosos.com`
   - `https://members.exitosos.com`
   - `https://admin.exitosos.com`

## Routing Traefik esperado
- `Host(exitosos.com)` -> servicio `web`
- `Host(members.exitosos.com)` -> servicio `web`
- `Host(admin.exitosos.com)` -> servicio `web`
- `Host(api.exitosos.com)` -> servicio `api`

## Nota importante
Este repositorio solo deja la preparacion del despliegue.
En esta fase no se ejecuto deploy, ni se tocaron stacks/redes del servidor.
