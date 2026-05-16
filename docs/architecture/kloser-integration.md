# Kloser v2.2 Integration Architecture

Estado: desplegado en Leadflow API, Leadflow Web y Swarm.

Este documento consolida la integracion tecnica del microservicio de seguimiento asincrono Kloser v2.2 dentro del ecosistema Leadflow. La integracion cubre cuatro superficies: firma criptografica de salida, cliente global NestJS, inyeccion del Payload Maestro v2.2 desde la configuracion de IA del Team Leader y cancelacion inmediata de misiones cuando Evolution API reporta actividad inbound de WhatsApp.

## 1. Contrato de seguridad, Guardia de Hierro

Toda llamada saliente de Leadflow hacia Kloser usa un cuerpo JSON firmado con HMAC-SHA256. El contrato canonico es:

```text
message = Timestamp + "." + Nonce + "." + RawBody
signature = HMAC_SHA256(message, Secret)
```

Forma compacta:

```text
HMAC_SHA256(Timestamp.Nonce.RawBody, Secret)
```

Leadflow envia la firma en headers HTTP:

```text
Content-Type: application/json
X-Kloser-Timestamp: <unix_timestamp_seconds>
X-Kloser-Nonce: <uuid_v4>
X-Kloser-Signature: <hex_hmac_sha256>
```

Definiciones estrictas:

- `Timestamp`: `floor(Date.now() / 1000)`, expresado en segundos Unix.
- `Nonce`: UUID aleatorio por request, generado con `crypto.randomUUID()`.
- `RawBody`: el string exacto enviado por red, producido por `JSON.stringify(payload)`.
- `Secret`: `KLOSER_HMAC_SECRET`, compartido entre Leadflow API y Kloser.

La verificacion del receptor Kloser debe reconstruir el mismo `message` usando el raw body recibido, calcular `HMAC_SHA256` con el secreto compartido y comparar la firma en tiempo constante. La ventana de tolerancia anti-replay es de 300 segundos:

```text
abs(now_unix_seconds - X-Kloser-Timestamp) <= 300
```

Adicionalmente, el par logico `(X-Kloser-Timestamp, X-Kloser-Nonce)` se considera de un solo uso dentro de esa ventana. Si la firma no coincide, el timestamp cae fuera de los 300 segundos, el nonce ya fue observado o falta alguno de los headers, Kloser debe rechazar la solicitud antes de ejecutar efectos de negocio. Esto previene replay attacks aun cuando un paquete valido sea capturado dentro del trafico interno.

Implementacion Leadflow: `apps/api/src/modules/kloser/kloser-api.client.ts`.

## 2. Arquitectura del cliente Kloser

`KloserApiClient` es el adaptador HTTP oficial desde Leadflow API hacia Kloser. Vive en `apps/api/src/modules/kloser/kloser-api.client.ts` y es exportado por `KloserModule`.

`KloserModule` esta marcado con `@Global()`, por lo que el provider queda disponible como dependencia inyectable en los modulos que lo importan. Actualmente se importa en:

- `MessagingAutomationModule`, para crear misiones despues del dispatch de contexto.
- `IncomingWebhooksModule`, para cancelar misiones ante mensajes inbound.
- `DomainModule`, para mantener disponibilidad transversal en flujos de dominio que dependan de la misma superficie.

Configuracion:

```text
KLOSER_API_URL=http://kloser.kuruk.in/api/v1
KLOSER_HMAC_SECRET=<shared-secret>
KLOSER_REQUEST_TIMEOUT_MS=2500
```

Si `KLOSER_API_URL` no existe, el cliente usa `http://kloser.kuruk.in/api/v1`. Si `KLOSER_REQUEST_TIMEOUT_MS` no existe o no es positivo, usa `2500ms`.

### Zero-Crash Policy

Kloser no puede tumbar el flujo principal de Leadflow. La politica operacional es:

- `createMission(payload)` retorna `Promise<boolean>`.
- Errores HTTP no exitosos se registran y retornan `false`.
- Errores de red, timeouts o aborts se capturan, se registran y retornan `false`.
- El `LeadDispatcherService` envuelve la creacion de misiones en `try/catch` para que una falla posterior al dispatch no invalide la asignacion ni el envio hacia n8n.

Resultado: Leadflow conserva disponibilidad aunque Kloser este caido, lento o rechace una mision. El seguimiento asincrono queda degradado, pero el core transaccional de asignacion y mensajeria sigue operando.

### Fire-and-Forget en cancelacion

`cancelMission(tenantId, remoteJid, strategyId, reason)` construye un payload minimo y llama:

```text
POST {KLOSER_API_URL}/missions/cancel
```

La llamada se ejecuta con `void fetch(...)`. El metodo prepara headers firmados, dispara la orden de hard kill y retorna sin esperar el resultado remoto. Cualquier error asincrono se registra en el `.catch`, y el timeout se limpia en `.finally`.

Payload de cancelacion:

```json
{
  "tenant_id": "team-id",
  "remote_jid": "573001112233@s.whatsapp.net",
  "strategy_id": "strategy-or-funnel-id",
  "reason": "lead_inbound_message"
}
```

Esta ruta esta disenada para no bloquear el webhook inbound. La prioridad es cortar la automatizacion lo antes posible y permitir que Evolution API reciba respuesta rapida desde Leadflow.

## 3. Mapeo de datos y Payload Maestro v2.2

La fuente de verdad de negocio para Kloser es la politica de IA configurada por el Team Leader en la UI de Leadflow Web. El formulario `AiSettingsForm` persiste la rama:

```json
{
  "aiPolicy": {
    "kloser": {
      "strategy": {
        "cadence_minutes": [1440, 2880, 4320]
      },
      "compliance_policy": {
        "quiet_hours": {
          "start": "21:00",
          "end": "08:00"
        }
      },
      "cta_policy": {
        "type": "watch_video",
        "base_url": "https://example.com",
        "requires_shortener": true
      },
      "message_policy": {
        "forbidden_claims": []
      }
    }
  }
}
```

La UI muestra labels amigables, pero conserva valores canonicos para el payload:

| Label UI | Value persistido |
| --- | --- |
| Ver video | `watch_video` |
| Agendar llamada | `book_call` |
| Visitar pagina / Carta de ventas | `visit_page` |
| Otro (Personalizado) | `custom` |

En backend, `LeadDispatcherService` consulta la asignacion con `team.aiAgentConfigs`, toma el tenant config activo (`memberId: null`, `isActive: true`, ordenado por `updatedAt desc`) y resuelve la configuracion final mediante:

- `resolveKloserTenantConfig({ aiPolicy, ctaPolicy })`
- `resolveKloserRuntimeAttributes({ aiPolicy, routeContexts, verticalFallback })`

Esto permite que `aiPolicy.kloser` inyecte dinamicamente estrategia, cumplimiento, CTA y politica de mensajes sin cambiar codigo de dispatch.

### Payload Maestro v2.2

Cuando `dispatchLeadContextUpsert` completa el envio del contexto hacia n8n, Leadflow invoca `createKloserMission`. El payload enviado a Kloser tiene esta forma:

```json
{
  "event_id": "lf_evt_<uuid>",
  "event_type": "mission.created",
  "tenant_id": "team-id",
  "lead_id": "lead-id",
  "remote_jid": "573001112233@s.whatsapp.net",
  "channel": "whatsapp",
  "idempotency_key": "lf_strat_<strategy_id>_lead_<lead_id>",
  "due_at": "2026-05-16T12:00:00.000Z",
  "timezone": "America/La_Paz",
  "strategy": {
    "id": "leadflow_default_follow_up",
    "version": "2.2",
    "enabled": true,
    "max_attempts": 3,
    "cadence_minutes": [1440]
  },
  "compliance_policy": {
    "has_whatsapp_opt_in": true,
    "quiet_hours": {
      "start": "21:00",
      "end": "08:00"
    },
    "is_opted_out": false,
    "stage_allows_automation": true,
    "human_takeover": false
  },
  "cta_policy": {
    "type": "watch_video",
    "required": true,
    "shortener": "enabled",
    "allowed_domains": [],
    "base_url": "https://example.com",
    "requires_shortener": true
  },
  "message_policy": {
    "template_id": "leadflow_follow_up_v1",
    "language": "es",
    "variables": {},
    "max_length": 1024,
    "requires_personalization": true,
    "forbidden_claims": []
  },
  "context_snapshot": {
    "lead_stage": "prospect",
    "source": "leadflow_core",
    "custom_attributes": {
      "vertical": "multinivel",
      "app_key": "leadflow",
      "wallet_account_id": null,
      "push_name": "Prospecto"
    }
  },
  "observability": {
    "source_system": "leadflow",
    "service_owner_key": "lead-handler"
  }
}
```

Reglas de calculo:

- `due_at = now + first(strategy.cadence_minutes) * 60_000ms`.
- `timezone = assignment.workspace.timezone || "America/La_Paz"`.
- `idempotency_key = "lf_strat_" + strategy.id + "_lead_" + lead.id`.
- `remote_jid` se deriva del telefono normalizado del lead en formato WhatsApp: `<phone>@s.whatsapp.net`.
- `vertical` se lee desde `aiPolicy.kloser`, luego `aiPolicy`, luego `routeContexts`, y finalmente desde el funnel/publication fallback.

Defaults v2.2 si la UI no provee overrides:

```json
{
  "strategy": {
    "id": "leadflow_default_follow_up",
    "version": "2.2",
    "enabled": true,
    "max_attempts": 3,
    "cadence_minutes": [1440]
  },
  "compliance_policy": {
    "has_whatsapp_opt_in": true,
    "quiet_hours": {
      "start": "21:00",
      "end": "08:00"
    }
  },
  "cta_policy": {
    "type": "whatsapp",
    "required": true,
    "shortener": "none",
    "allowed_domains": [],
    "base_url": null,
    "requires_shortener": false
  },
  "message_policy": {
    "template_id": "leadflow_follow_up_v1",
    "language": "es",
    "variables": {},
    "max_length": 1024,
    "requires_personalization": true,
    "forbidden_claims": []
  }
}
```

## 4. Flujo de intercepcion inbound, guillotina asincrona

`IncomingWebhooksService` recibe webhooks de Evolution API por las rutas de mensajeria inbound. Su funcion en esta integracion es actuar como guillotina asincrona: si entra cualquier mensaje de WhatsApp asociado a un lead, Leadflow dispara inmediatamente una cancelacion hacia Kloser para evitar que el sistema envie seguimientos automatizados sobre una conversacion ya iniciada.

Secuencia operacional:

1. Evolution API entrega un webhook inbound a Leadflow.
2. `IncomingWebhooksService.ingestMessagingSignal` valida `INCOMING_MESSAGING_WEBHOOK_SECRET`.
3. El servicio extrae `leadId`, `assignmentId`, `sponsorId`, `instanceId`, `externalEventId`, texto del mensaje y telefono emisor.
4. `resolveLeadContext` localiza el lead por prioridad: `leadId`, luego `assignmentId`, luego `sponsorId` o `instanceId` mas telefono emisor.
5. Si existe `messageText`, el servicio llama `fireKloserHardKill`.
6. `fireKloserHardKill` resuelve `remote_jid` desde el telefono emisor o desde el telefono del lead.
7. Se ejecuta `void this.kloserApiClient.cancelMission(...)`, sin bloquear el webhook.

La razon enviada a Kloser es:

```text
lead_inbound_<keyword>
```

cuando se detecta keyword de opt-out, o:

```text
lead_inbound_message
```

cuando solo se detecta actividad inbound. El opt-out local ya no escribe blacklist en Leadflow; la proteccion se delega a Kurukin Hub por SSO. La cancelacion de Kloser, sin embargo, se ejecuta ante cualquier texto inbound, no solamente ante opt-out.

El `strategy_id` para la cancelacion se resuelve en este orden:

```text
assignment.funnelPublication.handoffStrategyId
?? assignment.funnelInstance.handoffStrategyId
?? assignment.funnelPublicationId
?? assignment.funnelInstanceId
?? assignment.funnelId
```

Esto hace que Kloser pueda cortar la mision correcta aun cuando la asignacion venga desde una publicacion, una instancia de funnel o el funnel base.

## 5. Endpoints y responsabilidades

| Superficie | Metodo | Endpoint | Bloquea flujo principal | Responsable |
| --- | --- | --- | --- | --- |
| Crear mision | `POST` | `/missions` | No debe romper Leadflow; retorna `false` en falla | `LeadDispatcherService` + `KloserApiClient` |
| Cancelar mision | `POST` | `/missions/cancel` | No, fire-and-forget | `IncomingWebhooksService` + `KloserApiClient` |

## 6. Archivos fuente

- Cliente firmado: `apps/api/src/modules/kloser/kloser-api.client.ts`
- Provider global: `apps/api/src/modules/kloser/kloser.module.ts`
- Dispatch y Payload Maestro v2.2: `apps/api/src/modules/messaging-automation/lead-dispatcher.service.ts`
- Resolver de configuracion Kloser: `apps/api/src/modules/ai-config/kloser-tenant-config.ts`
- Intercepcion inbound: `apps/api/src/modules/incoming-webhooks/incoming-webhooks.service.ts`
- Configuracion visual del Team Leader: `apps/web/components/management/AiSettingsForm.tsx`

## 7. Invariantes operativos

- Leadflow nunca debe depender de una respuesta exitosa de Kloser para completar asignaciones o aceptar webhooks inbound.
- Todo request a Kloser debe salir firmado sobre el raw body exacto.
- La ventana anti-replay contractual es de 300 segundos.
- `remote_jid` siempre debe usar formato WhatsApp `@s.whatsapp.net`.
- La UI puede traducir labels, pero los valores canonicos de `cta_policy.type` deben permanecer estables para compatibilidad con API y Kloser.
- Una respuesta inbound humana tiene precedencia sobre cualquier automatizacion pendiente.
