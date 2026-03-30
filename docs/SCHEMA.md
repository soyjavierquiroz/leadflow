# Leadflow Schema Notes

Auditoria y mapeo de relaciones del flujo Funnel -> Pool -> Sponsor -> Lead -> Assignment.

## 1. Source of truth de la rueda

La asignacion publica no sale del JSON del frontend. Sale de la base de datos.

Orden de resolucion real:

1. `FunnelPublication` resuelve la publicacion activa por `host + pathPrefix`.
2. Esa publicacion apunta a un `FunnelInstance`.
3. El submit usa `FunnelInstance.rotationPoolId` como source of truth principal.
4. Si `FunnelInstance.rotationPoolId` es `null`, el backend usa el fallback legacy `Funnel.defaultRotationPoolId`.

Conclusion operativa:

- El ID de `Primary Sales Pool` del dashboard si es el ID correcto para configurar la rueda.
- Pero no debe viajar en el JSON publico del frontend.
- Debe persistirse en backend, principalmente en `FunnelInstance.rotationPoolId`.

## 2. Relacion entre tablas

### Diagrama conceptual

```text
Domain
  -> FunnelPublication
      -> FunnelInstance
          -> RotationPool
              -> RotationMember
                  -> Sponsor

Visitor
  -> Lead
      -> Assignment
          -> Sponsor
          -> RotationPool
          -> FunnelPublication
          -> FunnelInstance
```

### Tablas clave

#### Funnel

Archivo: `apps/api/prisma/schema.prisma`

Campos relevantes:

- `id`
- `defaultTeamId`
- `defaultRotationPoolId`

Uso real:

- Fallback legacy cuando el `FunnelInstance` no tiene pool propio.

#### FunnelInstance

Campos relevantes:

- `id`
- `teamId`
- `legacyFunnelId`
- `rotationPoolId`
- `trackingProfileId`
- `handoffStrategyId`

Uso real:

- Es la relacion principal entre un funnel operativo y su pool de rotacion.

#### FunnelPublication

Campos relevantes:

- `id`
- `domainId`
- `funnelInstanceId`
- `pathPrefix`
- `handoffStrategyId`

Uso real:

- Expone un funnel instance en un dominio/path publico.
- No guarda `rotationPoolId`.

#### RotationPool

Campos relevantes:

- `id`
- `teamId`
- `name`
- `strategy`
- `isFallbackPool`

Uso real:

- Contenedor de asesores elegibles.
- Tiene miembros via `RotationMember[]`.

#### RotationMember

Campos relevantes:

- `rotationPoolId`
- `sponsorId`
- `position`
- `weight`
- `isActive`

Uso real:

- Define el orden de la rueda.
- El algoritmo actual usa `position` para round-robin.
- `weight` hoy existe pero no participa en el algoritmo publico actual.

#### Sponsor

Campos relevantes:

- `id`
- `teamId`
- `displayName`
- `status`
- `phone`
- `availabilityStatus`
- `routingWeight`

Uso real:

- Asesor asignable en la rueda.
- Solo entran sponsors con:
  - `status = active`
  - `availabilityStatus = available`
  - `RotationMember.isActive = true`

#### Lead

Campos relevantes:

- `visitorId`
- `funnelId`
- `funnelInstanceId`
- `funnelPublicationId`
- `currentAssignmentId`
- `status`

Uso real:

- Lead persistido tras el submit.
- Puede reusarse si ya existia para ese `visitorId`.

#### Assignment

Campos relevantes:

- `leadId`
- `sponsorId`
- `teamId`
- `funnelId`
- `funnelInstanceId`
- `funnelPublicationId`
- `rotationPoolId`
- `status`
- `reason`
- `assignedAt`

Uso real:

- Evidencia final de a quien se entrego el lead.
- El round-robin mira el ultimo `Assignment` de ese pool por `assignedAt`.

## 3. Algoritmo actual de rotacion

Fuente:

- `apps/api/src/modules/public-funnel-runtime/lead-capture-assignment.service.ts`
- `apps/api/src/modules/public-funnel-runtime/lead-capture-assignment.utils.ts`

### Reglas

1. El backend busca `rotationPool.members` activos, ordenados por `position ASC`.
2. Busca el ultimo `Assignment` del pool por `assignedAt DESC`.
3. Si no hay ultimo assignment, toma el primer miembro.
4. Si hay ultimo assignment, toma el siguiente sponsor en la lista.
5. Si llega al final, vuelve al inicio.

### Pseudocodigo

```text
eligibleMembers = members ordered by position asc
lastAssignment = latest assignment by assignedAt desc for rotationPoolId

if no lastAssignment:
  next = eligibleMembers[0]
else:
  next = member after lastAssignment.sponsorId, circular
```

### Consecuencias

- Hoy la rueda publica es `round_robin` puro.
- `weight` todavia no afecta la seleccion.
- Si un sponsor sale de `available`, queda fuera de la rueda automaticamente.

## 4. Tabla puente real entre funnel y pool

No hay una tabla puente N:N entre `FunnelPublication` y `RotationPool`.

La vinculacion real es:

- `FunnelInstance.rotationPoolId` -> `RotationPool.id`

Y el fallback legacy es:

- `Funnel.defaultRotationPoolId` -> `RotationPool.id`

Por eso:

- `FunnelPublication` hereda el pool a traves del `FunnelInstance`.
- El dashboard de funnels es la superficie correcta para setear el pool.

## 5. Superficies de operacion actuales

### Donde se configura el pool hoy

Backend:

- `POST /v1/funnel-instances`
- `PATCH /v1/funnel-instances/:id`

UI:

- `apps/web/components/team-operations/team-funnels-client.tsx`

### Donde se operan miembros de la rueda hoy

Backend:

- `GET /v1/rotation-pools`
- `GET /v1/rotation-pools/members`
- `PATCH /v1/rotation-pools/members/:memberId`

UI:

- `apps/web/app/(team)/team/pools/page.tsx`

### Gap actual

No existe API publica/admin para:

- crear sponsor nuevo
- crear rotation member nuevo
- crear pool nuevo desde la UI actual

Ese gap explica por que la guia de emergencia debe incluir Prisma/SQL directo.

## 6. Datos del advisor devueltos al frontend

El advisor visible no sale de una tabla dedicada. Sale del sponsor asignado.

Mapeo actual:

- `advisor.name` <- `Sponsor.displayName`
- `advisor.phone` <- `Sponsor.phone`
- `advisor.whatsappUrl` <- construido con `Sponsor.phone` + plantilla del handoff
- `advisor.photoUrl` <- `null` hoy
- `advisor.bio` <- texto hardcodeado hoy

Implicacion:

- Si el frontend necesita foto real o bio editable, hace falta extender el schema de `Sponsor`.
