# Persistence v1

Fecha: 2026-03-21 (UTC)

## Objetivo
Conectar el dominio de Leadflow a PostgreSQL usando Prisma y dejar una base mantenible que soporte la expansion v2 de ownership, publicacion y templates sin romper la compatibilidad del modelo previo.

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
Base original:
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

Expansion v2 implementada:
- `Domain`
- `FunnelTemplate`
- `FunnelInstance`
- `FunnelStep`
- `FunnelPublication`
- `TrackingProfile`
- `ConversionEventMapping`
- `HandoffStrategy`

## Decisiones de modelado
- `Workspace` se mantiene como tenant boundary.
- `Team` pasa a ser el owner operativo real.
- `Funnel` se mantiene como entidad legacy/transicional.
- `FunnelInstance.legacyFunnelId` deja puente explicito hacia el modelo anterior.
- `Lead` y `Assignment` conservan `funnelId` y agregan `funnelInstanceId` y `funnelPublicationId` opcionales.
- `FunnelPublication` materializa resolucion publica por `host + path`.
- `ConversionEventMapping` se asocia a `TrackingProfile`.
- `DomainEvent.payload` se persiste como `Json`.

## Repositorios y adapters
Repositorios Prisma implementados para:
- `WorkspaceRepository`
- `TeamRepository`
- `SponsorRepository`
- `FunnelRepository`
- `DomainRepository`
- `FunnelTemplateRepository`
- `FunnelInstanceRepository`
- `FunnelStepRepository`
- `FunnelPublicationRepository`
- `TrackingProfileRepository`
- `HandoffStrategyRepository`
- `ConversionEventMappingRepository`
- `RotationPoolRepository`
- `VisitorRepository`
- `LeadRepository`
- `AssignmentRepository`
- `DomainEventRepository`

## Endpoints minimos de validacion
- `GET /v1/workspaces`
- `GET /v1/sponsors`
- `GET /v1/leads`
- `GET /v1/leads?sponsorId=...`
- `GET /v1/leads?funnelPublicationId=...`
- `GET /v1/assignments`
- `GET /v1/assignments?sponsorId=...`
- `GET /v1/assignments?funnelPublicationId=...`
- `GET /v1/rotation-pools`
- `GET /v1/domains`
- `GET /v1/funnel-templates`
- `GET /v1/funnel-instances`
- `GET /v1/funnel-publications`

## Seed de desarrollo
El seed crea:
- 1 workspace
- 1 team
- 1 domain
- 1 funnel template
- 1 funnel instance
- 2 funnel steps
- 1 funnel publication
- 1 tracking profile
- 1 handoff strategy
- 2 conversion event mappings
- 2 sponsors
- 1 rotation pool
- 2 rotation members
- 1 funnel legacy enlazado para compatibilidad

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
- `infra/docker/docker-compose.dev.yml` incluye `postgres` para desarrollo local solamente.
- No se tocaron Traefik, Cloudflare ni infraestructura productiva del servidor.

## Siguiente fase recomendada
- tracking operativo sobre capture/assignment
- handoff real posterior al assignment
- auth y permisos sobre ownership real de `Team`
