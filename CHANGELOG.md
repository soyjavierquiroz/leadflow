# Changelog

## 2026-05-22 - AI gateway deep block mapping

### Arquitectura de configuracion de IA

- Se separo la edicion de configuracion IA por alcance:
  - Configuracion personal del member/sponsor en `GET/PATCH /v1/ai-config/me`.
  - Configuracion de equipo/tenant en `GET/PATCH /v1/ai-config/team`, restringida a `TEAM_ADMIN`.
- Se agrego `UpdateTeamAiConfigDto` para aislar el contrato de escritura team-level y se restringio `UpdateMyAiConfigDto` para impedir claves `kloser` y `kloser_config` en configuraciones personales.
- `AiConfigService` ahora resuelve configuraciones tenant con prioridad semantica: primero prompts custom, luego prompts validos no vacios, y por ultimo el fallback disponible.
- La estrategia Kloser queda consolidada como politica de tenant. Las configuraciones personales pueden seguir aportando prompt, route contexts, CTA y AI policy, pero las claves Kloser se omiten al fusionar runtime para evitar sobrescrituras accidentales del equipo.
- El runtime de IA ahora expone `basePrompt`, `base_prompt` y `config_version` tanto en el objeto raiz como en `ai_agent`, permitiendo trazabilidad exacta de la version de configuracion usada por cada resolucion.

### Resolucion runtime para gateway y n8n

- `POST /v1/ai-config/resolve-full` acepta `instance_name`, `instance_id` como alias y `tenant_id` opcional para resolver instancias WhatsApp por tenant.
- La resolucion prioriza `MessagingConnection` cuando se recibe `tenant_id`, evitando que un `ChannelInstance` obsoleto capture un tenant incorrecto.
- Se agrego un flujo de bypass tenant-level cuando existe una configuracion IA directa para el `tenant_id`, construyendo el runtime con prompt custom, metadata de ruteo, wallet context y payload Kloser sin depender de una instancia legacy.
- El `config_version` se construye con ids y `updatedAt` de las configuraciones tenant/member, o con la version directa `ai-agent-config:<id>:<updatedAt>` para bypass tenant.

### Cache de configuracion tenant

- Se introdujo `TenantConfigCacheService` para purgar caches Redis de configuracion tenant cuando se crean o actualizan configuraciones IA.
- Nuevas variables de entorno en API y Swarm:
  - `REDIS_URL`
  - `TENANT_CONFIG_CACHE_KEY_PREFIX`
  - `REDIS_CACHE_TIMEOUT_MS`
- La purga es tolerante a fallos: errores de conexion, autenticacion, seleccion de DB o timeout se registran como warning sin bloquear la escritura principal.

### Lead dispatcher y automatizacion de mensajes

- `LeadDispatcherService` y `MessagingAutomationService` ahora adjuntan `runtime_config` y `config_version` a los payloads emitidos.
- Los master payloads de Kloser incluyen la misma version de configuracion y el runtime usado para el disparo, alineando trazabilidad entre dispatcher, automatizacion y downstream flows.
- La seleccion de `AiAgentConfig` tenant deja de depender de `updatedAt desc` y aplica la misma prioridad de prompt custom sobre default.
- El runtime embebido en eventos incluye prompt base, routing WhatsApp, metadata tenant (`vertical_key`, `brand_key`, `business_model_type`), member identity, CTA policy, route contexts, AI policy y config Kloser resuelta.

### Runtime publico de embudos y frontend

- El runtime publico en `apps/web/app/(site)/[[...slug]]/page.tsx` sanitiza metadata SEO heredada de Bolt, descartando titulos, descripciones, favicons y Open Graph images vacios o contaminados por `bolt.new`.
- La resolucion SEO ahora valida URLs de imagen/favicons y permite leer metadata desde publication, step SEO/settings y funnel SEO/settings antes de usar el host como fallback.
- La UI de configuracion IA envia `basePrompt` al guardar settings de equipo y combina el prompt team-level con el snapshot personal para que el formulario muestre el prompt efectivo correcto.

### Runtime Context sync

- `RuntimeContextConfigSyncService` usa la misma prioridad de configuracion tenant custom antes de sincronizar contextos de funnel.
- La metadata runtime sincronizada mantiene coherencia con la seleccion de prompt y politicas aplicada por el gateway IA.

### Pruebas y cobertura

- Se ampliaron specs de `AiConfigService`, `AiConfigController` y `LeadDispatcherService` para cubrir:
  - rechazo de Kloser en configuracion personal;
  - escritura y merge de Kloser en configuracion tenant;
  - prioridad de prompt custom aunque el default sea mas reciente;
  - resolucion por `tenant_id` y `MessagingConnection`;
  - propagacion de `runtime_config` y `config_version`.
- La spec de `public-funnel-runtime.service` fue retirada del path activo y conservada como `.bak` para revision posterior.
