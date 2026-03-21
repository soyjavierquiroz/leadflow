# Messaging Integrations v1

## Objetivo

Agregar la primera capa real de mensajeria por sponsor/member en Leadflow, dejando a cada `MEMBER` con capacidad de gestionar su propia conexion de WhatsApp sobre Evolution API sin romper el handoff actual basado en `wa.me`.

## Que integra v1

- modelo persistente `MessagingConnection`
- ownership 1:1 entre `Sponsor` y su canal
- provider inicial `EVOLUTION`
- estado persistido de conexion
- `instance id` externo para Evolution
- telefono del canal y version normalizada
- QR y pairing code cuando la conexion esta pendiente
- webhook base opcional para futura orquestacion
- endpoints member para consultar, conectar, refrescar y desconectar
- superficie privada `/member/channel`

## Que queda fuera intencionalmente

- inbox conversacional
- envio de mensajes desde Leadflow
- respuestas automaticas avanzadas
- automatizacion compleja con n8n
- routing conversacional por lead
- confirmacion de entrega, lectura o typing
- multi-canal mas alla de WhatsApp
- gestion multi-instancia por sponsor

## Modelo

### `MessagingConnection`

Persistencia minima agregada en Prisma:

- `workspaceId`
- `teamId`
- `sponsorId`
- `provider`
- `status`
- `externalInstanceId`
- `phone`
- `normalizedPhone`
- `qrCodeData`
- `pairingCode`
- `pairingExpiresAt`
- `automationWebhookUrl`
- `automationEnabled`
- `metadataJson`
- timestamps de sync, conexion, desconexion y ultimo error

### Relacion sponsor/member/canal

- `User` con rol `MEMBER` ya apunta a un `Sponsor`
- `Sponsor` ahora puede tener un `MessagingConnection`
- el member autenticado solo puede operar el canal de su sponsor
- el canal no reemplaza todavia el reveal ni el handoff publico; solo deja lista la capa real de mensajeria

## Estados de conexion v1

- `disconnected`
- `provisioning`
- `qr_ready`
- `connected`
- `error`

Interpretacion pragmatica:

- si Evolution devuelve QR o pairing code, persistimos `qr_ready`
- si Evolution ya reporta `open` o `connected`, persistimos `connected`
- si falla el upstream, persistimos `error`
- si se desconecta o no existe instancia, persistimos `disconnected`

## Endpoints

Todos quedan scopeados a `MEMBER` y a su propio sponsor:

- `GET /v1/messaging-integrations/me`
- `POST /v1/messaging-integrations/me/connect`
- `POST /v1/messaging-integrations/me/refresh`
- `POST /v1/messaging-integrations/me/disconnect`

## Flujo de conexion

### `connect`

1. el member abre `/member/channel`
2. Leadflow resuelve su sponsor autenticado
3. se construye o reutiliza un `externalInstanceId`
4. el backend crea la instancia en Evolution
5. si hay webhook configurado, lo registra
6. pide QR/pairing a Evolution
7. persiste estado, QR, telefono y metadata

### `refresh`

- relee el estado actual contra Evolution cuando la integracion esta configurada
- si el entorno no tiene Evolution configurado, devuelve el ultimo estado persistido y deja nota explicita para la UI

### `disconnect`

- intenta borrar la instancia remota si el provider esta configurado
- siempre deja la conexion local en `disconnected`
- preserva el fallback comercial actual

## Variables de entorno

En `apps/api/.env.example` quedaron documentadas:

- `EVOLUTION_API_INTERNAL_BASE_URL`
- `EVOLUTION_API_PUBLIC_BASE_URL`
- `EVOLUTION_API_BASE_URL` como fallback legacy
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_PREFIX`
- `EVOLUTION_WEBHOOK_EVENT` con valor recomendado `MESSAGES_UPSERT`
- `MESSAGING_AUTOMATION_WEBHOOK_BASE_URL`

Notas:

- no hay secretos hardcodeados
- `connect` exige `EVOLUTION_API_INTERNAL_BASE_URL` o `EVOLUTION_API_PUBLIC_BASE_URL`, mas `EVOLUTION_API_KEY`
- `refresh` y `disconnect` siguen siendo utiles aun si el entorno no tiene Evolution configurado
- `MESSAGING_AUTOMATION_WEBHOOK_BASE_URL` es opcional y solo prepara el camino para n8n

## UI del member

Nueva superficie:

- `/member/channel`

Permite:

- ver estado actual del canal
- ver `instance id`
- ver telefono normalizado
- ver webhook asociado si existe
- conectar
- refrescar estado
- desconectar
- ver QR o pairing code cuando aplique

`/member/profile` ahora enlaza a esta superficie para separar claramente perfil operativo de configuracion de mensajeria.

## Compatibilidad con Reveal & Handoff

`Reveal & Handoff v1` no cambia su comportamiento comercial final en esta fase:

- si el sponsor no tiene conexion real, el thank-you sigue funcionando con `wa.me`
- si la conexion existe, por ahora solo queda persistida y visible para operacion futura
- el runtime publico no depende todavia de Evolution para completar el handoff

## Base preparada para n8n

v1 no integra flujos avanzados, pero deja la preparacion minima:

- `automationWebhookUrl`
- `automationEnabled`
- `externalInstanceId`
- metadata de estado del provider

Con esto, la siguiente fase puede:

- registrar webhooks por instancia
- rutear eventos hacia n8n
- empezar a orquestar mensajes o handoffs reales sin rehacer el modelo

## Seed demo

El seed deja al menos un sponsor/member con conexion demo persistida:

- `ana.member@leadflow.local`
- sponsor `Ana Sponsor`
- conexion `connected`
- `externalInstanceId` estable
- webhook de automatizacion demo

Esto permite validar la UI y el ownership del canal aun sin depender de una sesion real de WhatsApp en cada entorno.
