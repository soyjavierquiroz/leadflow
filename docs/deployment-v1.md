# Deployment v1

## Estado
No se realizo deploy en esta fase.

El objetivo es dejar dos rutas operativas para Portainer:
- Ruta inicial recomendada para primer despliegue controlado: imagenes locales en el servidor.
- Ruta futura: imagenes publicadas en GHCR.

## Archivos de stack
- Stack GHCR: `infra/swarm/docker-stack.yml`
- Stack local (primer deploy): `infra/swarm/docker-stack.local.yml`

## Dominios y routing (Traefik)
- `exitosos.com` -> `web`
- `members.exitosos.com` -> `web`
- `admin.exitosos.com` -> `web`
- `api.exitosos.com` -> `api`

Ambos stacks usan:
- red externa `traefik_public`
- red interna `leadflow_core`
- red placeholder `leadflow_automation`

## Opcion A: primer despliegue con imagenes locales (sin GHCR)
Tags por defecto:
- `leadflow-web:0.1.0-local`
- `leadflow-api:0.1.0-local`

Build local en el servidor:
```bash
pnpm docker:build:web:local
pnpm docker:build:api:local
# o conjunto
pnpm docker:build:local
```

Validar stack local:
```bash
pnpm docker:stack:validate:local
```

En Portainer:
1. Stacks -> Add stack.
2. Name: `leadflow`.
3. Pegar `infra/swarm/docker-stack.local.yml`.
4. Cargar variables de `infra/swarm/.env.example`.
5. Deploy en ventana controlada.

## Opcion B: despliegue con GHCR (futuro)
Imagenes objetivo:
- `ghcr.io/soyjavierquiroz/leadflow-web:latest`
- `ghcr.io/soyjavierquiroz/leadflow-api:latest`

Build/push manual:
```bash
TAG=latest pnpm docker:ghcr:build:web
TAG=latest pnpm docker:ghcr:build:api
TAG=latest pnpm docker:ghcr:push:web
TAG=latest pnpm docker:ghcr:push:api
```

## Variables de stack (Portainer)
Referencia base: `infra/swarm/.env.example`
- `LEADFLOW_SITE_HOST` (default `exitosos.com`)
- `LEADFLOW_MEMBERS_HOST` (default `members.exitosos.com`)
- `LEADFLOW_ADMIN_HOST` (default `admin.exitosos.com`)
- `LEADFLOW_API_HOST` (default `api.exitosos.com`)
- `LEADFLOW_WEB_REPLICAS` (default `1`)
- `LEADFLOW_API_REPLICAS` (default `1`)

## Limitaciones del enfoque local (importante)
- Recomendado para primer despliegue en un entorno de un solo nodo manager operativo.
- En Swarm multi-nodo, una imagen local no existe automaticamente en todos los nodos.
- Si un servicio se reprograma a otro nodo sin la imagen, puede fallar pull/start.
- Para escalar con seguridad, migrar luego a GHCR.

## Nota operativa
Esta fase solo prepara el despliegue.
No se ejecuto deploy ni se modifico infraestructura productiva.
