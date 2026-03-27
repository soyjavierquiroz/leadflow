# Team Operations v1

## Objetivo
Habilitar operaciones reales para `Team Admin` sobre los activos operativos del team sin abrir edición estructural de templates ni del JSON libre de funnels.

Esta fase convierte la superficie `/team/*` en una capa utilizable para la operación diaria:
- crear funnel instances desde templates aprobados
- crear y activar publicaciones por `host + path`
- pausar o reactivar sponsors
- ajustar disponibilidad operativa
- revisar pools y mover miembros
- consultar leads del team con filtros básicos

## Operaciones implementadas

### Funnel Instance
El team admin puede:
- listar funnels del team
- crear una nueva instancia desde un `FunnelTemplate` aprobado
- editar metadatos operativos:
  - `name`
  - `code`
  - `rotationPoolId`
  - `trackingProfileId`
  - `handoffStrategyId`
- activar o devolver a draft operativo

Decision importante:
- al crear una `FunnelInstance` nueva, el sistema crea tambien el `Funnel` legacy puente para no romper `Lead Capture & Assignment Flows v1` ni el runtime publico actual.

### Funnel Publication
El team admin puede:
- listar publicaciones del team
- crear una nueva publicacion
- editar:
  - `domainId`
  - `funnelInstanceId`
  - `pathPrefix`
  - `trackingProfileId`
  - `handoffStrategyId`
  - `isPrimary`
- activar o devolver a draft

Validaciones implementadas:
- conflicto de `host + path`
- el dominio debe pertenecer al team
- el funnel instance debe pertenecer al team
- una publicacion activa exige:
  - dominio activo
  - funnel instance activo

### Domain
El team admin puede:
- listar dominios del team
- crear dominios nuevos
- editar metadata operativa segura
- refrescar onboarding
- recrear onboarding cuando existe configuracion heredada o inconsistente
- eliminar dominios y sus publicaciones asociadas por cascada

Nota de UX operativa:
- la mutacion de crear dominio en `/team/domains` se ejecuta desde cliente con `fetch` directo al API y loading state explicito del modal
- no usa `startTransition` para envolver el request async de creacion
- esto evita congelar la UI antes de que salga la peticion HTTP

### Sponsor
El team admin puede:
- listar sponsors del team
- activar o pausar sponsors
- actualizar `availabilityStatus`:
  - `available`
  - `paused`
  - `offline`

### Rotation Pool / Rotation Member
El team admin puede:
- listar pools del team
- listar miembros de pool
- activar o pausar miembros de pool
- reordenar posiciones simples dentro del pool

### Lead
El team admin puede:
- listar leads scopeados al team
- usar filtros básicos en UI por texto y estado

## Que puede editar el team admin
- `FunnelInstance` operativa del team
- `FunnelPublication`
- `RotationPool` a nivel de miembros y orden
- estado operativo y disponibilidad de sponsors
- seleccion de:
  - template al crear instancia
  - tracking profile asociado
  - handoff strategy asociada
  - rotation pool asociado
  - dominio y path de publicacion

## Que no puede editar el team admin
- `FunnelTemplate`
- `blocks_json`
- `FunnelStep` estructural
- JSON libre de estructura del funnel
- libreria de bloques
- tracking mappings globales
- reglas core del runtime
- invites
- permisos finos por recurso

## Endpoints relevantes

### Nuevos o ampliados para Team Operations
- `POST /v1/domains`
- `PATCH /v1/domains/:id`
- `DELETE /v1/domains/:id`
- `POST /v1/domains/:id/refresh`
- `POST /v1/domains/:id/recreate-onboarding`
- `GET /v1/tracking-profiles`
- `GET /v1/handoff-strategies`
- `POST /v1/funnel-instances`
- `PATCH /v1/funnel-instances/:id`
- `POST /v1/funnel-publications`
- `PATCH /v1/funnel-publications/:id`
- `PATCH /v1/sponsors/:id`
- `GET /v1/rotation-pools/members`
- `PATCH /v1/rotation-pools/members/:memberId`

### Lecturas ya usadas por la superficie
- `GET /v1/funnel-instances`
- `GET /v1/funnel-publications`
- `GET /v1/domains`
- `GET /v1/sponsors`
- `GET /v1/rotation-pools`
- `GET /v1/leads`

## UI conectada
La superficie `Team Admin` queda operativa en:
- `/team/funnels`
- `/team/publications`
- `/team/sponsors`
- `/team/pools`
- `/team/leads`

Patrones UI usados:
- modales simples
- formularios mínimos
- feedback de success/error
- acciones inline para activar, pausar o editar

## Persistencia
En esta fase no fue necesaria una migracion nueva.

El modelo actual ya soportaba la operacion requerida gracias a:
- `FunnelInstance`
- `FunnelPublication`
- `Sponsor`
- `RotationPool`
- `RotationMember`
- `TrackingProfile`
- `HandoffStrategy`

## Seed
No fue necesario ampliar el seed para cerrar esta fase.

El seed actual ya deja disponible:
- 1 team admin autenticable
- 1 template activo
- 1 funnel instance operativa
- 2 publications
- 2 sponsors
- 1 rotation pool con miembros
- leads y assignments para validar la operacion basica

## Fuera de alcance intencional
- invites
- gestion avanzada de usuarios
- permisos finos por recurso
- editor visual
- template builder
- edicion libre de steps o bloques
- WhatsApp, n8n o Evolution
- acciones avanzadas sobre leads como reassignment manual complejo o CRM completo
