# Messaging Automation / n8n v1

## Objetivo

Esta fase agrega el primer bridge real entre Leadflow y n8n.

El objetivo no es automatizar toda la conversacion ni construir un inbox, sino despachar un payload estructurado y persistido cuando el sistema ya logro asignar un sponsor/member real a un lead.

## Que automatiza v1

- construccion de un payload consistente desde el contexto operativo real
- despacho HTTP hacia un webhook configurable de n8n
- persistencia del intento de envio
- visibilidad basica del readiness y de los ultimos dispatches en `/member/channel`
- compatibilidad total con el handoff actual por `wa.me`

## Que queda fuera intencionalmente

- inbox conversacional
- lectura bidireccional de mensajes
- workflows complejos de n8n
- respuestas automaticas avanzadas
- reintentos asincronos con colas
- webhooks entrantes desde n8n o Evolution para sincronizacion en tiempo real

## Trigger v1

El trigger elegido para v1 es:

- cuando se crea una `Assignment` nueva desde el runtime publico

Esto cubre los dos caminos operativos actuales:

- `public_submission_assignment_created`
- `public_auto_assignment_created`

El dispatch ocurre despues de que la transaccion principal termina correctamente.

Eso significa:

- no bloquea la captura publica
- no rompe Reveal & Handoff
- si el webhook falla, el funnel sigue funcionando
- el resultado queda persistido como `AutomationDispatch`

## Relacion con Evolution y Reveal/Handoff

- `MessagingConnection` sigue siendo la fuente de verdad del canal del sponsor
- Evolution API sigue resolviendo el lifecycle real del canal y su `instanceId`
- Reveal & Handoff sigue usando `wa.me` como fallback comercial
- el bridge de automation reutiliza el `instanceId`, el estado del canal y el telefono normalizado cuando existen

En otras palabras:

- si el sponsor no tiene canal conectado, el funnel sigue operativo y el dispatch puede quedar `skipped`
- si el sponsor si tiene canal conectado y hay webhook disponible, Leadflow puede despachar el contexto completo hacia n8n

## Modelo de persistencia

Se agrega `AutomationDispatch`.

Campos clave:

- `status`
- `triggerType`
- `targetWebhookUrl`
- `payloadSnapshot`
- `responseSnapshot`
- `responseStatusCode`
- `errorCode`
- `errorMessage`
- `queuedAt`
- `dispatchedAt`
- `completedAt`

Relaciones principales:

- `Workspace`
- `Team`
- `Sponsor`
- `Lead`
- `Assignment`
- `FunnelInstance`
- `FunnelPublication`
- `MessagingConnection`

## Estados del dispatch

- `pending`: el dispatch fue creado y encolado logicamente
- `skipped`: no habia readiness suficiente para enviarlo
- `dispatched`: n8n respondio satisfactoriamente
- `failed`: hubo error HTTP, timeout o respuesta no satisfactoria

## Payload recomendado v1

Shape de alto nivel:

```json
{
  "version": "leadflow.messaging-automation.v1",
  "dispatch": {
    "id": "uuid",
    "triggerType": "public_submission_assignment_created",
    "queuedAt": "2026-03-21T23:00:00.000Z",
    "targetWebhookUrl": "https://n8n.example/webhook/leadflow/instance-id"
  },
  "workspace": {},
  "team": {},
  "sponsor": {},
  "messagingConnection": {},
  "lead": {},
  "assignment": {},
  "funnel": {
    "legacy": {},
    "instance": {},
    "publication": {}
  },
  "handoff": {},
  "tracking": {}
}
```

Bloques incluidos en v1:

- `workspace`: contexto del workspace
- `team`: contexto del team operativo
- `sponsor`: sponsor asignado y datos visibles
- `messagingConnection`: `instanceId`, estado, proveedor y readiness
- `lead`: lead, visitor y contexto de contacto
- `assignment`: datos de asignacion
- `funnel`: contexto legacy, instance y publication
- `handoff`: modo efectivo, CTA y URL de WhatsApp resultante
- `tracking`: `anonymousId`, `visitorId`, UTM y contexto de step si existe

## Resolucion del webhook

Leadflow resuelve el target en este orden:

1. `messagingConnection.automationWebhookUrl`
2. `MESSAGING_AUTOMATION_WEBHOOK_BASE_URL` + `/{instanceId}`

Si no hay target resoluble, el dispatch queda `skipped`.

## Variables de entorno

- `MESSAGING_AUTOMATION_WEBHOOK_BASE_URL`
- `MESSAGING_AUTOMATION_WEBHOOK_TOKEN`
- `MESSAGING_AUTOMATION_DISPATCH_TIMEOUT_MS`
- `MESSAGING_AUTOMATION_DISPATCH_RETRIES`

Compatibilidad:

- se reutiliza `MESSAGING_AUTOMATION_WEBHOOK_BASE_URL` ya existente
- no se hardcodean secretos
- el token es opcional

## Comportamiento ante fallos

- si no hay `MessagingConnection` conectada: `skipped`
- si `automationEnabled` esta apagado: `skipped`
- si falta target webhook: `skipped`
- si n8n devuelve error o timeout: `failed`
- si n8n responde `2xx`: `dispatched`

Tambien se registran `DomainEvent` de auditoria:

- `automation_dispatch_queued`
- `automation_dispatch_skipped`
- `automation_dispatch_dispatched`
- `automation_dispatch_failed`

## UI minima en member

`/member/channel` muestra:

- readiness del bridge
- webhook target resuelto
- nota explicativa si el bridge esta bloqueado
- ultimos dispatches persistidos

Esto permite que el member vea rapidamente si su canal esta listo para automatizacion, sin abrir aun una UI de operaciones compleja.

## Preparacion para fases siguientes

Esta fase deja lista la base para:

- n8n workflows v1
- reintentos asincronos mas robustos
- webhooks entrantes de sincronizacion
- acciones automatizadas posteriores al handoff
- eventual inbox o timeline de mensajes
