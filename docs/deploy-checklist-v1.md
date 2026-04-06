# Deploy Checklist v1

Fecha de preflight: 2026-03-21 (UTC)
Stack objetivo: `leadflow`
Stack file: `infra/swarm/docker-stack.yml`

## Estado del preflight (esta corrida)
- Repo limpio y sincronizado con `origin/main`: SI
- Stack YAML valido (`docker stack config`): SI
- Referencias de imagenes GHCR en stack: SI
- Routing Traefik por host esperado: SI
- Credenciales GHCR disponibles localmente: NO
- Confirmacion de existencia/acceso a imagenes `latest`: NO (respuesta `denied` sin auth)

## Checklist pre-deploy

1. Codigo y configuracion
- [ ] `main` actualizado y sin cambios locales.
- [ ] `infra/swarm/docker-stack.yml` validado con `docker stack config -c infra/swarm/docker-stack.yml`.
- [ ] Variables de stack revisadas en `infra/swarm/.env.example`.

2. Imagenes GHCR
- [ ] Publicar `ghcr.io/soyjavierquiroz/leadflow-web:latest`.
- [ ] Publicar `ghcr.io/soyjavierquiroz/leadflow-api:latest`.
- [ ] Verificar acceso pull desde entorno Swarm/Portainer.

3. Dominio y red
- [ ] DNS de `exitosos.com`, `members.exitosos.com`, `admin.exitosos.com`, `api.exitosos.com` apuntando a `${LEADFLOW_SWARM_ORIGIN_IP}`.
- [ ] Red externa `traefik_public` existente en Swarm.
- [ ] Sin colision de routers/hosts en Traefik.

## Checklist Portainer (stack `leadflow`)

1. En Portainer
- [ ] Ir a `Stacks` -> `Add stack` o actualizar stack existente `leadflow`.
- [ ] Pegar contenido de `infra/swarm/docker-stack.yml`.
- [ ] Cargar variables de entorno del stack:
  - `LEADFLOW_SITE_HOST`
  - `LEADFLOW_MEMBERS_HOST`
  - `LEADFLOW_ADMIN_HOST`
  - `LEADFLOW_API_HOST`
  - `LEADFLOW_WEB_REPLICAS`
  - `LEADFLOW_API_REPLICAS`
- [ ] Confirmar registry auth para GHCR si repositorio de imagen es privado.
- [ ] Deploy en ventana controlada.

2. Routing esperado
- [ ] `Host(exitosos.com)` -> `leadflow-web`
- [ ] `Host(members.exitosos.com)` -> `leadflow-web`
- [ ] `Host(admin.exitosos.com)` -> `leadflow-web`
- [ ] `Host(api.exitosos.com)` -> `leadflow-api`

## Checklist post-deploy

1. Estado de servicios
- [ ] `leadflow_web` en `Running`.
- [ ] `leadflow_api` en `Running`.
- [ ] Healthchecks en estado healthy.

2. Validaciones funcionales minimas
- [ ] `https://exitosos.com` responde.
- [ ] `https://members.exitosos.com` responde.
- [ ] `https://admin.exitosos.com` responde.
- [ ] `https://api.exitosos.com/health` responde `200`.

3. Validaciones de API
- [ ] `GET /health` muestra `status: ok`.
- [ ] `globalPrefix` esperado (`v1`).
- [ ] `corsAllowedOrigins` contiene los 3 hosts web.

## Salud esperada

### Web
- Endpoint de healthcheck interno en stack: `GET http://127.0.0.1:3000/`
- Resultado esperado: HTTP 200

### API
- Endpoint de healthcheck interno en stack: `GET http://127.0.0.1:3001/health`
- Resultado esperado: HTTP 200 con payload que incluya:
  - `status: "ok"`
  - `service: "leadflow-api"`
  - `version`
  - `globalPrefix: "v1"`

## Bloqueadores actuales detectados
1. No hay credenciales GHCR en este entorno local (`GHCR_USERNAME`/`GHCR_TOKEN` no definidos).
2. No hay autenticacion Docker persistida (`~/.docker/config.json` ausente).
3. Verificacion de imagenes GHCR devolvio `denied` sin auth, por lo que no se puede confirmar disponibilidad actual de `latest` desde aqui.

## Accion requerida antes de pulsar Deploy
- Publicar y/o validar pull de las dos imagenes GHCR con credenciales correctas.
- Confirmar DNS y red `traefik_public` en Swarm.
- Cargar variables del stack en Portainer y desplegar en ventana controlada.
