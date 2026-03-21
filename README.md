# Leadflow

Leadflow es un SaaS para captacion, asignacion y automatizacion de leads.

## Estado de esta fase
Se implemento una shell operativa inicial de plataforma sobre monorepo, con:
- `apps/web`: shell visual en Next.js App Router con segmentos `site`, `members`, `admin`.
- `apps/api`: shell backend en NestJS + Fastify con configuracion centralizada por entorno.
- Configuracion de dominios y URLs base mediante variables de entorno.

No hay deploy en esta fase.

## Stack tecnico
- Frontend: Next.js + React + TypeScript + Tailwind.
- Backend: NestJS + Fastify.
- Monorepo: pnpm workspaces + Turborepo.
- Integraciones futuras (no implementadas aun): n8n, Evolution API, PostgreSQL, Redis.

## Estructura principal
```text
leadflow/
├── apps/
│   ├── web/
│   │   ├── app/(site)/
│   │   ├── app/(members)/
│   │   ├── app/(admin)/
│   │   ├── lib/public-env.ts
│   │   └── .env.example
│   └── api/
│       ├── src/config/runtime.ts
│       ├── src/health/
│       ├── src/modules/
│       └── .env.example
├── packages/
│   ├── config/
│   ├── types/
│   └── ui/
├── docs/
│   ├── architecture-v1.md
│   ├── domain-strategy-v1.md
│   ├── environment-v1.md
│   ├── infrastructure-baseline-v1.md
│   ├── cleanup-plan-v1.md
│   └── server-inventory.md
└── infra/
```

## Dominio y subdominios objetivo (planeado)
- `https://exitosos.com` -> sitio publico.
- `https://members.exitosos.com` -> panel sponsors.
- `https://admin.exitosos.com` -> panel admin.
- `https://api.exitosos.com` -> API publica controlada.

## Scripts del workspace
Desde la raiz:
- `pnpm dev`
- `pnpm dev:web`
- `pnpm dev:api`
- `pnpm build`
- `pnpm lint`
- `pnpm test`

## Variables de entorno
Revisar:
- `apps/web/.env.example`
- `apps/api/.env.example`
- `docs/environment-v1.md`

## Documentacion relacionada
- `README_INIT.md`
- `docs/architecture-v1.md`
- `docs/domain-strategy-v1.md`
- `docs/environment-v1.md`
- `docs/product-scope-v1.md`
- `docs/infrastructure-baseline-v1.md`
- `docs/cleanup-plan-v1.md`
- `docs/server-inventory.md`

## Nota operativa
En esta fase no se aplicaron cambios de infraestructura, DNS ni despliegues.
Todo se mantuvo dentro del repositorio local en `/opt/projects/leadflow`.
