# Product Scope v1

## Objetivo de la fase actual
Construir el nucleo del negocio de Leadflow dentro de `apps/api` sin implementar aun persistencia real, auth ni el motor avanzado de asignacion.

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
- Modulos NestJS base por agregado.
- DTOs iniciales.
- Interfaces/tipos de dominio.
- Servicios base para crear entidades draft.
- Documentacion del modelo en `docs/domain-model-v1.md`.

## Fuera de alcance en esta etapa
- Persistencia real en PostgreSQL.
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
1. Conectar persistencia real a los agregados del dominio.
2. Exponer endpoints CRUD/controlados para modulos core.
3. Implementar una primera estrategia simple de asignacion.
4. Preparar integraciones externas sin romper el modelo base.
