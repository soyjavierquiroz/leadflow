# Domain Model v1

Fecha: 2026-03-21 (UTC)

## Objetivo
Definir el dominio base de Leadflow para que la API crezca sobre agregados claros, contratos estables y una persistencia evolutiva sin rehacer la arquitectura.

## Entidades principales

### `Workspace`
Tenant operativo de Leadflow. Delimita configuracion, equipos, funnels, sponsors, leads, visitantes y eventos.

### `Team`
Unidad operativa principal dentro de un workspace. Posee sponsors, domains, funnel instances, tracking profiles, handoff strategies y rotation pools.

### `Sponsor`
Destino principal de asignacion comercial. Representa a la persona o cuenta que puede recibir leads dentro de un team.

### `RotationPool`
Grupo de sponsors listo para rotacion. Define el contenedor donde luego vivira la estrategia de round-robin, weighted o manual.

### `RotationMember`
Entidad de soporte para persistencia que materializa la membresia de sponsors dentro de un rotation pool, incluyendo posicion, peso y estado activo.

### `Funnel`
Embudo operativo legacy de captacion y avance comercial. Se mantiene como puente de compatibilidad mientras la operacion migra hacia `FunnelInstance`.

### `Domain`
Host publicable poseido operativamente por un `Team`.

### `FunnelTemplate`
Blueprint estructural controlado por plataforma para un funnel JSON-driven.

### `FunnelInstance`
Instancia operativa de funnel poseida por un `Team`. Hereda estructura desde un template y define defaults operativos reales.

### `FunnelStep`
Paso tipado dentro de una `FunnelInstance` para materializar el runtime multi-step.

### `FunnelPublication`
Binding publico de una `FunnelInstance` a `host + path`.

### `TrackingProfile`
Configuracion de tracking por team para Meta, TikTok o providers futuros.

### `ConversionEventMapping`
Regla declarativa que traduce eventos internos a eventos del proveedor asociado al tracking profile.

### `HandoffStrategy`
Politica declarativa de post-conversion para handoff inmediato o diferido.

### `Visitor`
Identidad previa al lead. Permite capturar trafico, fuente y trazabilidad antes de conversion.

### `Lead`
Prospecto identificado que entra al negocio. Puede nacer desde un visitor y relacionarse con funnel legacy, funnel instance y funnel publication.

### `Assignment`
Registro de asignacion de un lead a un sponsor/team/pool. En esta fase mantiene compatibilidad con `funnelId` y agrega soporte transicional para `funnelInstanceId` y `funnelPublicationId`.

### `Event`
Bitacora append-only de cambios relevantes sobre agregados del dominio para auditoria, timeline e integraciones futuras.

## Relaciones
- Un `Workspace` contiene muchos `teams`, `sponsors`, `rotation-pools`, `funnels`, `domains`, `funnel-templates`, `funnel-instances`, `funnel-publications`, `tracking-profiles`, `handoff-strategies`, `visitors`, `leads`, `assignments` y `events`.
- Un `Team` pertenece a un `Workspace` y agrupa varios `Sponsors`, `Domains`, `FunnelInstances`, `FunnelPublications`, `TrackingProfiles`, `HandoffStrategies` y `RotationPools`.
- Un `Sponsor` pertenece a un `Workspace` y a un `Team`.
- Un `RotationPool` pertenece a un `Workspace` y a un `Team`.
- Un `RotationMember` conecta `RotationPool` con `Sponsor` y conserva orden/peso de rotacion.
- Un `Funnel` legacy pertenece a un `Workspace` y puede definir `defaultTeamId` y `defaultRotationPoolId`.
- Un `Domain` pertenece a un `Workspace` y a un `Team`.
- Un `FunnelTemplate` puede ser global de plataforma o scoped a un workspace.
- Un `FunnelInstance` pertenece a un `Workspace`, a un `Team` y referencia un `FunnelTemplate`.
- Un `FunnelStep` pertenece a una `FunnelInstance`.
- Un `FunnelPublication` pertenece a un `Workspace`, a un `Team`, a un `Domain` y a una `FunnelInstance`.
- Un `TrackingProfile` pertenece a un `Workspace` y a un `Team`.
- Un `ConversionEventMapping` pertenece a un `TrackingProfile`.
- Un `HandoffStrategy` pertenece a un `Workspace` y opcionalmente a un `Team`.
- Un `Visitor` pertenece a un `Workspace` y puede convertirse en un `Lead`.
- Un `Lead` pertenece a un `Workspace`, vive todavia en un `Funnel` legacy y opcionalmente referencia `FunnelInstance` y `FunnelPublication`.
- Un `Assignment` pertenece a un `Workspace` y conecta `Lead`, `Sponsor`, `Team`, `Funnel` legacy y opcionalmente `FunnelInstance`, `FunnelPublication` y `RotationPool`.
- Un `Event` pertenece a un `Workspace` y referencia el agregado afectado (`lead`, `funnel-instance`, `tracking-profile`, etc.).

## Que entra en MVP de dominio
- Agregados y contratos base para `workspaces`, `teams`, `sponsors`, `rotation-pools`, `funnels`, `visitors`, `leads`, `assignments` y `events`.
- Expansion implementada para `domains`, `funnel-templates`, `funnel-instances`, `funnel-steps`, `funnel-publications`, `tracking-profiles`, `handoff-strategies` y `conversion-event-mappings`.
- DTOs iniciales para creacion de agregados.
- Servicios NestJS con factories de entidades draft.
- Repositorios Prisma para lectura y persistencia base.
- Modulo agregador `DomainModule` en la API.

## Que queda para fases posteriores
- runtime publico JSON-driven por `host + path`
- endpoints CRUD completos por agregado nuevo
- auth real y permisos por workspace/team/rol
- motor de asignacion con reglas, prioridades, horarios y fallback
- integraciones reales con `Meta`, `TikTok`, `n8n`, `Evolution API`, mensajeria y workers
- proyecciones, analytics y read models especializados

## Decision de persistencia
Persistencia base en PostgreSQL + Prisma con expansion v2 implementada.

Decision documentada:
- mantener `Funnel` legacy para compatibilidad
- mover ownership operativo real al `Team`
- preparar `Lead` y `Assignment` para transicionar hacia `FunnelInstance` y `FunnelPublication`
