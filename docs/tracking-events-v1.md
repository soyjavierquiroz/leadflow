# Tracking Events v1

Fecha: 2026-03-21 (UTC)

## Objetivo
Implementar una capa interna de tracking para el runtime publico de Leadflow que registre eventos de funnel, step e hitos operativos en una estructura persistente y reutilizable, sin hacer todavia dispatch real a Meta o TikTok.

## Eventos implementados

### Eventos emitidos desde web
- `funnel_viewed`
- `step_viewed`
- `form_started`
- `form_submitted`
- `cta_clicked`
- `handoff_completed`

### Eventos emitidos desde API
- `lead_created`
- `assignment_created`
- `assignment_failed`
- `handoff_started`

### Eventos de dominio previos que se mantienen
- `visitor_registered`
- `visitor_seen`
- `lead_captured`
- `lead_updated`
- `lead_assigned`

## Que se registra desde web
La web registra eventos de comportamiento del runtime:
- carga inicial del funnel publicado
- carga del step actual
- primer inicio de interaccion con el formulario
- submit del formulario
- clicks de CTA internos o externos
- entrada al thank-you con assignment ya disponible en sesion

Estos eventos llegan por:
- `POST /v1/public/funnel-runtime/events`

## Que se registra desde API
La API registra eventos operativos del flujo de captura/asignacion:
- creacion real del lead
- creacion real del assignment
- error de assignment cuando no hay pool o sponsor elegible
- inicio del handoff operativo cuando el lead queda asignado

Estos eventos se persisten desde el propio flujo de `LeadCaptureAssignmentService` usando una utilidad comun de tracking.

## Estructura persistida
Se reutiliza `DomainEvent` como base comun de tracking.

Campos relevantes ahora disponibles:
- `eventId`
- `eventName`
- `aggregateType`
- `aggregateId`
- `workspaceId`
- `funnelInstanceId`
- `funnelPublicationId`
- `funnelStepId`
- `visitorId`
- `leadId`
- `assignmentId`
- `payload`
- `occurredAt`

## Estructura del payload
El payload se normaliza con una forma pragmatica para v1.

Campos frecuentes:
- `source`: `browser` o `server`
- `anonymousId`
- `host`
- `path`
- `referrer`
- `publication`
- `funnel`
- `step`
- `trackingProfileId`
- `handoffStrategyId`
- `cta`
- `metadata`
- `triggerEventId` para correlacion entre submit browser y evento server posterior

## Uso de `eventId`
`eventId` ya forma parte del modelo persistido.

Estrategia v1:
- los eventos browser generan `eventId` en el cliente
- los eventos server generan `eventId` en la API cuando no reciben uno
- el submit del formulario genera un `submissionEventId`
- la API puede reutilizar ese identificador como referencia de origen (`triggerEventId`) para correlacionar eventos operativos posteriores

Decision importante:
- en v1 no se fuerza deduplicacion real
- `eventId` queda preparado para futura reconciliacion browser/server y para dispatch a terceros
- los eventos historicos previos a esta fase recibieron `eventId = id` durante la migracion

## Endpoints implementados
- `POST /v1/public/funnel-runtime/events`
- `GET /v1/events`
- `GET /v1/events?leadId=...`
- `GET /v1/events?funnelPublicationId=...`

## Relacion con TrackingProfile y ConversionEventMapping
En esta fase:
- no hay dispatch real
- no se llama a Meta ni TikTok
- si existe `TrackingProfile`, el contexto queda disponible en el payload
- `ConversionEventMapping` sigue listo para fases posteriores

## Limitaciones intencionales de v1
- no hay envio real a Meta Pixel
- no hay envio real a TikTok Events
- no hay dashboards analiticos
- no hay deduplicacion hard entre browser/server
- no hay retries ni colas de dispatch
- no hay agregaciones ni reporting
- no hay handoff real a WhatsApp

## Que queda listo para Meta/TikTok despues
- taxonomia de eventos consistente
- `eventId` persistido
- correlacion entre eventos browser y server
- contexto de funnel/publicacion/step en cada evento
- acceso a `TrackingProfile` y `ConversionEventMapping` desde el modelo

## Validacion manual recomendada
1. Resolver un funnel publicado seed.
2. Abrir la landing y confirmar eventos `funnel_viewed` y `step_viewed`.
3. Enfocar el formulario y confirmar `form_started`.
4. Enviar el formulario y confirmar `form_submitted`.
5. Verificar `lead_created`, `assignment_created` y `handoff_started`.
6. Entrar al thank-you y confirmar `handoff_completed`.
