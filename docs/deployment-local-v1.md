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
Los scripts construyen la etapa `runner` de cada Dockerfile (runtime de produccion).

Opcional (tag distinto):
```bash
TAG=0.1.1-local pnpm docker:build:local
```

Verificacion de runtime esperado:
```bash
docker image inspect leadflow-web:0.1.0-local --format 'Cmd={{json .Config.Cmd}} Workdir={{.Config.WorkingDir}}'
docker image inspect leadflow-api:0.1.0-local --format 'Cmd={{json .Config.Cmd}} Workdir={{.Config.WorkingDir}}'
```
Salida esperada:
- Web: `["node","apps/web/server.js"]` con `Workdir=/app`
- API: `["node","apps/api/dist/main.js"]` con `Workdir=/app`

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
- `DATABASE_URL`
- `LEADFLOW_WEB_REPLICAS`
- `LEADFLOW_API_REPLICAS`

Variables de base de datos recomendadas para staging sobre la infraestructura compartida:
- `POSTGRES_HOST=postgres`
- `POSTGRES_PORT=5432`
- `POSTGRES_DB=leadflow`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=<password real del servicio postgres_pgvector>`
- `DATABASE_URL=postgresql://postgres:<password real del servicio postgres_pgvector>@postgres:5432/leadflow?schema=public`

Nota operativa:
- el stack local de Leadflow no levanta un `postgres` propio en Swarm
- reutiliza el servicio compartido `postgres_pgvector_postgres`
- para eso, `leadflow_api` debe quedar unido a la red externa `general_network`

## Pasos en Portainer
1. Validar que exista la red externa `traefik_public`.
2. Validar que exista la red externa `general_network`.
3. Portainer -> Stacks -> Add stack.
4. Name: `leadflow`.
5. Pegar contenido de `infra/swarm/docker-stack.local.yml`.
6. Definir variables de entorno del stack.
7. Deploy en ventana controlada.

## Bootstrap de base de datos
Si la base `leadflow` aun no existe en el Postgres compartido:
```bash
container_id=$(docker ps --filter label=com.docker.swarm.service.name=postgres_pgvector_postgres --format '{{.ID}}' | head -n1)
docker exec "$container_id" sh -lc "psql -U postgres -d postgres -c 'CREATE DATABASE leadflow;'"
```

Despues del `Update the stack`, aplicar migraciones:
```bash
docker run --rm \
  --network general_network \
  -e DATABASE_URL='postgresql://postgres:<password real>@postgres:5432/leadflow?schema=public' \
  leadflow-api:0.1.0-local \
  sh -lc 'cd /app/apps/api && npx prisma migrate deploy'
```

Seed de datos:
```bash
docker run --rm \
  --network general_network \
  -e DATABASE_URL='postgresql://postgres:<password real>@postgres:5432/leadflow?schema=public' \
  leadflow-api:0.1.0-local \
  sh -lc 'cd /app/apps/api && node prisma/seed.js'
```

## Validaciones post-deploy esperadas
- Servicio `leadflow_web` en `running`.
- Servicio `leadflow_api` en `running`.
- `https://api.exitosos.com/health` responde OK.
- Sitios accesibles:
  - `https://exitosos.com`
  - `https://members.exitosos.com`
  - `https://admin.exitosos.com`

## Nota TLS para Cloudflare Full (strict)
- Se agrego `tls.certresolver=le` en los routers:
  - `leadflow-site`
  - `leadflow-members`
  - `leadflow-admin`
  - `leadflow-api`
- Se definio en `leadflow-site`:
  - `tls.domains[0].main=exitosos.com`
  - `tls.domains[0].sans=members.exitosos.com,admin.exitosos.com,api.exitosos.com`
- Motivo: evitar fallback a `TRAEFIK DEFAULT CERT`, que provoca error 526 en Cloudflare strict cuando el host no esta cubierto por un certificado valido en origen.
- Nota: wildcard real (`*.exitosos.com`) requiere DNS challenge en ACME. Con la configuracion actual de Traefik (`http/tls challenge`), se usa cobertura explicita por host.

## Riesgos y limitaciones
- Las imagenes locales no se distribuyen automaticamente entre nodos Swarm.
- Si el scheduler mueve tareas a otro nodo sin imagen local, el contenedor falla.
- Para alta disponibilidad real, migrar a imagenes en registry (GHCR).

## Nota
Este documento no ejecuta deploy; solo define el procedimiento operativo.
