# Tracked Identity Link Runtime v1

Fecha: 2026-05-30 (UTC)

## Objetivo

Documentar el runtime actual de enlaces identificados antes de iniciar la fase TrackedLink / ActionLink.

Esta fase ya permite construir un enlace publico hacia un paso del funnel con contexto firmado (`ctx`) y rehidratar el lead asignado para que el CTA `assigned_whatsapp` abra WhatsApp con el asesor correcto.

## Flujo implementado

1. El visitante envia el formulario publico.
2. `LeadCaptureAssignmentService` crea o reutiliza `Lead`.
3. La asignacion crea `Assignment` con `ownershipKey`.
4. El mensaje de WhatsApp agrega un Ref corto automatico derivado de `ownershipKey`.
5. El contexto del assignment puede enviarse a n8n y a Runtime Context Ownership Upsert si el feature flag esta activo.
6. n8n llama `POST /v1/automation/generate-tracked-link` con `leadId` y `stepKey`.
7. La API firma un `ctx` con `IDENTITY_TOKEN_SECRET` y devuelve una URL como `/presentacion?ctx=...`.
8. La web carga el paso publico y el cliente llama `POST /v1/public/funnel-runtime/hydrate`.
9. `hydrate` valida el token, reconstruye `submissionContext` y lo guarda en la sesion publica.
10. El bloque `hero_vsl_delayed_cta` con `behavior.cta_mode = assigned_whatsapp` usa el handoff hidratado.
11. El CTA abre WhatsApp del asesor asignado. No abre modal de captura.

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
  "longUrl": "https://example.com/presentacion?ctx=...",
  "shortUrl": null,
  "url": "https://example.com/presentacion?ctx=...",
  "shortened": false,
  "shortLinkProvider": "fallback_long_url",
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
