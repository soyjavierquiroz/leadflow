# Domain & Persistence Expansion v2

Fecha: 2026-03-21 (UTC)

## Objetivo
Traducir la consolidacion de ownership, publicacion y templates a una propuesta concreta de expansion del dominio y de Prisma, sin aplicar todavia cambios reales en schema o endpoints.

## Decision principal
`Workspace` debe mantenerse como frontera tenant y organizacional.

`Team` debe asumir el rol operativo principal para:
- funnels
- dominios
- publicaciones
- tracking profiles
- rotation pools
- sponsor management operativo

Conclusion:
- `Workspace` no desaparece
- `Team` pasa a ser la unidad operativa principal

## Que puede mantenerse del modelo actual
- `Workspace`
- `Team`
- `Sponsor`
- `RotationPool`
- `RotationMember`
- `Visitor`
- `Lead`
- `Assignment`
- `DomainEvent`

Tambien puede mantenerse temporalmente:
- `Funnel` como entidad transitoria mientras migra hacia `FunnelInstance`

## Problemas del modelo actual a corregir en la siguiente fase
- `Funnel` sigue demasiado plano y mezclado
- `Team` aparece como default del funnel, no como owner explicito
- no existe entidad para dominio publicado
- no existe resolucion por `host + path`
- no existe template estructural controlado por plataforma
- no existe publicacion separada de la definicion del funnel
- no existe JSON model formal para paginas

## Entidades nuevas sugeridas

### `Domain`
Host publicable poseido operativamente por un `Team`.

Campos sugeridos:
- `id`
- `workspaceId`
- `teamId`
- `host`
- `status`
- `kind`
- `isPrimary`
- `createdAt`
- `updatedAt`

### `FunnelTemplate`
Blueprint controlado por plataforma.

Campos sugeridos:
- `id`
- `workspaceId` opcional o `null` si luego existe libreria global
- `code`
- `name`
- `status`
- `version`
- `funnelType`
- `blocksJson`
- `mediaMap`
- `settingsJson`
- `allowedOverridesJson`
- `defaultHandoffStrategyId`
- `createdAt`
- `updatedAt`

### `FunnelInstance`
Instancia operativa del funnel para un team.

Campos sugeridos:
- `id`
- `workspaceId`
- `teamId`
- `templateId`
- `code`
- `name`
- `status`
- `rotationPoolId`
- `trackingProfileId`
- `handoffStrategyId`
- `settingsJson`
- `createdAt`
- `updatedAt`

### `FunnelStep`
Paso versionable de template o instancia.

Campos sugeridos:
- `id`
- `templateId` opcional
- `funnelInstanceId` opcional
- `stepType`
- `slug`
- `position`
- `isEntryStep`
- `isConversionStep`
- `blocksJson`
- `mediaMap`
- `settingsJson`
- `createdAt`
- `updatedAt`

### `FunnelPublication`
Binding de una instancia de funnel a un `host + path`.

Campos sugeridos:
- `id`
- `workspaceId`
- `teamId`
- `domainId`
- `funnelInstanceId`
- `trackingProfileId`
- `handoffStrategyId` opcional
- `pathPrefix`
- `status`
- `isPrimary`
- `createdAt`
- `updatedAt`

### `TrackingProfile`
Perfil operativo de tracking por team.

Campos sugeridos:
- `id`
- `workspaceId`
- `teamId`
- `name`
- `provider`
- `status`
- `configJson`
- `deduplicationMode`
- `createdAt`
- `updatedAt`

### `ConversionEventMapping`
Mapeo declarativo de eventos internos hacia proveedor externo.

Campos sugeridos:
- `id`
- `trackingProfileId`
- `internalEventName`
- `providerEventName`
- `isBrowserSide`
- `isServerSide`
- `isCriticalConversion`
- `createdAt`
- `updatedAt`

### `HandoffStrategy`
Politica declarativa para post-conversion.

Campos sugeridos:
- `id`
- `workspaceId`
- `teamId` opcional
- `name`
- `type`
- `status`
- `settingsJson`
- `createdAt`
- `updatedAt`

## Cambios sugeridos a relaciones existentes

### `Team`
Debe pasar a relacionarse explicitamente con:
- `domains`
- `funnelInstances`
- `trackingProfiles`
- `handoffStrategies` operativas
- `funnelPublications`

### `Funnel`
Opciones recomendadas:

Opcion preferida:
- deprecar gradualmente `Funnel`
- crear `FunnelInstance`
- migrar consumers paso a paso

Opcion puente:
- mantener `Funnel` como wrapper transitorio
- agregar `teamId` owner explicito mientras coexiste con `defaultTeamId`

Recomendacion:
- usar la opcion preferida y evitar seguir expandiendo `Funnel` actual

### `RotationPool`
Debe mantenerse, pero siempre ligado a `Team` como owner operativo.

### `Sponsor`
Debe mantenerse bajo `Team`.

No debe recibir ownership de funnel, dominio o tracking.

## Propuesta de tablas/modelos Prisma a anadir
- `Domain`
- `FunnelTemplate`
- `FunnelInstance`
- `FunnelStep`
- `FunnelPublication`
- `TrackingProfile`
- `ConversionEventMapping`
- `HandoffStrategy`

## Propuesta de ajustes Prisma a modelos existentes

### `Team`
Anadir relaciones nuevas:
- `domains`
- `funnelInstances`
- `trackingProfiles`
- `funnelPublications`
- `handoffStrategies`

### `Workspace`
Mantener relaciones tenant-wide y agregar:
- `domains`
- `funnelTemplates`
- `funnelInstances`
- `trackingProfiles`
- `funnelPublications`
- `handoffStrategies`

### `Funnel`
No seguir cargandolo con mas campos estructurales.

Si se mantiene temporalmente:
- dejarlo como entidad legacy/transicional
- usarlo solo para compatibilidad de lectura y seeds existentes

### `Lead`
En fase posterior podria apuntar a:
- `funnelInstanceId`
- `funnelPublicationId` opcional

Esto mejoraria trazabilidad del origen publico real.

### `Assignment`
Puede mantenerse casi igual.

Solo podria evolucionar para referenciar mejor:
- `teamId`
- `funnelInstanceId`
- `funnelPublicationId` opcional

## Modelo recomendado de ownership en persistencia
- `Workspace`: tenant boundary
- `Team`: owner operativo
- `Sponsor`: actor comercial
- `FunnelTemplate`: owner de plataforma
- `FunnelInstance`: owner del team
- `Domain`: owner del team
- `FunnelPublication`: owner del team
- `TrackingProfile`: owner del team o reusable desde plataforma
- `RotationPool`: owner del team

## Reglas de resolucion que deben reflejarse en persistencia
- unicidad por `Domain.host`
- unicidad por `domainId + pathPrefix` en `FunnelPublication`
- indice para busqueda por `host + status`
- indice para busqueda por `domainId + pathPrefix + status`
- orden de precedencia resuelto en aplicacion usando longest-path match

## Estrategia de migracion recomendada

### Paso 1
Agregar nuevas tablas sin eliminar `Funnel`.

### Paso 2
Crear adapters nuevos para:
- templates
- instances
- publications
- domains
- tracking

### Paso 3
Empezar nuevos flows sobre `FunnelInstance` y `FunnelPublication`.

### Paso 4
Migrar `Lead` y `Assignment` a referencias nuevas cuando ya exista trafico real.

### Paso 5
Deprecar `Funnel` simplificado.

## Que no deberia hacerse
- no dar ownership de funnel al sponsor
- no mezclar dominio y funnel en un solo string libre
- no dejar edicion libre de bloques a los teams
- no seguir ampliando `Funnel.stages` como array opaco
- no acoplar tracking provider a logica core del lead

## Implementacion inmediata recomendada despues de esta fase
1. modelar `Domain`, `FunnelTemplate`, `FunnelInstance` y `FunnelPublication`
2. mover ownership operativo explicito al `Team`
3. definir schema JSON y allowed overrides para paginas
4. preparar luego auth/permissions sobre esa estructura, no sobre el modelo viejo
