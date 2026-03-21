# Member Operations v1

## Objetivo
Convertir la superficie `Sponsor / Member` en una capa operativa real para que el member pueda trabajar sus leads asignados, mantener su perfil visible y controlar si sigue recibiendo handoffs, sin abrir todavía un inbox ni integrar canales externos.

## Operaciones implementadas

### Leads asignados del member
El member puede:
- listar sus leads reales asignados
- filtrar por estado de lead
- filtrar por estado de assignment
- revisar un detalle básico del lead desde la UI
- mover el lead a:
  - `qualified`
  - `nurturing`
  - `won`
  - `lost`

Decisión de alcance:
- no se abrió un CRM completo
- no hay notas persistentes por lead
- no hay comentarios ni timeline conversacional

### Assignments del member
El member puede:
- listar sus assignments reales
- filtrar por estado
- aceptar un lead nuevo
- cerrar un assignment cuando ya no requiere seguimiento

Comportamiento asociado:
- aceptar un assignment puede mover el lead a `nurturing` si todavía estaba en `assigned`
- marcar un lead como `won` o `lost` cierra el assignment abierto actual del sponsor

### Perfil operativo del sponsor
El member puede editar sobre su sponsor asociado:
- `displayName`
- `email`
- `phone`
- `availabilityStatus`

Campos operativos en esta fase:
- nombre visible para reveal/handoff futuro
- email visible
- telefono visible
- disponibilidad:
  - `available`
  - `paused`
  - `offline`

### Dashboard del member
La superficie `/member` ahora muestra:
- resumen de leads asignados
- handoffs por aceptar
- seguimiento activo
- sponsor operativo actual
- acción rápida para aceptar leads
- toggle rápido de disponibilidad

## Relación member -> sponsor -> leads -> assignments
- `User(role=MEMBER)` se vincula a un `Sponsor` por `sponsorId`
- el `Sponsor` sigue siendo el actor operativo dueño de assignments dentro del team
- los `Lead` no guardan `sponsorId` directo; el vínculo del member se resuelve por `Assignment`
- el member opera solo sobre leads y assignments donde su sponsor participa

## Endpoints relevantes

### Sponsor / perfil operativo
- `GET /v1/sponsors/me`
- `PATCH /v1/sponsors/me`

### Leads del member
- `GET /v1/leads`
- `GET /v1/leads?status=...`
- `GET /v1/leads/:id`
- `PATCH /v1/leads/:id`

### Assignments del member
- `GET /v1/assignments`
- `GET /v1/assignments?status=...`
- `PATCH /v1/assignments/:id`

## UI conectada
La superficie `Member` queda operativa en:
- `/member`
- `/member/leads`
- `/member/profile`

Patrones usados:
- dashboard con KPIs reales
- tabla de leads con filtros básicos
- modal de detalle operativo
- formulario simple para perfil
- feedback de éxito y error

## Persistencia
En esta fase no fue necesaria una migración nueva.

Motivo:
- `Sponsor` ya tenía campos suficientes para disponibilidad y datos visibles
- `Lead` ya tenía estados operativos básicos
- `Assignment` ya tenía estados mínimos para aceptación y cierre

## Seed
No fue necesario ampliar el seed.

El seed actual ya deja listo:
- members autenticables
- sponsors reales vinculados a esos members
- leads asignados
- assignments para validar aceptación y seguimiento

## Fuera de alcance intencional
- WhatsApp real
- Evolution API
- n8n
- inbox conversacional
- notas persistentes por lead
- reveals avanzados o handoff enriquecido
- invites
- permisos finos por recurso
- preferencias avanzadas de perfil más allá del sponsor operativo
