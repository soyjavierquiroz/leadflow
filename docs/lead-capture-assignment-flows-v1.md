# Lead Capture & Assignment Flows v1

Fecha: 2026-03-21 (UTC)

Actualizacion: 2026-05-13 (UTC)

## Objetivo
Conectar el runtime publico de Leadflow con un flujo minimo real de captura y asignacion para pasar de visitante anonimo a `Lead` asignado, usando `FunnelPublication` y `FunnelInstance` como contexto operativo principal.

## Flujo implementado
1. El runtime publico resuelve `host + path` hacia una `FunnelPublication` activa.
2. El bloque `form_placeholder` del step actual captura datos basicos del visitante.
3. La web genera o reutiliza un `anonymousId` local por publicacion.
4. La API registra o actualiza `Visitor`.
5. La API crea o actualiza `Lead` para ese visitor en el contexto de la publicacion.
6. La API resuelve atribucion operativa desde `entryContext`, `sourceUrl`, UTMs, click ids y path publico.
7. Si el path corresponde a campana (`/promo/*` o `/p/*`) y existe una `AdWheel` activa para la publicacion, la asignacion usa el ciclo pagado `PAID_WHEEL`.
8. Si hay evidencia pagada sin rueda activa, el lead se marca como `PAID_ADS` y cae al fallback operativo del team.
9. Si no hay evidencia pagada, el lead se normaliza como `ORGANIC` o `DIRECT` segun corresponda.
10. La API crea `Assignment`.
11. La API registra `DomainEvent` para visitor, lead y assignment.
12. La API dispara side effects CAPI para leads pagados elegibles.
13. La web guarda el contexto del submit en la sesion y navega al siguiente step si existe.

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

## Estrategia de assignment pagado

El flujo publico distingue cuatro capas de trafico:

- `DIRECT`: rutas de referencia directa como `/ref/*`.
- `PAID_WHEEL`: rutas de campana con rueda activa.
- `PAID_ADS`: evidencia de anuncio sin rueda activa.
- `ORGANIC`: trafico sin evidencia pagada ni sponsor forzado.

Para `PAID_WHEEL`:

- el runtime busca una `AdWheel` activa para `teamId + publicationId`;
- valida que `startDate <= now <= endDate`;
- usa `AdWheelTurn` y `currentTurnPosition` como ciclo transaccional;
- persiste `Lead.trafficLayer = PAID_WHEEL` y `Lead.originAdWheelId` solo si la rueda existe;
- si el mismo `anonymousId` ya tiene una asignacion abierta en la rueda, el flujo cae a fallback directo para evitar duplicar turnos.

Para `PAID_ADS`:

- se activa si hay `fbclid`, `ttclid`, `gclid` o `utm_source=ads`;
- no se asigna `originAdWheelId`;
- se conserva `trafficLayer = PAID_ADS` para auditoria y CAPI;
- la asignacion usa fallback de team admin disponible.

Si llega un `originAdWheelId` obsoleto o inexistente, la API lo descarta antes de persistir y registra `WHEEL_DEBUG`.

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
- `handoff`
- `advisor`
- `assigned_advisor`

Esto permite que la web:
- avance al siguiente step sin recalcular navegacion
- conserve el sponsor asignado en la sesion
- renderice un thank-you simple con contexto operativo
- construir CTA de WhatsApp desde el sponsor realmente asignado

## Side effects posteriores al submit

Despues de cerrar la transaccion, `LeadCaptureAssignmentService` llama a `CapiManagerService` para conversiones server-side:

- Meta CAPI recibe evento `Lead` solo si hay `fbclid`, pixel id, token y datos de usuario suficientes.
- TikTok Events API recibe `SubmitForm` solo si hay `ttclid`, pixel id, token, IP, user agent e identidad hashable.
- El dispatch se omite para trafico `ORGANIC` o rutas no compatibles con campana para evitar contaminar pixeles.
- Los errores de CAPI se registran como `CAPI_ERROR` y no rompen la captura ni la asignacion.

La API enriquece `clientIpAddress` y `clientUserAgent` desde headers (`cf-connecting-ip`, `x-forwarded-for`, `x-real-ip`, `user-agent`) cuando el payload no los envia.

## Notificaciones por email

`Workspace.emailNotificationsEnabled` controla si se envia el email de asignacion al asesor:

- default: `true`;
- si esta en `false`, la API omite el envio, registra `MAIL_SILENCED` y mantiene intacto el flujo de captura;
- el toggle se gestiona desde la superficie de system tenants.

## Limitaciones intencionales
- no hay auth real
- no hay sticky assignment
- no hay antifraude complejo
- no hay deduplicacion avanzada browser/server
- no hay filtros por pais o reglas avanzadas
- el handoff publico sigue basado en `wa.me`, sin confirmacion de entrega
- la integracion Meta/TikTok cubre CAPI server-side de conversion Lead, no pixel browser completo
- no hay n8n ni Evolution API

## Cambios de persistencia
Actualizacion 2026-05-13:

- `Workspace.emailNotificationsEnabled Boolean @default(true)`.
- Migracion: `apps/api/prisma/migrations/20260507110000_workspace_email_notifications_toggle/migration.sql`.

El resto del flujo reutiliza modelos ya existentes: `Visitor`, `Lead`, `Assignment`, `AdWheel`, `AdWheelTurn`, `FunnelInstance`, `FunnelPublication` y `DomainEvent`.

## Seed de desarrollo
El seed se actualizo para reflejar esta fase:
- copy del funnel orientado a captura real
- formulario MVP listo para probar submit
- thank-you con reveal simple del sponsor asignado en sesion

## Que queda listo para la siguiente fase
- reglas avanzadas de routing
- deduplicacion y antifraude
- auth y permisos para vistas operativas
- cola/retry formal para CAPI y proveedores externos
