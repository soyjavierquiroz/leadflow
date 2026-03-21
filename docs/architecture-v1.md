# Architecture v1

## Alcance de esta fase
Convertir el scaffold inicial en una shell operativa de plataforma, con:
- Segmentacion visual clara (`site`, `members`, `admin`) en frontend.
- Configuracion centralizada por entorno para web y api.
- Base de dominios objetivo documentada para despliegue posterior.

## Vista de alto nivel

### Frontend (`apps/web`)
- Framework: Next.js App Router.
- Segmentos actuales:
  - `app/(site)` -> sitio publico.
  - `app/(members)` -> shell members.
  - `app/(admin)` -> shell admin.
- Configuracion publica centralizada en `lib/public-env.ts`.
- Variables `NEXT_PUBLIC_*` definidas en `apps/web/.env.example`.

### Backend (`apps/api`)
- Framework: NestJS 11 con Fastify.
- Configuracion centralizada en `src/config/runtime.ts`.
- Prefijo global API configurable (`API_GLOBAL_PREFIX`, default `v1`).
- `GET /health` se mantiene sin prefijo global.
- CORS configurable y preparado para:
  - `https://exitosos.com`
  - `https://members.exitosos.com`
  - `https://admin.exitosos.com`

### Shared packages
- `packages/types`: tipos base de dominio y configuracion.
- `packages/config`: helpers pequenos de configuracion (`splitCsv`, `normalizeUrl`, `toNumber`).
- `packages/ui`: placeholder listo para evolucion.

## Flujo de configuracion
1. Web lee variables `NEXT_PUBLIC_*`.
2. API lee variables `API_*` + dominios permitidos para CORS.
3. Ambos shells muestran informacion coherente de entorno y endpoints.

## Endpoints y rutas base
- Web local: `http://localhost:3000`
- API local: `http://localhost:3001`
- Health: `http://localhost:3001/health`
- Prefijo API para futuros recursos: `/v1` (configurable)

## Dominios objetivo (planeado)
- `exitosos.com` (site)
- `members.exitosos.com` (members)
- `admin.exitosos.com` (admin)
- `api.exitosos.com` (api)

## Fuera de alcance (aun)
- Deploy a servidor.
- DNS aplicado.
- Integracion real de auth, PostgreSQL, Redis, n8n o Evolution.

## Nota explicita de estado
Arquitectura lista para evolucion de producto, pero todavia sin deploy ni DNS aplicados.
