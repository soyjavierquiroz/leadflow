# Persistence v1

Fecha: 2026-03-21 (UTC)

## Objetivo
Conectar el dominio v1 de Leadflow a PostgreSQL usando Prisma, dejando una base de persistencia mantenible, migrable y lista para crecer sin rehacer el dominio.

## Stack aplicado
- PostgreSQL como base de datos objetivo.
- Prisma como ORM y capa inicial de acceso a datos.
- Repositorios Prisma conectados a los puertos del dominio en `apps/api`.

## Ubicacion principal
- Schema: `apps/api/prisma/schema.prisma`
- Migraciones: `apps/api/prisma/migrations`
- Seed: `apps/api/prisma/seed.js`
- Capa Prisma Nest: `apps/api/src/prisma`

## Entidades persistidas
- `Workspace`
- `Team`
- `Sponsor`
- `Funnel`
- `RotationPool`
- `RotationMember`
- `Visitor`
- `Lead`
- `Assignment`
- `DomainEvent`

## Decisiones de modelado
- `RotationMember` materializa la pertenencia de sponsors a un pool con `position`, `weight` e `isActive`.
- `Lead.visitorId` se modela como relacion uno-a-uno opcional para conservar la trazabilidad de conversion.
- `Lead.currentAssignmentId` conserva la asignacion vigente sin eliminar el historial de `Assignment`.
- `Funnel.defaultRotationPoolId` y `Funnel.defaultTeamId` cubren el default operativo sin sobre-modelar reglas.
- `DomainEvent.payload` se persiste como `Json`.

## Repositorios y adapters
Repositorios Prisma implementados para:
- `WorkspaceRepository`
- `TeamRepository`
- `SponsorRepository`
- `FunnelRepository`
- `RotationPoolRepository`
- `VisitorRepository`
- `LeadRepository`
- `AssignmentRepository`
- `DomainEventRepository`

## Endpoints minimos de validacion
- `GET /v1/workspaces`
- `GET /v1/sponsors`
- `GET /v1/leads`
- `GET /v1/rotation-pools`

## Seed de desarrollo
El seed crea:
- 1 workspace
- 1 team
- 2 sponsors
- 1 funnel
- 1 rotation pool
- 2 rotation members asociados

## Scripts utiles
En raiz del repo:
- `pnpm db:generate`
- `pnpm db:migrate:dev`
- `pnpm db:migrate:deploy`
- `pnpm db:seed`

En `apps/api`:
- `pnpm prisma:generate`
- `pnpm prisma:migrate:dev`
- `pnpm prisma:migrate:deploy`
- `pnpm prisma:seed`

## Desarrollo local
- `infra/docker/docker-compose.dev.yml` ahora incluye `postgres` para desarrollo local solamente.
- No se tocaron Traefik, Cloudflare ni infraestructura productiva del servidor.

## Siguiente fase recomendada
- CRUDs iniciales y comandos de escritura.
- Primera estrategia simple de asignacion sobre `RotationPool`.
- Auth y permisos por workspace/team.
