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
