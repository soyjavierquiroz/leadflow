# Funnel Domain Expansion v1

Fecha: 2026-03-21 (UTC)

## Objetivo
Proponer la expansion del dominio actual de Leadflow para soportar funnels multi-step, multi-domain y multi-profile tracking sin aplicar aun cambios de persistencia o infraestructura.

## Problema a resolver
La entidad `Funnel` actual modela bien un embudo operativo simple, pero no alcanza para describir:
- plantillas reutilizables
- instancias publicadas en distintos dominios o paths
- pasos tipados y ordenados
- perfiles de tracking por proveedor
- estrategias de handoff post-conversion

## Expansion recomendada del agregado funnel

### Mantener `Funnel` actual como base transitoria
En lugar de reescribir abruptamente el modelo, conviene tratar el `Funnel` actual como una version simplificada del futuro `FunnelInstance`.

Beneficio:
- preserva compatibilidad con persistencia v1
- evita romper seeds y endpoints ya conectados
- permite migracion progresiva

### Introducir nuevas entidades de dominio

#### `FunnelTemplate`
Blueprint reutilizable por workspace o libreria interna.

Campos conceptuales minimos:
- `id`
- `workspaceId` opcional si luego existe libreria global
- `name`
- `code`
- `funnelType`
- `defaultHandoffStrategyId`
- `status`

#### `FunnelInstance`
Embudo operativo publicado.

Campos conceptuales minimos:
- `id`
- `workspaceId`
- `templateId` opcional
- `name`
- `code`
- `status`
- `defaultTeamId`
- `defaultRotationPoolId`
- `trackingProfileId`

#### `FunnelStep`
Paso ordenado dentro de una instancia o plantilla.

Campos conceptuales minimos:
- `id`
- `funnelInstanceId` o `templateId`
- `stepType`
- `slug`
- `position`
- `isEntryStep`
- `isConversionStep`
- `nextStepId` opcional
- `settings` JSON

#### `TrackingProfile`
Configuracion por proveedor para tracking publicitario y analitico.

Campos conceptuales minimos:
- `id`
- `workspaceId`
- `name`
- `provider`
- `pixelOrAccountRef`
- `apiCredentialsRef` futuro
- `deduplicationMode`
- `status`

#### `ConversionEventMapping`
Regla de traduccion entre eventos internos y eventos de plataforma.

Campos conceptuales minimos:
- `id`
- `trackingProfileId`
- `internalEventName`
- `providerEventName`
- `isServerSide`
- `isBrowserSide`
- `isCriticalConversion`

#### `DomainBinding`
Publicacion de un funnel sobre dominio, subdominio o path.

Campos conceptuales minimos:
- `id`
- `workspaceId`
- `funnelInstanceId`
- `host`
- `pathPrefix`
- `isPrimary`
- `status`

#### `HandoffStrategy`
Politica declarativa de post-conversion.

Campos conceptuales minimos:
- `id`
- `workspaceId`
- `name`
- `type`
- `settings` JSON
- `status`

## Relaciones recomendadas
- Un `Workspace` tiene muchos `FunnelTemplates`, `FunnelInstances`, `TrackingProfiles`, `DomainBindings` y `HandoffStrategies`.
- Un `FunnelTemplate` tiene muchos `FunnelSteps` plantilla.
- Un `FunnelInstance` puede originarse desde un `FunnelTemplate`.
- Un `FunnelInstance` tiene muchos `FunnelSteps` efectivos.
- Un `FunnelInstance` tiene uno o muchos `DomainBindings`.
- Un `FunnelInstance` referencia un `TrackingProfile` principal.
- Un `TrackingProfile` tiene muchos `ConversionEventMappings`.
- Un `FunnelInstance` o `FunnelTemplate` referencia una `HandoffStrategy`.

## Estrategia de evolucion sin ruptura

### Fase 1
Mantener `Funnel` actual y documentar el gap.

### Fase 2
Agregar nuevas tablas y entidades sin retirar `Funnel` actual.

### Fase 3
Migrar `Funnel.stages` a `FunnelStep` y convertir `defaultRotationPoolId`/`defaultTeamId` en campos del `FunnelInstance` formal.

### Fase 4
Deprecar el uso directo de `Funnel` simplificado cuando los consumers ya lean desde la nueva estructura.

## Impacto sobre tracking y eventos
La expansion propuesta permite:
- medir por paso y no solo por funnel
- cambiar mappings por proveedor sin tocar logica de negocio
- sostener browser + server deduplication de forma nativa
- introducir handoff inmediato o diferido como configuracion y no como hardcode

## Impacto sobre multi-domain
El dominio no debe vivir dentro del agregado `Funnel` como string libre. Debe vivir en `DomainBinding` para soportar:
- varios funnels en un mismo host por path
- distintos dominios para un mismo workspace
- cambio de dominio sin reescribir entidades operativas

## Impacto sobre asignacion
La expansion no reemplaza `RotationPool` ni `Assignment`; los complementa.

Regla recomendada:
- el funnel decide el contexto de handoff y defaults operativos
- el motor de asignacion decide a quien se entrega el lead cuando corresponde

## Decision recomendada
Aplicar esta expansion en una fase posterior de dominio y persistencia, despues de cerrar la base documental y antes de implementar flows complejos de captacion, tracking y handoff reales.
