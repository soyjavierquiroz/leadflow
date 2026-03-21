# Evolution QR Connect v1

## Objetivo

Convertir la capa de `Messaging Integrations v1` en un flujo operativo real de conexión WhatsApp por QR para cada `MEMBER`, usando siempre a `Leadflow API` como mediador entre la UI y Evolution API.

Flujo obligatorio:

1. navegador -> Leadflow Web
2. Leadflow Web -> Leadflow API
3. Leadflow API -> Evolution API

## Principios de arquitectura

- el frontend nunca habla directo con Evolution
- la ruta principal de control usa `EVOLUTION_API_INTERNAL_BASE_URL`
- `EVOLUTION_API_PUBLIC_BASE_URL` queda solo como fallback opcional
- `EVOLUTION_API_BASE_URL` se mantiene como compatibilidad legacy, pero no es la ruta preferida
- Reveal & Handoff actual sigue funcionando con `wa.me` si no hay conexión real

## Modelo

Se mantiene `MessagingConnection` como ownership 1:1 entre `Sponsor` y canal.

El `instanceId` real queda persistido en `MessagingConnection.externalInstanceId` y se expone también como `instanceId` en la respuesta API.

Convención exacta de naming:

- `{EVOLUTION_INSTANCE_PREFIX}-{teamCode}-{sponsorSlug}-{sponsorIdCorto}`

Ejemplo:

- `leadflow-sales-core-ana-sponsor-3be5f7f2`

Esto deja un identificador:

- estable
- legible
- reproducible
- desacoplado de logins o emails

## Estados soportados

- `disconnected`
- `provisioning`
- `qr_ready`
- `connecting`
- `connected`
- `error`

Interpretación:

- `provisioning`: Leadflow está asegurando o creando la instancia
- `qr_ready`: Evolution devolvió QR o pairing code
- `connecting`: el QR ya fue entregado y Evolution reporta un estado intermedio
- `connected`: Evolution reporta `open` o `connected`
- `disconnected`: no hay instancia utilizable o fue desconectada
- `error`: fallo de upstream o de sincronización

## Lifecycle de instancia

### `connect`

1. cargar o crear `MessagingConnection`
2. asegurar `instanceId` estable
3. `GET /instance/connectionState/{instance_id}`
4. si no existe:
   - `POST /instance/create`
5. `POST /webhook/set/{instance_id}` si hay webhook base configurado
6. `GET /instance/connect/{instance_id}` para pedir QR
7. `GET /instance/connectionState/{instance_id}` para estado final inmediato
8. persistir estado, QR, pairing, teléfono y metadata

### `qr`

- reutiliza la misma instancia
- asegura que exista
- reaplica webhook si corresponde
- vuelve a pedir QR
- actualiza la persistencia sin rehacer ownership

### `refresh`

- relee `connectionState`
- actualiza `status`
- limpia QR si ya está conectado o desconectado

### `reset`

1. `DELETE /instance/delete/{instance_id}`
2. volver a ejecutar el flujo de `connect`

Resultado:

- misma identidad lógica de sponsor
- nueva sesión real de emparejamiento
- QR nuevo cuando aplica

### `disconnect`

- intenta borrar la instancia remota
- siempre marca la conexión local como `disconnected`
- no rompe el fallback comercial actual

## Estrategia de QR

- se usa `GET /instance/connect/{instance_id}`
- Leadflow API hace polling corto del endpoint para intentar obtener:
  - `base64`
  - `pairing code`
- si hay QR o pairing:
  - estado `qr_ready`
- si todavía no hay QR pero Evolution ya está en transición:
  - estado `connecting` o `provisioning` según el estado remoto

En UI:

- `/member/channel` muestra QR real
- muestra pairing code si existe
- hace polling simple del estado mientras el canal está en:
  - `provisioning`
  - `qr_ready`
  - `connecting`

## Retries y resiliencia

Leadflow API maneja:

- timeout configurable
- retries razonables
- reintentos sobre:
  - `408`
  - `425`
  - `429`
  - `500`
  - `502`
  - `503`
  - `504`

Headers de auth soportados simultáneamente:

- `apikey`
- `x-api-key`
- `Authorization: Bearer <key>`

## Endpoints member

- `GET /v1/messaging-integrations/me`
- `POST /v1/messaging-integrations/me/connect`
- `POST /v1/messaging-integrations/me/qr`
- `POST /v1/messaging-integrations/me/refresh`
- `POST /v1/messaging-integrations/me/reset`
- `POST /v1/messaging-integrations/me/disconnect`

## Variables de entorno

Principales:

- `EVOLUTION_API_INTERNAL_BASE_URL`
- `EVOLUTION_API_PUBLIC_BASE_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_PREFIX`
- `EVOLUTION_WEBHOOK_EVENT` con valor recomendado `MESSAGES_UPSERT`
- `MESSAGING_AUTOMATION_WEBHOOK_BASE_URL`

Operativas:

- `EVOLUTION_REQUEST_TIMEOUT_MS`
- `EVOLUTION_REQUEST_RETRIES`
- `EVOLUTION_QR_POLL_ATTEMPTS`
- `EVOLUTION_QR_POLL_DELAY_MS`

Compatibilidad:

- `EVOLUTION_API_BASE_URL` sigue soportado como fallback legacy

## Webhook en esta fase

El webhook builder queda listo, pero esta fase no depende de automatización compleja.

Qué sí hace v1:

- construye una URL de webhook por `instanceId`
- la registra en Evolution si existe base configurada

Qué no hace todavía:

- flujos avanzados de n8n
- orquestación conversacional
- inbox
- envío saliente desde Leadflow

## Compatibilidad con Reveal & Handoff

No se cambia el comportamiento comercial final:

- si hay conexión real, queda lista para fases siguientes
- si no hay conexión real, el funnel público sigue funcionando con `wa.me`
- el thank-you y el reveal no dependen todavía del estado de Evolution

## Qué deja listo esta fase

- sponsor/member con WhatsApp real conectable
- QR real visible desde `/member/channel`
- refresh y reset operativos
- instance lifecycle estable y documentado
- base técnica lista para `Messaging Automation / n8n v1`
