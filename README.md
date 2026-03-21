# Leadflow

Leadflow es un SaaS para captacion, asignacion y automatizacion de leads.

Esta base usa un monorepo con `pnpm workspaces + Turborepo` y define dos apps
iniciales listas para evolucionar:
- `apps/web`: frontend en Next.js App Router.
- `apps/api`: backend en NestJS con Fastify.

## Vision del producto
- Capturar oportunidades desde multiples canales.
- Asignar leads automaticamente con reglas configurables.
- Orquestar automatizaciones operativas con n8n + Evolution API (fase posterior).
- Escalar hacia trazabilidad, analitica operativa y gobierno comercial.

## Stack elegido (v1)
- Frontend: Next.js + React + TypeScript + Tailwind CSS.
- Backend: NestJS + Fastify + TypeScript.
- Monorepo: pnpm workspaces + Turborepo.
- Infra objetivo (posterior): Docker Swarm + Traefik + PostgreSQL + Redis.
- Integraciones (posterior): n8n + Evolution API.

## Estructura del repositorio
```text
leadflow/
├── apps/
│   ├── api/                    # NestJS + Fastify
│   │   ├── src/health/
│   │   ├── src/modules/leads/
│   │   └── src/modules/assignment/
│   └── web/                    # Next.js App Router + Tailwind
│       └── app/
│           ├── (site)/
│           ├── (members)/members/
│           └── (admin)/admin/
├── packages/
│   ├── ui/                     # package placeholder compartido
│   ├── config/                 # package placeholder compartido
│   └── types/                  # tipos compartidos iniciales
├── docs/
│   ├── architecture-v1.md
│   ├── cleanup-plan-v1.md
│   ├── infrastructure-baseline-v1.md
│   ├── product-scope-v1.md
│   └── server-inventory.md
├── infra/
├── README.md
├── README_INIT.md
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Scripts del workspace
Desde raiz del repo:
- `pnpm dev` -> desarrollo paralelo de apps con Turbo.
- `pnpm dev:web` -> levanta solo frontend.
- `pnpm dev:api` -> levanta solo backend.
- `pnpm build` -> build de todos los paquetes/apps.
- `pnpm lint` -> lint del workspace.
- `pnpm test` -> tests disponibles del workspace.

## Endpoints y rutas base
- Web local: `http://localhost:3000`
- API local: `http://localhost:3001`
- Health API: `http://localhost:3001/health`
- Rutas web iniciales:
  - `/` (site publico)
  - `/members` (placeholder members)
  - `/admin` (placeholder admin)

## Reglas de trabajo
- No usar WordPress en el nuevo sistema.
- Mantener Nest dentro de `apps/api` (sin estructura monorepo propia de Nest CLI).
- Mantener Next dentro de `apps/web` con App Router.
- Evolucionar por fases sin mezclar infraestructura productiva del servidor con este repo.
- Documentar decisiones importantes en `docs/`.

## Estado actual del proyecto
- Fundacion del monorepo completada.
- Scaffold funcional de `apps/web` y `apps/api` implementado.
- Backend con Fastify, `ConfigModule` global, endpoint `GET /health` y modulos base.
- Frontend con home temporal profesional y estructura para separar `site`, `members` y `admin`.
- Integraciones y datos (n8n, Evolution API, PostgreSQL, Redis) aun no implementados en codigo.

## Documentacion relacionada
- `README_INIT.md`
- `docs/architecture-v1.md`
- `docs/product-scope-v1.md`
- `docs/infrastructure-baseline-v1.md`
- `docs/cleanup-plan-v1.md`
- `docs/server-inventory.md`
