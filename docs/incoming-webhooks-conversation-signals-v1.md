# Incoming Webhooks / Conversation Signals v1

## Objetivo

Esta fase agrega la primera capa real de entrada para que Leadflow reciba señales desde n8n o Evolution, las persista y actualice el estado operativo de leads y assignments sin abrir todavía un inbox conversacional.

## Señales soportadas en v1

- `conversation_started`
- `message_inbound`
- `message_outbound`
- `lead_contacted`
- `lead_qualified`
- `lead_follow_up`
- `lead_won`
- `lead_lost`

## Autenticación del webhook

La entrada se protege con `INCOMING_MESSAGING_WEBHOOK_SECRET`.

Headers soportados:

- `x-leadflow-webhook-secret`
- `x-api-key`
- `Authorization: Bearer <secret>`

Si el secret no existe o no coincide:

- Leadflow rechaza el webhook
- no procesa la señal

## Endpoint v1

- `POST /v1/incoming-webhooks/messaging`

Visibilidad operativa:

- `GET /v1/incoming-webhooks/messaging/signals?leadId=...`

Esta ruta de lectura sirve para mostrar una timeline resumida en `member` y `team`, sin montar un inbox.

## Modelo nuevo

Se agrega `ConversationSignal`.

Campos clave:

- `source`
- `signalType`
- `processingStatus`
- `externalEventId`
- `payloadSnapshot`
- `errorCode`
- `errorMessage`
- `leadStatusAfter`
- `assignmentStatusAfter`
- `occurredAt`
- `processedAt`

Relaciones útiles:

- `Workspace`
- `Team`
- `Sponsor`
- `Lead`
- `Assignment`
- `MessagingConnection`
- `AutomationDispatch`

## Qué entidades actualiza

Según la señal recibida, v1 puede actualizar:

- `Lead.status`
- `Assignment.status`
- `Assignment.resolvedAt`

También registra `DomainEvent` de auditoría usando el nombre de la señal como `eventName`.

## Reglas operativas v1

Se busca mantener la lógica simple y trazable:

- señales de engagement como `conversation_started`, `message_inbound`, `message_outbound`, `lead_contacted` y `lead_follow_up`
  - empujan el lead hacia `nurturing` cuando aplica
  - aceptan el assignment cuando todavía está `pending`, `assigned` o `reassigned`
- `lead_qualified`
  - mueve el lead a `qualified`
  - acepta el assignment si todavía no estaba tomado
- `lead_won`
  - mueve el lead a `won`
  - cierra el assignment
- `lead_lost`
  - mueve el lead a `lost`
  - cierra el assignment

Si la señal llega pero no puede vincularse a un lead o assignment:

- se persiste igualmente
- queda `ignored`

## Payload recomendado

Shape mínimo recomendado:

```json
{
  "source": "n8n",
  "signalType": "lead_qualified",
  "externalEventId": "evt-123",
  "occurredAt": "2026-03-22T00:10:00.000Z",
  "leadId": "uuid",
  "assignmentId": "uuid",
  "automationDispatchId": "uuid",
  "messagingInstanceId": "leadflow-sales-core-ana-sponsor-3be5f7f2",
  "payload": {
    "note": "Lead respondió y quedó calificado"
  }
}
```

En v1 no exigimos todos los identificadores, pero sí al menos uno entre:

- `leadId`
- `assignmentId`
- `sponsorId`
- `messagingInstanceId`

## Estados de procesamiento

- `received`: se persistió la señal y queda por aplicar
- `applied`: se procesó correctamente y se reflejó en el dominio
- `ignored`: se guardó, pero no tuvo contexto suficiente o no impactó estado operativo
- `failed`: falló el procesamiento

## Qué queda fuera intencionalmente

- inbox conversacional
- sincronización bidireccional completa
- lectura detallada de cada mensaje
- storage de media o adjuntos
- clasificación avanzada por IA
- SLAs complejos
- reglas de retry asincrónicas con colas

## UI mínima

Se agrega visibilidad ligera en:

- `/member/leads`
- `/team/leads`

La timeline muestra:

- tipo de señal
- origen
- estado de procesamiento
- timestamp
- cambio operativo resultante cuando existe

## Cómo prepara el camino para fases siguientes

Esta fase deja lista la base para:

- timeline comercial más rica
- webhooks más específicos desde n8n
- sincronización entrante más profunda con Evolution
- scoring y calificación posterior
- eventual inbox o centro de conversaciones
