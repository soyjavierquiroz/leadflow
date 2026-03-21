# Product Scope v1

## Alcance funcional inicial
Leadflow v1 cubrira:
- Ingestion de leads desde canales definidos.
- Asignacion de leads por reglas configurables.
- Automatizaciones operativas con `n8n`.
- Integracion de mensajeria con `Evolution API`.

## Fuera de alcance en esta etapa
- Migraciones desde WordPress (el nuevo sistema no depende de WordPress).
- Funcionalidades avanzadas de BI/ML no esenciales para v1.
- Implementacion completa de front/back en esta fase de fundacion.

## Entregables de fundacion (fase actual)
- Repositorio inicializado y conectado a remoto oficial.
- Monorepo base con `pnpm-workspace` + `turbo`.
- Estructura `apps/` y `packages/` lista para scaffolding.
- Documentacion de arquitectura y baseline operativo inicial.

## Dependencias tecnicas clave
- Frontend: Next.js + Tailwind + TypeScript.
- Backend: NestJS + Fastify + TypeScript.
- Integraciones: n8n + Evolution API.
- Infra objetivo: Docker Swarm + Traefik + PostgreSQL + Redis.

## Criterios de avance a la siguiente fase
1. Definir contratos base API (dominio leads/asignacion).
2. Scaffold de `apps/web` y `apps/api` sin romper estructura del monorepo.
3. Definir estrategia de variables de entorno y configuracion por ambiente.
