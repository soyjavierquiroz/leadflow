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

### Runtime Context local es Resolver-Only

La imagen `runtime-context-service:local` usada en este entorno no expone rutas
de escritura ni administración para crear `channel_bindings`. En consecuencia:

- `POST /v1/admin/channel-bindings/upsert` devuelve `404`
- `POST /admin/channel-bindings/upsert` también devuelve `404`
- el módulo `EvolutionModule` hace bypass deliberado del registro y solo emite
  un `Logger.warn(...)` para no bloquear la entrega del QR

Implicación operativa:

- si se necesita que el runtime-context resuelva una nueva instancia en local,
  el binding debe sembrarse manualmente en Postgres hasta que exista una imagen
  con API administrativa

### Seed manual recomendado

El tenant operativo validado en Leadflow para este flujo fue:

- `tenant_id = 7b7b2877-3353-4972-ba6f-bc5f1627f24a`
- `team = DXN - Freddy Ramos Catunta`
- `instance_name = lf-dxn-freddy`

Ejemplo de `INSERT` manual para el runtime-context local:

```sql
INSERT INTO platform_tenants (
  tenant_id,
  tenant_key,
  display_name,
  app_key,
  platform_key,
  product_key,
  status
)
VALUES (
  '7b7b2877-3353-4972-ba6f-bc5f1627f24a',
  'dxn-freddy-ramos-catunta',
  'DXN - Freddy Ramos Catunta',
  'leadflow',
  'kurukin',
  'leadflow',
  'active'
)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO channel_bindings (
  binding_id,
  provider,
  channel,
  instance_name,
  number_id,
  tenant_id,
  vertical_key,
  service_owner_key,
  wallet_external_ref,
  wallet_tenant_id,
  wallet_owner_login,
  status
)
VALUES (
  gen_random_uuid(),
  'evolution',
  'whatsapp',
  'lf-dxn-freddy',
  NULL,
  '7b7b2877-3353-4972-ba6f-bc5f1627f24a',
  'mlm',
  'lead-handler',
  NULL,
  NULL,
  NULL,
  'active'
);
```

Después del seed manual, el resolver ya puede ubicar la instancia usando
`provider=evolution`, `channel=whatsapp` e `instance_name=lf-dxn-freddy`.
