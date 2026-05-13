# Tracking Events v1

Fecha: 2026-03-21 (UTC)

Actualizacion: 2026-05-13 (UTC)

## Objetivo
Implementar una capa interna de tracking para el runtime publico de Leadflow que registre eventos de funnel, step e hitos operativos en una estructura persistente y reutilizable.

Desde la actualizacion 2026-05-13, el tracking interno convive con un dispatch server-side limitado para conversiones Lead en Meta CAPI y TikTok Events API cuando la captura viene de trafico pagado elegible.

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

### Eventos enviados a proveedores externos
- Meta CAPI: `Lead`
- TikTok Events API: `SubmitForm`

Estos eventos no se persisten como `DomainEvent` adicional por ahora. Se disparan como side effect desde `CapiManagerService` despues de la transaccion de captura.

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
- `trafficLayer`
- `originAdWheelId`
- click ids (`fbclid`, `gclid`, `ttclid`) cuando corresponden

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
En esta fase mixta:

- el dispatch CAPI actual no depende todavia de `ConversionEventMapping`;
- el submit usa credenciales de pixel disponibles en la publicacion efectiva;
- si existe `TrackingProfile`, el contexto sigue disponible en el payload de eventos internos;
- `ConversionEventMapping` queda como base para mapear mas eventos o proveedores en una fase posterior.

## Guardrails de CAPI

`CapiManagerService` evita enviar conversiones cuando:

- `trafficLayer` es `ORGANIC` o `DIRECT`;
- la ruta no coincide con una campana (`/promo/*`, `/p/*`) ni con evidencia pagada aceptada;
- Meta no tiene `fbclid`, pixel id, token o user data suficiente;
- TikTok no tiene `ttclid`, pixel id, token, IP, user agent o identidad hashable.

Datos de usuario enviados:

- email y telefono normalizados con SHA-256 cuando existen;
- IP y user agent desde payload o headers;
- `event_source_url` desde `sourceUrl` o desde `domainHost + requestedPath`;
- `event_id` derivado de `submissionEventId` cuando esta disponible.

Los errores de proveedor se registran como `CAPI_ERROR` y no bloquean el submit.

## Integridad de `assignmentId`

Antes de crear un `DomainEvent`, `TrackingEventsService` valida que `assignmentId` exista.

- Si no existe, registra warning y crea el evento sin relacion de assignment.
- Si Prisma devuelve `P2003` por una relacion invalida, reintenta una vez sin `assignmentId`.

Esto evita que un evento browser/server pierda toda la escritura por cargar un assignment obsoleto.

## Limitaciones intencionales de v1
- no hay envio browser-side real a Meta Pixel
- no hay mapeo declarativo por `ConversionEventMapping` para todos los eventos
- no hay dashboards analiticos
- no hay deduplicacion hard entre browser/server
- no hay retries ni colas persistentes de dispatch CAPI
- no hay agregaciones ni reporting
- no hay confirmacion real de handoff por WhatsApp

## Que queda listo para Meta/TikTok despues
- taxonomia de eventos consistente
- `eventId` persistido
- correlacion entre eventos browser y server
- contexto de funnel/publicacion/step en cada evento
- acceso a `TrackingProfile` y `ConversionEventMapping` desde el modelo
- base CAPI validada para extender eventos, retries y mapeos

## Validacion manual recomendada
1. Resolver un funnel publicado seed.
2. Abrir la landing y confirmar eventos `funnel_viewed` y `step_viewed`.
3. Enfocar el formulario y confirmar `form_started`.
4. Enviar el formulario y confirmar `form_submitted`.
5. Verificar `lead_created`, `assignment_created` y `handoff_started`.
6. Entrar al thank-you y confirmar `handoff_completed`.
