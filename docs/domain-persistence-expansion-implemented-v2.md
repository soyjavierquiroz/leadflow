# Domain & Persistence Expansion Implemented v2

Fecha: 2026-03-21 (UTC)

## Objetivo
Documentar lo que fue implementado realmente en Leadflow para materializar la expansion v2 de dominio y persistencia, incluyendo compatibilidades y decisiones de transicion.

## Que se implemento

### Nuevas entidades Prisma
- `Domain`
- `FunnelTemplate`
- `FunnelInstance`
- `FunnelStep`
- `FunnelPublication`
- `TrackingProfile`
- `ConversionEventMapping`
- `HandoffStrategy`

### Entidades existentes que se mantienen
- `Workspace`
- `Team`
- `Sponsor`
- `RotationPool`
- `RotationMember`
- `Visitor`
- `Lead`
- `Assignment`
- `DomainEvent`
- `Funnel` como modelo legacy/transicional

## Modelo operativo implementado
- `Workspace` sigue como frontera tenant.
- `Team` ya es el owner operativo de dominios, funnel instances, publications, tracking profiles, handoff strategies, sponsors y rotation pools.
- `Sponsor` sigue siendo actor comercial, no owner del funnel.
- `FunnelTemplate` representa estructura controlada por plataforma.
- `FunnelInstance` representa la instancia operativa del team.
- `FunnelPublication` resuelve publicacion por `host + path`.

## Compatibilidad y transicion

### `Funnel` legacy
El `Funnel` original no fue eliminado.

Se mantiene para:
- compatibilidad con `Lead` y `Assignment` existentes
- continuidad de endpoints y seeds previos
- puente de migracion progresiva

Implementacion de compatibilidad:
- `FunnelInstance.legacyFunnelId` permite enlazar una instancia nueva con el funnel legacy.
- `Lead` y `Assignment` conservan `funnelId` y ademas pueden guardar `funnelInstanceId` y `funnelPublicationId`.

### `Lead` y `Assignment`
Se ampliaron con campos opcionales de transicion:
- `funnelInstanceId`
- `funnelPublicationId`

Esto deja listo el camino para que los flows publicos nuevos escriban sobre el modelo expandido sin romper consumers que todavia dependen del funnel legacy.

## Endpoints minimos implementados
- `GET /v1/workspaces`
- `GET /v1/sponsors`
- `GET /v1/leads`
- `GET /v1/rotation-pools`
- `GET /v1/domains`
- `GET /v1/funnel-templates`
- `GET /v1/funnel-instances`
- `GET /v1/funnel-publications`

## Seed implementado
El seed ahora crea:
- 1 workspace
- 1 team
- 1 domain
- 1 handoff strategy
- 1 tracking profile
- 2 conversion event mappings
- 1 funnel template
- 1 funnel instance
- 2 funnel steps
- 1 funnel publication
- 2 sponsors
- 1 rotation pool
- 2 rotation members
- 1 funnel legacy enlazado para compatibilidad

## Decision de modelado aplicada
- `ConversionEventMapping` se asocia a `TrackingProfile`.
- `TrackingProfile` y `HandoffStrategy` pueden asociarse a `FunnelInstance` y opcionalmente a `FunnelPublication`.
- `FunnelPublication` usa `domainId + pathPrefix` como clave operativa.
- `FunnelStep` queda implementado como paso de `FunnelInstance`.

## Que quedo listo para la siguiente fase
- resolver runtime publico por `host + path`
- escribir flows de captura sobre `FunnelInstance` y `FunnelPublication`
- agregar auth y permisos sobre ownership real de `Team`
- introducir lectura por steps y render JSON-driven del runtime publico
