# @leadflow/api

Backend base de Leadflow con NestJS + Fastify.

## Endpoints iniciales
- `GET /health` (sin prefijo global)
- Prefijo global para modulos de API: `/<API_GLOBAL_PREFIX>` (default `v1`)

## Modulos disponibles
- `workspaces`
- `teams`
- `sponsors`
- `funnels`
- `domains`
- `funnel-templates`
- `funnel-instances`
- `funnel-steps`
- `funnel-publications`
- `tracking-profiles`
- `handoff-strategies`
- `conversion-event-mappings`
- `rotation-pools`
- `visitors`
- `leads`
- `assignments`
- `events`
- `ad-wheels`

## Ad Wheels

La rueda pagada ya opera con un ciclo ponderado infinito y cursor transaccional.

- `seatCount` funciona como peso dentro de la secuencia, no como inventario consumible.
- `currentTurnPosition` apunta al siguiente turno de `AdWheelTurn` que debe evaluarse.
- `sequenceVersion` permite regenerar la secuencia cuando cambian participantes o pesos sin mezclar turnos viejos y nuevos.
- la reserva del siguiente turno se serializa con `FOR UPDATE` en la transaccion de captura publica.

Documentacion tecnica completa:

- [`docs/ad-wheels.md`](../../docs/ad-wheels.md)

## Persistencia actual
- Prisma integrado con schema en `prisma/schema.prisma`.
- PostgreSQL como datasource objetivo.
- Seed disponible en `prisma/seed.js`.
- Compatibilidad transicional con `Funnel` legacy.

## Endpoints minimos
- `GET /v1/workspaces`
- `GET /v1/sponsors`
- `GET /v1/leads`
- `GET /v1/rotation-pools`
- `GET /v1/domains`
- `GET /v1/funnel-templates`
- `GET /v1/funnel-instances`
- `GET /v1/funnel-publications`

## Knowledge / RAG

Endpoints operativos:

- `GET /v1/knowledge/list?tenant_id=<uuid>`
- `GET /v1/knowledge/audit?tenant_id=<uuid>`
- `POST /v1/knowledge/upload`
- `DELETE /v1/knowledge/:id?tenant_id=<uuid>`

La ingesta RAG acepta `multipart/form-data` y reenvia el PDF al webhook interno de n8n. Como ese webhook ahora es multi-stack, el cliente debe enviar `platform_key` y `product_key` en el multipart junto con `tenant_id`, `file_name`, `file` y metadatos de costo como `training_cost_kredits`.

`KnowledgeService` conserva los metadatos no reservados y los pasa a n8n para que el workflow resuelva el stack correcto. Para borrado fisico, `deleteDocumentById()` llama Runtime Context Central con `DELETE /v1/knowledge/:document_id?tenant_id=<uuid>` y sin body JSON.

## Kredits Admin

Leadflow ya incluye una superficie administrativa de Kredits consumida por la
UI de `/admin/kredits`.

Endpoints operativos:

- `GET /v1/system/kredits/directory`
- `POST /v1/system/kredits/injections`

Contrato de `POST /v1/system/kredits/injections`:

- `targetType`: `team` o `sponsor`
- `targetId`: id del `Team` o `Sponsor`
- `amountDecimal`: string decimal
- `reason` opcional
- `note` opcional

Ejemplo de request:

```json
{
  "targetType": "sponsor",
  "targetId": "8d0d3d3f-1111-2222-3333-444444444444",
  "amountDecimal": "3.500000",
  "reason": "manual top-up",
  "note": "support case"
}
```

### Cambio critico de contrato en wallet-engine

El `wallet-engine` de Kurukin recibe montos como decimal string, no como
minor units crudos.

Regla correcta:

- `amount: "3.000000"` con `unit_code=KREDIT` y `unit_scale=6` acredita 3 Kredits

Regla incorrecta:

- `amount: "3000000"` con `unit_scale=6` no significa 3 Kredits
- significa `3000000.000000`

Por eso Leadflow ahora normaliza todos los montos KREDIT antes de invocar el
engine y evita enviar enteros de minor units como payload externo.

## Configuracion por entorno
Definida en `src/config/runtime.ts`.

Variables soportadas:
- `APP_ENV`
- `APP_BASE_DOMAIN`
- `API_NAME`
- `API_VERSION`
- `API_HOST`
- `API_PORT`
- `API_GLOBAL_PREFIX`
- `API_BASE_URL`
- `DATABASE_URL`
- `SITE_URL`
- `MEMBERS_URL`
- `ADMIN_URL`
- `CORS_ALLOWED_ORIGINS`

## Scripts operativos

- `pnpm ad-wheels:force-migrate`: aplica manualmente la migracion del ciclo infinito si el entorno necesita un replay controlado.
- `pnpm qa:wipe-test-environment`: limpia leads, assignments, eventos de dominio y turnos de rueda; ademas resetea `currentTurnPosition` y `sequenceVersion` en ruedas activas para QA.

## OBSERVACIONES SRE

### Runtime Context admin API activa

Leadflow ya administra el ciclo de vida de `channel_bindings` directamente
contra Runtime Context:

- `POST /v1/admin/channel-bindings/upsert` durante `connect`
- `DELETE /v1/admin/channel-bindings/{instanceName}` durante `restart` o
  desconexión

Contrato aplicado por `EvolutionModule`:

- `provider = evolution`
- `channel = whatsapp`
- `service_owner_key = lead-handler`
- `source_system = leadflow`
- `vertical_key = user.team.vertical || "unknown"`

Autenticación interna usada por la API:

- `x-internal-api-key: <RUNTIME_CONTEXT_CENTRAL_API_KEY>`
- `x-service-key: leadflow_api`

Implicación operativa:

- ya no se requieren `INSERT` manuales para crear o limpiar bindings de
  WhatsApp desde Leadflow
