# Deployment Local v1

## Objetivo
Desplegar `leadflow` desde Portainer usando imagenes Docker construidas localmente en el mismo servidor, sin GHCR en esta fase.

## Alcance
- Valido para primer despliegue controlado.
- Recomendado para Swarm de un solo nodo manager operativo.
- No aplica como estrategia final para cluster multi-nodo.

## Imagenes locales esperadas
- `leadflow-web:0.1.0-local`
- `leadflow-api:0.1.0-local`

## Comandos de build local
Desde `/opt/projects/leadflow`:
```bash
pnpm docker:build:web:local
pnpm docker:build:api:local
# o build conjunto
pnpm docker:build:local
```

Opcional (tag distinto):
```bash
TAG=0.1.1-local pnpm docker:build:local
```

## Stack para Portainer
Usar:
- `infra/swarm/docker-stack.local.yml`

Verificacion previa:
```bash
docker stack config -c infra/swarm/docker-stack.local.yml
```

## Variables requeridas
Cargar en Portainer (o usar defaults) segun `infra/swarm/.env.example`:
- `LEADFLOW_SITE_HOST`
- `LEADFLOW_MEMBERS_HOST`
- `LEADFLOW_ADMIN_HOST`
- `LEADFLOW_API_HOST`
- `LEADFLOW_WEB_REPLICAS`
- `LEADFLOW_API_REPLICAS`

## Pasos en Portainer
1. Validar que exista la red externa `traefik_public`.
2. Portainer -> Stacks -> Add stack.
3. Name: `leadflow`.
4. Pegar contenido de `infra/swarm/docker-stack.local.yml`.
5. Definir variables de entorno del stack.
6. Deploy en ventana controlada.

## Validaciones post-deploy esperadas
- Servicio `leadflow_web` en `running`.
- Servicio `leadflow_api` en `running`.
- `https://api.exitosos.com/health` responde OK.
- Sitios accesibles:
  - `https://exitosos.com`
  - `https://members.exitosos.com`
  - `https://admin.exitosos.com`

## Riesgos y limitaciones
- Las imagenes locales no se distribuyen automaticamente entre nodos Swarm.
- Si el scheduler mueve tareas a otro nodo sin imagen local, el contenedor falla.
- Para alta disponibilidad real, migrar a imagenes en registry (GHCR).

## Nota
Este documento no ejecuta deploy; solo define el procedimiento operativo.
