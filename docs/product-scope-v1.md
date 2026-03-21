# Product Scope v1

## Objetivo de la fase actual
Materializar el dominio v1 de Leadflow sobre persistencia real en PostgreSQL usando Prisma, sin implementar aun auth ni el motor avanzado de asignacion.

## Alcance funcional del dominio v1
Leadflow v1 modela:
- `workspaces` como frontera tenant/operativa.
- `teams` para ownership comercial.
- `sponsors` como destinatarios de asignacion.
- `rotation-pools` como contenedores de estrategia futura.
- `funnels` para etapas y defaults operativos.
- `visitors` para trazabilidad previa al lead.
- `leads` como prospectos del negocio.
- `assignments` como contrato de asignacion.
- `events` como timeline y auditoria.

## MVP de esta etapa
- Prisma integrado en `apps/api`.
- Schema inicial y migracion base para PostgreSQL.
- Adapters/repositorios conectados al dominio.
- Seed minimo de desarrollo.
- Endpoints de lectura para validar persistencia.
- Documentacion de persistencia en `docs/persistence-v1.md`.

## Fuera de alcance en esta etapa
- Integracion con `n8n`.
- Integracion con `Evolution API`.
- Auth real.
- Motor complejo de asignacion.
- Migraciones desde WordPress.
- Funcionalidades avanzadas de BI/ML.

## Dependencias tecnicas clave
- Frontend: Next.js + Tailwind + TypeScript.
- Backend: NestJS + Fastify + TypeScript.
- Infra objetivo: Docker Swarm + Traefik + PostgreSQL + Redis.

## Criterios de avance a la siguiente fase
1. Exponer CRUDs iniciales y comandos de escritura sobre agregados core.
2. Implementar una primera estrategia simple de asignacion usando `RotationPool`.
3. Agregar auth y permisos por `workspace/team`.
4. Preparar integraciones externas sin romper el modelo base.
