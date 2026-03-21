# Deployment v1

## Estado de despliegue
No se realizo deploy en esta fase.

Este documento describe el camino de despliegue futuro usando la base ya preparada.

## Prerrequisitos antes del primer deploy real
1. Publicar imagenes versionadas de `web` y `api` en registry.
2. Confirmar existencia de red externa `traefik_public` en Swarm.
3. Definir valores reales de `infra/swarm/.env` (a partir de `.env.example`).
4. Validar DNS de:
   - `exitosos.com`
   - `members.exitosos.com`
   - `admin.exitosos.com`
   - `api.exitosos.com`
5. Revisar politicas TLS/certificados de Traefik en entorno real.

## Build de imagenes (referencia)
Desde raiz del repo:
- `pnpm docker:build:web`
- `pnpm docker:build:api`

Para produccion, usar tags inmutables (ejemplo):
- `ghcr.io/soyjavierquiroz/leadflow-web:<tag>`
- `ghcr.io/soyjavierquiroz/leadflow-api:<tag>`

## Validacion de stack
- `pnpm docker:stack:validate`

## Ejecucion Swarm (futuro, no ejecutado en esta fase)
Ejemplo referencial:
```bash
docker stack deploy -c infra/swarm/docker-stack.yml leadflow
```

## Riesgos a cubrir antes de deploy
- Alinear variables `NEXT_PUBLIC_*` para web segun entorno.
- Confirmar CORS en API para hosts finales.
- Definir estrategia de rollback por version de imagen.
- Definir monitoreo y logs centralizados.

## Fuera de alcance en este hito
- Integracion de DB/cache/mensajeria.
- Integraciones n8n/Evolution.
- Auth real y politicas RBAC.
