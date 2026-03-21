# Leadflow

Sistema SaaS para captación, asignación y automatización de leads, diseñado para operación multicanal con `n8n` + `Evolution API`, sin WordPress.

## Vision del producto
Leadflow centraliza el ciclo operativo de leads:
- Captura de oportunidades desde canales de entrada.
- Asignación automatizada por reglas de negocio.
- Orquestación de flujos y seguimiento con automatizaciones.
- Base preparada para evolucionar a analitica, scoring y trazabilidad completa.

## Stack v1
- Frontend: `Next.js` + `React` + `Tailwind CSS` + `TypeScript`.
- Backend: `NestJS` + `Fastify` + `TypeScript`.
- Monorepo: `pnpm workspaces` + `Turborepo`.
- Infra objetivo: Docker Swarm + Traefik + PostgreSQL + Redis.
- Integraciones clave: `n8n` + `Evolution API`.

## Estructura del repositorio
```text
leadflow/
├── apps/
│   ├── api/            # Placeholder para backend NestJS (fase siguiente)
│   └── web/            # Placeholder para frontend Next.js (fase siguiente)
├── packages/
│   ├── config/         # Configuraciones compartidas (eslint/tsconfig/etc)
│   ├── types/          # Tipos compartidos del dominio
│   └── ui/             # Componentes UI compartidos
├── docs/
│   ├── architecture-v1.md
│   ├── cleanup-plan-v1.md
│   ├── infrastructure-baseline-v1.md
│   ├── product-scope-v1.md
│   └── server-inventory.md
├── infra/              # IaC, compose/swarm, scripts de operacion
├── README.md
├── README_INIT.md      # Registro de fase inicial
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Reglas de trabajo
- No usar WordPress en el nuevo producto.
- Mantener separacion clara entre `apps` y `packages`.
- Documentar decisiones tecnicas en `docs/` antes de cambios estructurales grandes.
- Evitar cambios fuera de este repositorio para fases de analisis/bootstrapping.
- Implementar por fases: base del monorepo -> scaffolding apps -> negocio.

## Estado actual
- Base del monorepo inicializada.
- Estructura de carpetas lista para scaffolding de `apps/web` y `apps/api`.
- Documentacion operativa inicial disponible:
  - `README_INIT.md`
  - `docs/server-inventory.md`
  - `docs/infrastructure-baseline-v1.md`
  - `docs/cleanup-plan-v1.md`
  - `docs/architecture-v1.md`
  - `docs/product-scope-v1.md`
- Aun no se genero codigo de negocio ni scaffolding completo de Next/Nest.

## Proximas fases
1. Scaffold de `apps/web` y `apps/api` con estandares compartidos.
2. Definicion de contratos API y modelos de dominio.
3. Integracion progresiva con `n8n` y `Evolution API`.
