# FunnelEvent Runtime Verification

Fecha: 2026-05-30 UTC

## Alcance

Verificación runtime real de FunnelEvent como ledger interno para eventos de TrackedLink y VSL granular.

Esta verificación confirma que los eventos observados alimentan `FunnelEvent` como ledger interno/journey y no activan Ads paid, CAPI, Kloser, n8n ni routing externo.

## Deploy verificado

- API/Web tag: `20260530_214435`
- Migración aplicada: `20260530190000_add_funnel_event_model`
- Tabla verificada: `FunnelEvent` existe

## Datos usados

- Lead usado: `a2b51af1-2f92-401f-9f6f-ea08894d5b6d`
- trackedLinkId: `3ccca2b2-03b7-4f45-82f6-f32d8868c760`
- URL probada: `/presentacion?ctx=...`
- `trafficLayer` observado: `ORGANIC`

## Eventos observados

Se observaron los siguientes eventos en `FunnelEvent`:

- `tracked_link_reused`
- `tracked_link_opened`
- `vsl_started`
- `vsl_cta_revealed`
- `vsl_cta_clicked`

Resultado esperado resumido:

- Los eventos quedan persistidos en `FunnelEvent`.
- `trafficLayer` queda como `ORGANIC`.
- Los eventos VSL se registran como journey interno, no como Ads paid.
- No aparecen eventos `vsl_progress_25`, `vsl_progress_50`, `vsl_progress_75` ni `vsl_completed` cuando `durationSeconds` es `null`.

## Progress y completion

No aparecieron eventos de progress/completed porque `durationSeconds` fue `null`.

Para que el runtime web pueda calcular porcentaje y completion, se debe configurar duración en el bloque VSL con alguno de estos campos:

- `duration_seconds`
- `durationSeconds`
- `video_duration_seconds`
- `videoDurationSeconds`

Sin duración conocida, el runtime no inventa la duración del video y solo emite eventos que no dependen de porcentaje:

- `vsl_started`
- `vsl_cta_revealed`
- `vsl_cta_clicked`

## Queries SQL usadas

### Verificar tabla

```sql
SELECT to_regclass('"FunnelEvent"') AS funnel_event_table;

Resultado esperado:

funnel_event_table
------------------
FunnelEvent
Consultar eventos por lead o trackedLink
SELECT
  id,
  "eventId",
  "eventName",
  "eventFamily",
  source,
  "trafficLayer",
  "leadId",
  "trackedLinkId",
  "funnelPublicationId",
  "funnelStepId",
  "dedupeKey",
  "payloadJson",
  "occurredAt",
  "receivedAt"
FROM "FunnelEvent"
WHERE "leadId" = 'a2b51af1-2f92-401f-9f6f-ea08894d5b6d'
   OR "trackedLinkId" = '3ccca2b2-03b7-4f45-82f6-f32d8868c760'
ORDER BY "receivedAt" ASC;

Resultado esperado resumido:

Filas para tracked_link_reused y tracked_link_opened asociadas al trackedLinkId.
Filas para vsl_started, vsl_cta_revealed y vsl_cta_clicked asociadas al journey del lead/visitor.
trafficLayer = 'ORGANIC'.
payloadJson.durationSeconds ausente o null en eventos VSL observados.
Sin filas de progress/completed mientras no exista duración configurada en el bloque.
Troubleshooting
FunnelEvent no existe

Aplicar migraciones en el entorno:

pnpm --filter @leadflow/api prisma migrate deploy

Luego repetir la query de verificación de tabla.

No aparecen eventos VSL

Revisar en el navegador la llamada de red:

POST /v1/public/funnel-runtime/vsl-events

Validar que responde correctamente y que el payload incluye al menos:

eventName
publicationId
stepId
sessionId o anonymousId
No aparecen progress/completed

Revisar que el bloque hero_vsl_delayed_cta tenga duración configurada con alguno de estos campos:

duration_seconds
durationSeconds
video_duration_seconds
videoDurationSeconds

Si la duración llega como null, el runtime no emite milestones ni completion.