# Canonical Funnel Events + Action Links v1

Fecha: 2026-05-30 (UTC)

## Objetivo

Definir el contrato tecnico para la siguiente fase de LeadFlow como runtime de embudos multi-tenant tipo ClickFunnels, con eventos canonicos internos, Action Links, routing de Ads paid-only y continuidad operativa con Kloser/Journey.

Este documento no implementa runtime. Su funcion es fijar fronteras de responsabilidad, taxonomia, modelo de evento, politicas y orden de migracion antes de tocar persistencia o ejecucion.

## 1. Contexto

LeadFlow opera como una plataforma de funnels multi-tenant:

- miles de dominios;
- miles de publicaciones;
- miles de pixeles y tokens;
- multiples teams;
- trafico paid y organico conviviendo en el mismo producto.

Esa escala exige reglas estrictas:

- no se puede mezclar paid y organic;
- no se pueden mezclar pixeles entre teams, dominios o publicaciones;
- no se puede inferir un pixel global si la publicacion/dominio no lo permite;
- Meta Pixel, Meta CAPI y TikTok Events API nunca deben ejecutarse para trafico organico, directo o desconocido.

Responsabilidades canonicas:

- Runtime Context Service es fuente canonica de `tenant`, `app`, `vertical` y `runtime_config`.
- LeadFlow es dueno de funnel, assignment, ownership, TrackedLink y eventos del funnel.
- Kloser es motor de misiones, continuidad y seguimiento.
- n8n ejecuta mensajes, workflows y conectores downstream.
- IA/Kloser nunca deben escribir URLs finales. Solo pueden devolver intencion de accion.

## 2. Principios

- Todo comportamiento relevante del funnel se guarda como evento interno.
- Primero se escribe en el ledger canonico, despues se enruta.
- Kloser/Journey puede recibir eventos granulares paid y organicos.
- Ads conversion events solo se envian para trafico paid configurado.
- Organic retargeting queda como futuro separado, deshabilitado por defecto.
- Pixel/CAPI no deben vivir directamente dentro de componentes VSL, bloques visuales o helpers de CTA.
- Action Link Resolver es la unica fuente de URLs enviables al lead.
- La IA puede decidir `action intent`, pero no construir ni modificar URLs finales.
- Cada dispatch externo debe ser idempotente, auditable y deduplicable.

## 3. Taxonomia de eventos

Eventos base de captura y links:

- `lead_captured`
- `vsl_link_sent`
- `tracked_link_created`
- `tracked_link_reused`
- `tracked_link_opened`
- `tracked_link_revoked`

Eventos VSL:

- `vsl_started`
- `vsl_progress_25`
- `vsl_progress_50`
- `vsl_progress_75`
- `vsl_completed`
- `vsl_cta_revealed`
- `vsl_cta_clicked`

Eventos de handoff, agenda y reunion:

- `whatsapp_handoff_clicked`
- `agenda_link_sent`
- `agenda_clicked`
- `meeting_booked`
- `meeting_confirmed`
- `meeting_completed`

Eventos de conversion posterior:

- `registration_link_sent`
- `registration_completed`
- `testimonial_sent`
- `payment_link_sent`

Eventos de limpieza y control:

- `lead_marked_spam`
- `missions_cancelled`

Notas:

- La taxonomia interna puede ser mas granular que los eventos enviados a Ads.
- No todos los eventos internos deben tener mapping externo.
- Un mismo evento interno puede alimentar Journey, analytics y Ads con politicas distintas.

## 4. Modelo canonico propuesto

Shape base:

```json
{
  "eventId": "evt_...",
  "eventName": "vsl_completed",
  "eventVersion": "1.0",
  "eventFamily": "journey",
  "source": "browser",
  "workspaceId": "workspace-id",
  "teamId": "team-id",
  "domainId": "domain-id",
  "funnelPublicationId": "publication-id",
  "funnelInstanceId": "funnel-instance-id",
  "funnelStepId": "step-id",
  "leadId": "lead-id",
  "visitorId": "visitor-id",
  "assignmentId": "assignment-id",
  "trackedLinkId": "tracked-link-id",
  "actionLinkKey": "leadflow.open_vsl",
  "trafficLayer": "PAID_ADS",
  "attribution": {
    "sourceUrl": "https://example.com/promo/oferta?fbclid=...",
    "landingUrl": "https://example.com/promo/oferta",
    "referrer": "https://facebook.com/",
    "utmSource": "facebook",
    "utmMedium": "paid_social",
    "utmCampaign": "spring-launch",
    "utmContent": "ad-1",
    "utmTerm": null,
    "fbclid": "fbclid-value",
    "fbc": "fb.1...",
    "fbp": "fb.1...",
    "ttclid": null,
    "gclid": null
  },
  "occurredAt": "2026-05-30T17:00:00.000Z",
  "receivedAt": "2026-05-30T17:00:01.000Z",
  "correlationId": "corr_...",
  "dedupeKey": "lead-id:vsl_completed:step-id",
  "payload": {
    "progress": 100,
    "durationSeconds": 1240
  }
}
```

Campos obligatorios recomendados:

- `eventId`
- `eventName`
- `eventVersion`
- `eventFamily`
- `source`
- `workspaceId`
- `teamId`
- `trafficLayer`
- `occurredAt`
- `receivedAt`
- `dedupeKey`
- `payload`

Campos opcionales segun contexto:

- `domainId`
- `funnelPublicationId`
- `funnelInstanceId`
- `funnelStepId`
- `leadId`
- `visitorId`
- `assignmentId`
- `trackedLinkId`
- `actionLinkKey`
- `correlationId`
- `attribution`

## 5. Event families

- `journey`: avance del lead en el funnel y senales de seguimiento.
- `conversion`: conversiones internas de negocio.
- `action_link`: creacion, reuse, apertura, expiracion y revocacion de links.
- `assignment`: ownership, sponsor asignado y lifecycle operativo.
- `mission`: misiones creadas/canceladas/completadas por Kloser.
- `ads_delivery`: dispatches hacia Meta/TikTok y su resultado.
- `analytics`: eventos internos para dashboards y diagnostico.

## 6. Routing destinations

Cada evento canonico se escribe primero en el ledger interno. Luego el router puede decidir destinos:

- internal ledger;
- Kloser/Journey;
- Meta CAPI;
- TikTok Events API;
- browser pixel;
- internal analytics;
- CRM/n8n metadata.

Regla practica:

- productores emiten eventos canonicos;
- sinks no mutan el evento original;
- cada sink persiste su propio resultado de delivery;
- un fallo de sink no debe romper la captura, asignacion ni navegacion del funnel.

## 7. Paid vs organic rules

Reglas por destino:

| Destino | Paid | Organic | Direct | Unknown |
| --- | --- | --- | --- | --- |
| internal ledger | si | si | si | si |
| Journey/Kloser | si | si | si | si, si hay identidad suficiente |
| internal analytics | si | si | si | si |
| CRM/n8n metadata | si | si | si | si |
| Meta CAPI | si, configurado | no | no | no |
| TikTok Events API | si, configurado | no | no | no |
| browser pixel | si, configurado | no | no | no |

Definiciones:

- `PAID_ADS`: evidencia paid por click id, UTM paid o politica de campana configurada.
- `PAID_WHEEL`: campana/rueda pagada activa para la publicacion.
- `ORGANIC`: visita sin evidencia paid.
- `DIRECT`: visita de asesor/referral propio sin pixel paid.
- `unknown`: cualquier entrada incompleta, corrupta o no clasificable.

Reglas duras:

- `ads_conversion_event` solo puede salir para `PAID_ADS` o `PAID_WHEEL`.
- `ORGANIC`, `DIRECT` y `unknown` nunca disparan Meta Pixel, Meta CAPI ni TikTok Events API.
- `organic_audience_event` queda como futuro separado, explicitamente deshabilitado por defecto.
- Si falta configuracion paid o pixel/dataset de la publicacion, no hay dispatch Ads.

## 8. Policies

### `journey_event_policy`

Define que eventos alimentan Journey/Kloser, ventanas de espera y acciones de seguimiento.

```json
{
  "version": "journey_event_policy.v1",
  "enabled": true,
  "includeTrafficLayers": ["PAID_ADS", "PAID_WHEEL", "ORGANIC", "DIRECT"],
  "events": {
    "lead_captured": {
      "emitToJourney": true,
      "missionIntent": "send_vsl"
    },
    "tracked_link_opened": {
      "emitToJourney": true,
      "missionIntent": "mark_vsl_opened"
    },
    "vsl_completed": {
      "emitToJourney": true,
      "missionIntent": "send_calendar_link"
    }
  },
  "timeouts": {
    "no_vsl_opened_after_hours": 6,
    "no_vsl_completed_after_hours": 12,
    "no_agenda_after_hours": 24
  }
}
```

### `conversion_event_policy`

Define que eventos internos pueden convertirse en eventos de Ads y bajo que condiciones.

```json
{
  "version": "conversion_event_policy.v1",
  "enabled": true,
  "trafficLayers": ["PAID_ADS", "PAID_WHEEL"],
  "organicDisabledByDefault": true,
  "mappings": [
    {
      "internalEventName": "lead_captured",
      "provider": "meta",
      "providerEventName": "Lead",
      "sendBrowser": true,
      "sendServer": true,
      "requiresIdentity": true
    },
    {
      "internalEventName": "meeting_booked",
      "provider": "tiktok",
      "providerEventName": "CompleteRegistration",
      "sendBrowser": false,
      "sendServer": true,
      "requiresIdentity": true
    }
  ]
}
```

### `ads_tracking_config`

Define aislamiento y credenciales por team, dominio, publicacion y tracking profile.

```json
{
  "version": "ads_tracking_config.v1",
  "enabled": true,
  "workspaceId": "workspace-id",
  "teamId": "team-id",
  "domainId": "domain-id",
  "funnelPublicationId": "publication-id",
  "trackingProfileId": "tracking-profile-id",
  "allowedTrafficLayers": ["PAID_ADS", "PAID_WHEEL"],
  "browserPixelsEnabled": true,
  "serverCapiEnabled": true,
  "providers": {
    "meta": {
      "enabled": true,
      "pixelId": "1234567890",
      "datasetId": null,
      "capiTokenRef": "secret:meta-capi-token",
      "allowedDomains": ["example.com"]
    },
    "tiktok": {
      "enabled": true,
      "pixelId": "C123ABC456",
      "accessTokenRef": "secret:tiktok-access-token",
      "allowedDomains": ["example.com"]
    }
  },
  "deduplication": {
    "mode": "browser_server",
    "keyTemplate": "{eventId}:{provider}:{providerEventName}"
  }
}
```

### `action_link_policy`

Define que acciones pueden resolverse, con TTL, shortener, dominios permitidos y revocacion.

```json
{
  "version": "action_link_policy.v1",
  "enabled": true,
  "defaultTtlHours": 48,
  "shortener": {
    "enabled": true,
    "provider": "yourls"
  },
  "allowedActions": {
    "leadflow.open_vsl": {
      "requiresLead": true,
      "requiresAssignment": true,
      "targetType": "funnel_step",
      "stepKey": "presentacion",
      "purpose": "vsl_followup",
      "ttlHours": 48
    },
    "calendar.book_call": {
      "requiresLead": true,
      "requiresAssignment": true,
      "targetType": "external_integration",
      "purpose": "agenda_followup",
      "ttlHours": 72
    },
    "wallet.open_payment": {
      "requiresLead": true,
      "requiresAssignment": true,
      "targetType": "payment",
      "purpose": "payment_checkout",
      "ttlHours": 24
    }
  },
  "revocation": {
    "revokeOnSpam": true,
    "revokeOnAssignmentClosed": true
  }
}
```

## 9. Team/domain/publication/pixel isolation

Reglas de aislamiento:

- Resolver configuracion por `workspaceId + teamId + domainId + funnelPublicationId + trackingProfileId`.
- Nunca usar pixel de otro team.
- Nunca inferir pixel global si la publicacion o dominio no lo permite.
- No heredar credenciales Ads por accidente desde un funnel/template.
- El dispatch ledger debe incluir `provider`, `pixelId` o `datasetId`, `publicationId`, `domainId`, `teamId`, `eventId` y `dedupeKey`.
- Cada dispatch externo debe ser idempotente.
- Cada combinacion `eventId + provider + providerEventName + pixelId/datasetId` debe producir como maximo un dispatch activo.
- Si hay mismatch entre dominio real y `allowedDomains`, se omite el dispatch.
- Si `trafficLayer` no es paid, se omite el dispatch aunque existan pixeles.

Ledger de delivery recomendado:

```json
{
  "dispatchId": "dispatch-id",
  "eventId": "evt_...",
  "provider": "meta",
  "providerEventName": "Lead",
  "pixelId": "1234567890",
  "datasetId": null,
  "workspaceId": "workspace-id",
  "teamId": "team-id",
  "domainId": "domain-id",
  "funnelPublicationId": "publication-id",
  "status": "queued",
  "attemptCount": 0,
  "dedupeKey": "evt_...:meta:Lead:1234567890",
  "lastError": null
}
```

## 10. Action Link Resolver

Action Link Resolver es la unica fuente de URLs enviables al lead.

Input:

```json
{
  "leadId": "lead-id",
  "assignmentId": "assignment-id",
  "actionKey": "leadflow.open_vsl",
  "appKey": "leadflow",
  "purpose": "vsl_followup",
  "channel": "whatsapp",
  "params": {
    "stepKey": "presentacion"
  }
}
```

Acciones canonicas:

- `leadflow.open_vsl`
- `calendar.book_call`
- `meeting.join_zoom`
- `leadflow.open_registration`
- `content.open_asset`
- `wallet.open_payment`
- `generic.open_url`

Output:

```json
{
  "url": "https://short.example/abc123",
  "longUrl": "https://example.com/presentacion?ctx=signed-token",
  "shortUrl": "https://short.example/abc123",
  "provider": "yourls",
  "trackedLinkId": "tracked-link-id",
  "expiresAt": "2026-06-01T17:00:00.000Z",
  "cached": false,
  "metadata": {
    "actionKey": "leadflow.open_vsl",
    "purpose": "vsl_followup",
    "channel": "whatsapp"
  }
}
```

Reglas:

- IA/Kloser devuelve intencion de accion, nunca URL final.
- n8n puede pedir resolver una accion, pero no inventar URL.
- El resolver valida ownership, assignment, lead, team, dominio y policy.
- El resolver persiste o reutiliza `TrackedLink`.
- Toda creacion, reuse, apertura, expiracion y revocacion de link emite evento canonico.
- `generic.open_url` solo se permite para URLs registradas en policy y con dominio permitido.

## 11. Kloser/Journey Analyst

Kloser consume eventos canonicos o summaries, no tablas internas del funnel.

Responsabilidades de Kloser:

- evaluar estrategia de continuidad;
- crear misiones;
- cancelar misiones;
- observar completion/failure de ejecucion;
- decidir proximo follow-up segun eventos.

Responsabilidades que no pertenecen a Kloser:

- ownership;
- assignment;
- resolucion de URLs finales;
- TrackedLink;
- pixel routing;
- attribution source of truth;
- mutacion del funnel.

Ejemplos:

- `vsl_completed` -> crear mision `send_calendar_link`.
- No existe `tracked_link_opened` para el VSL despues de X horas -> crear mision `resend_vsl`.
- Existe `vsl_progress_50` pero no `vsl_completed` despues de X horas -> crear mision `remind_finish_vsl`.
- `meeting_booked` -> crear mision `confirm_meeting`.
- `lead_marked_spam` -> cancelar misiones y revocar links.

Payload resumido hacia Kloser:

```json
{
  "event": {
    "eventId": "evt_...",
    "eventName": "vsl_completed",
    "eventFamily": "journey",
    "occurredAt": "2026-05-30T17:00:00.000Z"
  },
  "tenant": {
    "workspaceId": "workspace-id",
    "teamId": "team-id",
    "runtimeConfigVersion": "runtime-config:v1"
  },
  "lead": {
    "leadId": "lead-id",
    "assignmentId": "assignment-id",
    "trafficLayer": "ORGANIC"
  },
  "strategyContext": {
    "vertical": "multinivel",
    "stage": "watched_vsl"
  },
  "availableActions": [
    {
      "actionKey": "calendar.book_call",
      "purpose": "agenda_followup"
    }
  ]
}
```

## 12. CAPI/TikTok future refactor

Estado actual:

- `CapiManagerService` existe como side effect de lead submit.
- Tiene guardrails server-side para omitir organic/direct.
- No tiene dispatch ledger persistente, retries ni dedupe durable.

Estado futuro:

- EventRouter debe ser dueno del dispatch CAPI/TikTok.
- CAPI/TikTok deben ser sinks del evento canonico.
- Cada dispatch debe persistirse con status, provider, pixel/dataset, request/response sanitizados, attempts y error.
- El `eventId` canonico debe usarse como base para dedupe Pixel + CAPI.
- ConversionEventMapping debe alimentar mapping declarativo por provider.
- Browser Pixel y server CAPI deben compartir `event_id` cuando sea el mismo evento de conversion.

Reglas duras:

- Ningun sink Ads puede ejecutarse antes de confirmar `trafficLayer` paid.
- Si attribution o identidad no cumplen requisitos minimos del provider, se omite y se registra delivery skip.
- Errores de provider no bloquean captura, assignment ni experiencia publica.

## 13. Migration plan / commits

Orden sugerido:

1. Docs contract: `canonical-funnel-events-action-links-v1`.
2. `CanonicalFunnelEvent` model o hardening de columnas en `DomainEvent`.
3. Hardening de attribution ledger.
4. Event writer canonico con idempotencia local.
5. Emision granular VSL desde runtime/player.
6. Generalizacion de `ActionLinkResolver` sobre `TrackedLink`.
7. `EventRouter` con sink no-op/internal.
8. Sink Kloser/Journey.
9. Sink Ads conversion paid-only.
10. Delivery ledger, retries y dedupe para Meta/TikTok.
11. Remover legacy de deteccion de URLs en texto en n8n.
12. Migrar workflows n8n a `action intent` + Action Link Resolver.

## 14. Riesgos y guardrails

Riesgos:

- contaminacion organic por browser pixel;
- persistencia debil de attribution;
- leakage de pixel cross-team;
- leakage de pixel cross-domain o cross-publication;
- sobre-envio de eventos a Meta/TikTok;
- duplicados Pixel/CAPI por falta de dedupe;
- acoplar Kloser a internals de LeadFlow;
- LLM escribiendo URLs finales;
- revocacion incompleta de links ante spam/basura;
- eventos VSL demasiado ruidosos sin milestones/idempotencia.

Guardrails:

- paid-only hard gate para browser pixel y CAPI;
- resolver configuracion siempre por team/domain/publication/profile;
- ledger canonico antes de routing;
- delivery ledger por provider;
- action intents en vez de URLs generadas por IA;
- revocacion centralizada de Action Links;
- Kloser consume eventos/summaries, no tablas internas;
- no enviar organic retargeting salvo feature future explicito, separado y disabled by default.

## Estado de implementacion esperado despues de este contrato

Despues de este documento, la siguiente fase puede avanzar sin reabrir decisiones basicas:

- que es un evento canonico;
- que destinos existen;
- cuando Ads puede recibir eventos;
- quien resuelve URLs;
- que pertenece a LeadFlow y que pertenece a Kloser;
- como migrar desde CAPI side effect y URL detection legacy hacia EventRouter + Action Links.
