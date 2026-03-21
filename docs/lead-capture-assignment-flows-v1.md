# Lead Capture & Assignment Flows v1

Fecha: 2026-03-21 (UTC)

## Objetivo
Conectar el runtime publico de Leadflow con un flujo minimo real de captura y asignacion para pasar de visitante anonimo a `Lead` asignado, usando `FunnelPublication` y `FunnelInstance` como contexto operativo principal.

## Flujo implementado
1. El runtime publico resuelve `host + path` hacia una `FunnelPublication` activa.
2. El bloque `form_placeholder` del step actual captura datos basicos del visitante.
3. La web genera o reutiliza un `anonymousId` local por publicacion.
4. La API registra o actualiza `Visitor`.
5. La API crea o actualiza `Lead` para ese visitor en el contexto de la publicacion.
6. La API busca el `RotationPool` operativo del funnel.
7. La API elige el siguiente sponsor elegible con round robin simple.
8. La API crea `Assignment`.
9. La API registra `DomainEvent` para visitor, lead y assignment.
10. La web guarda el contexto del submit en la sesion y navega al siguiente step si existe.

## Casos de uso minimos implementados
- `registerVisitor`
- `captureLead`
- `assignLeadToNextSponsor`
- `resolveNextStepAfterCapture`
- `listAssignments`
- `listLeadsBySponsor`
- `listLeadsByPublication`
- `submitLeadCapture` como flujo publico compuesto

## Estrategia de assignment v1
- El contexto principal es `FunnelPublication` y su `FunnelInstance`.
- El pool operativo se resuelve desde `FunnelInstance.rotationPoolId`.
- Si no existe ese enlace, se usa como fallback el `Funnel` legacy enlazado.
- Solo participan `RotationMember` activos cuyo `Sponsor` este:
  - `status = active`
  - `availabilityStatus = available`
- El round robin usa la ultima asignacion del pool para elegir el siguiente sponsor.
- Si ya existe una asignacion abierta para el lead, se reutiliza en lugar de duplicarla.

## Endpoints publicos implementados
- `POST /v1/public/funnel-runtime/visitors`
- `POST /v1/public/funnel-runtime/leads`
- `POST /v1/public/funnel-runtime/assignments/auto`
- `POST /v1/public/funnel-runtime/submissions`

## Endpoints de lectura para validacion operativa
- `GET /v1/leads`
- `GET /v1/leads?sponsorId=...`
- `GET /v1/leads?funnelPublicationId=...`
- `GET /v1/assignments`
- `GET /v1/assignments?sponsorId=...`
- `GET /v1/assignments?funnelPublicationId=...`

## Eventos de dominio registrados
- `visitor_registered`
- `visitor_seen`
- `lead_captured`
- `lead_updated`
- `lead_assigned`
- `assignment_created`

## Respuesta del submit publico
El endpoint compuesto devuelve:
- `visitor`
- `lead`
- `assignment`
- `nextStep`

Esto permite que la web:
- avance al siguiente step sin recalcular navegacion
- conserve el sponsor asignado en la sesion
- renderice un thank-you simple con contexto operativo

## Limitaciones intencionales
- no hay auth real
- no hay sticky assignment
- no hay antifraude complejo
- no hay deduplicacion avanzada browser/server
- no hay filtros por pais o reglas avanzadas
- no hay handoff real a WhatsApp
- no hay integracion real con Meta/TikTok
- no hay n8n ni Evolution API

## Cambios de persistencia
En esta fase no hizo falta una migracion nueva de Prisma.

Motivo:
- el modelo implementado en expansion v2 ya incluia `Visitor`, `Lead`, `Assignment`, `RotationPool`, `RotationMember`, `FunnelInstance` y `FunnelPublication`
- `Lead` y `Assignment` ya podian referenciar `funnelInstanceId` y `funnelPublicationId`
- `DomainEvent` ya podia registrar payload JSON para auditoria operativa

## Seed de desarrollo
El seed se actualizo para reflejar esta fase:
- copy del funnel orientado a captura real
- formulario MVP listo para probar submit
- thank-you con reveal simple del sponsor asignado en sesion

## Que queda listo para la siguiente fase
- handoff real posterior al assignment
- tracking operativo del submit y de la conversion
- reglas avanzadas de routing
- deduplicacion y antifraude
- auth y permisos para vistas operativas
