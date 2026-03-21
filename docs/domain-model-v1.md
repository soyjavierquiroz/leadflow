# Domain Model v1

Fecha: 2026-03-21 (UTC)

## Objetivo
Definir la primera version del dominio de negocio de Leadflow para que la API crezca sobre agregados claros, contratos estables y una futura capa de persistencia sin rehacer la arquitectura.

## Entidades principales

### `Workspace`
Tenant operativo de Leadflow. Delimita configuracion, equipos, funnels, sponsors, leads, visitantes y eventos.

### `Team`
Unidad operativa dentro de un workspace. Agrupa sponsors, funnels y pools de rotacion para segmentar ownership y reglas futuras.

### `Sponsor`
Destino principal de asignacion comercial. Representa a la persona o cuenta que puede recibir leads dentro de un team.

### `RotationPool`
Grupo de sponsors listo para rotacion. Define el contenedor donde luego vivira la estrategia de round-robin, weighted o manual.

### `Funnel`
Embudo operativo de captacion y avance comercial. Define stages base y defaults para team/pool.

### `Visitor`
Identidad previa al lead. Permite capturar trafico, fuente y trazabilidad antes de conversion.

### `Lead`
Prospecto identificado que entra al negocio. Puede nacer desde un visitor y relacionarse con funnel y asignaciones.

### `Assignment`
Registro de asignacion de un lead a un sponsor/team/pool. En v1 modela el contrato, no el motor avanzado.

### `Event`
Bitacora append-only de cambios relevantes sobre agregados del dominio para auditoria, timeline e integraciones futuras.

## Relaciones
- Un `Workspace` contiene muchos `teams`, `sponsors`, `rotation-pools`, `funnels`, `visitors`, `leads`, `assignments` y `events`.
- Un `Team` pertenece a un `Workspace` y agrupa varios `Sponsors`, `Funnels` y `RotationPools`.
- Un `Sponsor` pertenece a un `Workspace` y a un `Team`.
- Un `RotationPool` pertenece a un `Workspace` y a un `Team`, y referencia multiples `Sponsors` y opcionalmente `Funnels`.
- Un `Funnel` pertenece a un `Workspace` y puede definir `defaultTeamId` y `defaultRotationPoolId`.
- Un `Visitor` pertenece a un `Workspace` y puede convertirse en un `Lead`.
- Un `Lead` pertenece a un `Workspace`, vive en un `Funnel`, puede originarse desde un `Visitor` y puede tener un `currentAssignmentId`.
- Un `Assignment` pertenece a un `Workspace` y conecta `Lead`, `Sponsor`, `Team`, `Funnel` y opcionalmente `RotationPool`.
- Un `Event` pertenece a un `Workspace` y referencia el agregado afectado (`lead`, `assignment`, `visitor`, etc.).

## Que entra en MVP de dominio
- Agregados y contratos base para:
  - `workspaces`
  - `teams`
  - `sponsors`
  - `rotation-pools`
  - `funnels`
  - `visitors`
  - `leads`
  - `assignments`
  - `events`
- DTOs iniciales para creacion de agregados.
- Servicios NestJS con factories de entidades draft.
- Interfaces preparadas para repositorios futuros.
- Modulo agregador `DomainModule` en la API.

## Que queda para fases posteriores
- Persistencia real en PostgreSQL.
- Endpoints CRUD completos por agregado.
- Auth real y permisos por workspace/team.
- Motor de asignacion con reglas, prioridades, horarios y fallback.
- Integraciones con `n8n`, `Evolution API`, mensajeria y workers.
- Proyecciones, analytics y read models especializados.

## Decision de persistencia
En esta fase no se conecta PostgreSQL.

Propuesta para la siguiente fase:
- Mantener el dominio actual y agregar adapters de persistencia sobre interfaces `RepositoryPort`.
- Introducir PostgreSQL con un ORM tipado y migraciones.
- Opcion recomendada: `Prisma` como primer adapter por claridad de schema, tipado y ergonomia en NestJS.

Decision documentada:
- Primero estabilizar agregados, relaciones y contratos.
- Luego conectar persistencia sin mezclar diseño de dominio con detalles de infraestructura.
