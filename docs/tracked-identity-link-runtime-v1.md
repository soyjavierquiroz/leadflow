# Tracked Identity Link Runtime v1

Fecha: 2026-05-30 (UTC)

## Objetivo

Documentar el runtime actual de enlaces identificados con persistencia `TrackedLink` como base para TrackedLink / ActionLink.

Esta fase permite construir un enlace publico hacia un paso del funnel con contexto firmado (`ctx`), persistir el link enviado a n8n, reutilizar short links, validar revocacion/expiracion en `hydrate` y rehidratar el lead asignado para que el CTA `assigned_whatsapp` abra WhatsApp con el asesor correcto.

## Flujo implementado

1. El visitante envia el formulario publico.
2. `LeadCaptureAssignmentService` crea o reutiliza `Lead`.
3. La asignacion crea `Assignment` con `ownershipKey`.
4. El mensaje de WhatsApp agrega un Ref corto automatico derivado de `ownershipKey`.
5. El contexto del assignment puede enviarse a n8n y a Runtime Context Ownership Upsert si el feature flag esta activo.
6. n8n llama `POST /v1/automation/generate-tracked-link` con `leadId` y `stepKey`.
7. La API busca un `TrackedLink` activo para el mismo lead, assignment, step y purpose.
8. Si existe y no expiro, devuelve el link guardado con `cached: true`.
9. Si no existe, firma un `ctx` con `IDENTITY_TOKEN_SECRET`, guarda `TrackedLink`, cachea `shortUrl` si YOURLS responde y devuelve una URL como `/presentacion?ctx=...` con `cached: false`.
10. La web carga el paso publico y el cliente llama `POST /v1/public/funnel-runtime/hydrate`.
11. `hydrate` valida el token, busca `TrackedLink` por `ctxTokenHash`, bloquea links revocados/expirados/deleted y registra llegada al runtime.
12. `hydrate` reconstruye `submissionContext` y lo guarda en la sesion publica.
13. El bloque `hero_vsl_delayed_cta` con `behavior.cta_mode = assigned_whatsapp` usa el handoff hidratado.
14. El CTA abre WhatsApp del asesor asignado. No abre modal de captura.

## TrackedLink persistence

`TrackedLink` persiste cada link operativo entregado a n8n sin guardar el token plano. El campo `ctxTokenHash` guarda SHA-256 del token exacto y permite validar la llegada en `/hydrate`.

Campos principales:

- `workspaceId`
- `leadId`
- `assignmentId`
- `ownershipKey`
- `funnelPublicationId`
- `funnelInstanceId`
- `funnelStepId`
- `stepKey`
- `appKey`: default `leadflow`
- `action`: default `open_vsl`
- `purpose`: default `vsl_followup`
- `longUrl`
- `shortUrl`
- `shortCode`
- `shortLinkProvider`
- `ctxTokenHash`
- `status`: `active`, `revoked`, `expired`, `deleted`
- `expiresAt`
- `clickCount`
- `lastClickedAt`
- `createdBy`
- `metadataJson`

La idempotencia activa se define por:

- `leadId`
- `assignmentId`
- `funnelStepId`
- `purpose`
- `status = active`

Antes de crear un link nuevo, la API marca como `expired` los links activos vencidos para esa misma combinacion. Si encuentra un link activo vigente, lo reutiliza.

### Respuesta cached

Cuando `cached = false`, el link se acaba de crear y la respuesta incluye `token`.

Cuando `cached = true`, la API devuelve `longUrl`, `shortUrl` y `url` guardados, y `token` viene como `null`. Esto evita persistir el token plano y mantiene estable el short link ya entregado.

## Endpoints

### `POST /v1/automation/generate-tracked-link`

Endpoint protegido para automatizacion interna.

Auth:

- Header: `x-api-key`
- Valor esperado: `N8N_WEBHOOK_SECRET`

Payload:

```json
{
  "leadId": "lead-id",
  "stepKey": "presentacion"
}
```

Respuesta relevante:

```json
{
  "leadId": "lead-id",
  "publicationId": "publication-id",
  "stepKey": "presentacion",
  "targetStep": {
    "path": "/presentacion"
  },
  "token": "signed-token",
  "longUrl": "https://example.com/presentacion?ctx=...",
  "shortUrl": null,
  "url": "https://example.com/presentacion?ctx=...",
  "shortened": false,
  "shortLinkProvider": "fallback_long_url",
  "cached": false,
  "trackedLinkId": "tracked-link-id",
  "shortCode": null,
  "whatsappUrl": "https://wa.me/..."
}
```

### `POST /v1/public/funnel-runtime/hydrate`

Endpoint publico para rehidratar contexto firmado en cliente.

Payload:

```json
{
  "ctx": "signed-token"
}
```

Respuesta relevante:

```json
{
  "publicationId": "publication-id",
  "targetStepPath": "/presentacion",
  "submissionContext": {
    "leadId": "lead-id",
    "assignment": {
      "ownershipKey": "lf_own_..."
    },
    "handoff": {
      "whatsappUrl": "https://wa.me/..."
    }
  }
}
```

Si `ctxTokenHash` corresponde a un `TrackedLink` no disponible, `hydrate` responde `410`:

```json
{
  "code": "TRACKED_LINK_UNAVAILABLE",
  "message": "This tracked link is no longer available."
}
```

Condiciones bloqueadas:

- `status = revoked`
- `status = expired`
- `status = deleted`
- `status = active` con `expiresAt` vencido

Si el `ctx` es legacy y no existe `TrackedLink`, la compatibilidad temporal permite hidratar como antes. Ese link legacy no incrementa contador y no puede ser revocado via `TrackedLink`.

## Revocacion y cleanup futuro

La API expone internamente `revokeTrackedLinksForLead(leadId, reason)` para preparar limpieza futura de leads basura.

Flujo previsto:

1. Un lead se marca como spam, basura o deleted.
2. El proceso interno llama `revokeTrackedLinksForLead(leadId, reason)`.
3. Los `TrackedLink` activos del lead pasan a `revoked`.
4. `metadataJson` conserva metadata previa y agrega `revokedAt` y `revokedReason`.
5. Cualquier `hydrate` posterior con esos links responde `410 TRACKED_LINK_UNAVAILABLE`.
6. No se borra el link ni se toca todavia `Lead`, `Assignment`, Kloser, n8n ni Runtime Context externo.

## Eventos futuros pendientes

Eventos propuestos para una fase posterior:

- `tracked_link_created`
- `tracked_link_reused`
- `tracked_link_hydrated`
- `tracked_link_revoked`
- `tracked_link_unavailable`

Por ahora la trazabilidad persistente queda en `TrackedLink` (`clickCount`, `lastClickedAt`, `status`, `metadataJson`) y no se emiten `DomainEvent` nuevos.

## Variables de entorno

Identidad:

- `IDENTITY_TOKEN_SECRET`: secreto HMAC para emitir y validar `ctx`.
- `IDENTITY_TOKEN_TTL_HOURS`: TTL del token. Default recomendado: `48`.

Runtime Context Ownership Upsert:

- `RUNTIME_CONTEXT_OWNERSHIP_UPSERT_ENABLED=false`
- `RUNTIME_CONTEXT_OWNERSHIP_UPSERT_URL=`
- `RUNTIME_CONTEXT_OWNERSHIP_UPSERT_PATH=/v1/ownership-context/upsert`
- `RUNTIME_CONTEXT_CENTRAL_BASE_URL`: base usada cuando no se define URL explicita.
- `RUNTIME_CONTEXT_CENTRAL_API_KEY`: API key usada por Runtime Context.

YOURLS:

- `YOURLS_API_URL`
- `YOURLS_SIGNATURE`

Si `YOURLS_API_URL` o `YOURLS_SIGNATURE` faltan, `ShortLinkProvider` devuelve `fallback_long_url`: no acorta, pero conserva la URL larga funcional.

## Comportamiento de WhatsApp

- El Ref corto se agrega automaticamente desde `ownershipKey`.
- El Ref visible usa los primeros 8 caracteres utiles y no expone el prefijo completo `lf_own_`.
- Si el template ya incluye `{{ownership.ref}}` o un `Ref:` visible, no se duplica.
- `content.whatsapp_message` en `hero_vsl_delayed_cta` permite configurar el mensaje del paso.
- `assigned_whatsapp` usa el asesor asignado/hidratado y no abre modal.
- Sin `ctx` o sin assignment real, el bloque usa fallback seguro: no debe forzar WhatsApp asignado sin contexto real.

## Limitaciones conocidas

- `resolve` server-side normaliza el path y no usa `ctx` como fuente SSR del lead. La rehidratacion efectiva ocurre client-side mediante `/hydrate`.
- El builder todavia no separa draft y published snapshot. Guardar/publicar puede mutar el `FunnelStep` activo que consume runtime.
- `FunnelStepHistory` es historial de cambios del paso, no una version publicada aislada.

## Troubleshooting

### `IDENTITY_TOKEN_SECRET_MISSING`

La API no puede emitir o validar `ctx`. Configurar `IDENTITY_TOKEN_SECRET` en el entorno del API y redeployar.

### HTML/404 de Next al generar o hidratar

La llamada esta pegando al host web en vez del API. Usar el host API real, por ejemplo:

- `https://api.leadflow.kuruk.in/v1/automation/generate-tracked-link`
- `https://api.leadflow.kuruk.in/v1/public/funnel-runtime/hydrate`

### `fallback_long_url`

YOURLS no esta configurado o fallo la llamada al proveedor. El enlace largo sigue siendo valido; configurar `YOURLS_API_URL` y `YOURLS_SIGNATURE` si se requiere short link.

### `assigned_whatsapp` no abre WhatsApp

Revisar:

- el link tiene `ctx`
- `/hydrate` responde OK
- el lead tiene `currentAssignment`
- el assignment tiene `ownershipKey`
- el sponsor asignado tiene telefono WhatsApp normalizable
- el bloque `hero_vsl_delayed_cta` tiene `behavior.cta_mode = assigned_whatsapp`
