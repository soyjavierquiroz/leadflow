# Architecture v1

## Objetivo de esta fase
Dejar Leadflow listo para ejecutar su shell web, una API con dominio de negocio v1, persistencia real en PostgreSQL, expansion implementada para ownership/publicacion/templates, un runtime publico JSON-driven ya conectado a captura, assignment y tracking events v1, y las primeras superficies privadas visibles del SaaS, sin tocar produccion.

## Componentes

### Frontend (`apps/web`)
- Next.js App Router.
- Segmentos:
  - `/(site)`
  - `/(admin)`
  - `/(team)`
  - `/(member)`
  - `/(members)` solo como redirect legacy hacia `/member`
- Runtime publico en `/(site)/[[...slug]]`.
- Resolucion de host por request y preview opcional con `?previewHost=...` solo en desarrollo.
- Renderer JSON-driven MVP para bloques de funnel:
  - `hero`
  - `text`
  - `video`
  - `cta`
  - `faq`
  - `form_placeholder`
  - `thank_you`
  - `sponsor_reveal_placeholder`
- `not-found` limpio para funnels/publicaciones no resueltos.
- Config publica centralizada en `apps/web/lib/public-env.ts`.
- Capa server-side para app shells en `apps/web/lib/app-shell`.
- Islas cliente puntuales para:
  - `form_placeholder`
  - `sponsor_reveal_placeholder`
- App shells visibles para:
  - `Super Admin`
  - `Team Admin`
  - `Sponsor / Member`
- Componentes UI reutilizables base:
  - sidebar
  - top bar
  - section header
  - KPI cards
  - data tables
  - empty states
  - status badges
  - cards de sponsor y publicacion
- Capa browser-side de tracking para:
  - vistas de funnel y step
  - clicks de CTA
  - inicio y submit del formulario
  - entrada al thank-you con assignment
- Build preparado para contenedor con `output: standalone`.
- Fetch real a API cuando existe backend disponible y fallback controlado a mocks aislados para evitar romper shells en `build` o preview local.

### Backend (`apps/api`)
- NestJS + Fastify.
- Config runtime centralizada en `apps/api/src/config/runtime.ts`.
- Prefijo global configurable (`API_GLOBAL_PREFIX`, default `v1`).
- `GET /health` sin prefijo global.
- CORS preparado para hosts web objetivo.
- Prisma integrado como adapter de persistencia.
- `PrismaModule` global con `PrismaService`.
- `DomainModule` como agregador de dominio.
- `PublicFunnelRuntimeModule` para lectura publica de funnels publicados.
- `LeadCaptureAssignmentService` dentro del runtime publico para submit compuesto.
- `TrackingEventsService` para tracking browser/server y utilidades operativas.
- Modulos disponibles:
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
- Endpoints publicos de runtime:
  - `GET /v1/public/funnel-runtime/resolve`
  - `GET /v1/public/funnel-runtime/publications/:publicationId`
  - `GET /v1/public/funnel-runtime/publications/:publicationId/steps/:stepSlug`
- Endpoints publicos de captura:
  - `POST /v1/public/funnel-runtime/visitors`
  - `POST /v1/public/funnel-runtime/leads`
  - `POST /v1/public/funnel-runtime/assignments/auto`
  - `POST /v1/public/funnel-runtime/submissions`
- Endpoints publicos de tracking:
  - `POST /v1/public/funnel-runtime/events`
- Endpoints minimos de validacion expuestos para `workspaces`, `sponsors`, `leads`, `rotation-pools`, `domains`, `funnel-templates`, `funnel-instances` y `funnel-publications`.
- Endpoints de lectura ampliados para operacion:
  - `GET /v1/leads?sponsorId=...`
  - `GET /v1/leads?funnelPublicationId=...`
  - `GET /v1/assignments`
  - `GET /v1/assignments?sponsorId=...`
  - `GET /v1/assignments?funnelPublicationId=...`
  - `GET /v1/events`
  - `GET /v1/events?leadId=...`
  - `GET /v1/events?funnelPublicationId=...`

### Shared packages
- `packages/config`: helpers simples de configuracion (`splitCsv`, `normalizeUrl`, `toNumber`).
- `packages/types`: tipos base de dominio y de configuracion.
- `packages/ui`: placeholder de componentes compartidos.

## Capa de dominio actual
El dominio operativo actual se apoya en:
- `Workspace`
- `Team`
- `Sponsor`
- `RotationPool`
- `RotationMember`
- `Funnel` legacy
- `Domain`
- `FunnelTemplate`
- `FunnelInstance`
- `FunnelStep`
- `FunnelPublication`
- `TrackingProfile`
- `ConversionEventMapping`
- `HandoffStrategy`
- `Visitor`
- `Lead`
- `Assignment`
- `DomainEvent`

## Expansion implementada
La arquitectura ya implementa:
- ownership operativo real en `Team`
- publicacion por `host + path`
- separacion entre `FunnelTemplate` y `FunnelInstance`
- modelado de steps tipados para runtime JSON-driven
- configuracion declarativa de tracking y handoff
- compatibilidad transicional con `Funnel` legacy
- runtime publico de solo lectura para resolver funnel publicado + step activo
- captura publica v1 con visitor, lead, assignment y domain events
- tracking events v1 con `eventId` y contexto de funnel/step

## Runtime publico v1

### Resolucion `host + path`
El runtime publico sigue estas reglas:
- match exacto por `host`
- normalizacion de path
- solo publicaciones activas
- gana la ruta mas especifica
- fallback operativo a `/` si la publicacion root activa aplica

### Resolucion de step
Una vez resuelta la `FunnelPublication`:
- el path base de la publicacion carga el `entry step`
- una subruta relativa dentro de esa publicacion intenta resolver `step.slug`
- si el step no existe, la API responde `404`

### Contrato web/api
- La web pide el runtime por `host + path`.
- La API devuelve dominio, publicacion, funnel, template, tracking efectivo, handoff efectivo, step actual y navegacion de steps.
- La web renderiza `blocks_json` del step actual.
- Cuando el step contiene `form_placeholder`, la web ejecuta un submit publico que:
  - registra o actualiza `Visitor`
  - crea o actualiza `Lead`
  - resuelve assignment simple por round robin
  - guarda contexto local para el thank-you
- La web emite eventos browser del runtime a la API.
- La API persiste eventos browser y server sobre `DomainEvent`.

Decision de transicion:
- `Funnel` se mantiene para compatibilidad
- `FunnelInstance.legacyFunnelId` enlaza el modelo nuevo con el anterior
- `Lead` y `Assignment` conservan `funnelId` y agregan referencias opcionales a `funnelInstanceId` y `funnelPublicationId`

## Infraestructura de ejecucion v1

### Desarrollo local con contenedores
- Compose: `infra/docker/docker-compose.dev.yml`
- Servicios:
  - `postgres`
  - `web`
  - `api`
- Red:
  - `leadflow_core`

### Baseline Swarm (futuro deploy)
- Stack: `infra/swarm/docker-stack.yml`
- Servicios:
  - `web`
  - `api`
- Redes:
  - `traefik_public` (externa)
  - `leadflow_core`
  - `leadflow_automation` (placeholder)
- Routing Traefik por host:
  - `exitosos.com` -> `web`
  - `members.exitosos.com` -> `web`
  - `admin.exitosos.com` -> `web`
  - `api.exitosos.com` -> `api`

## Fuera de alcance en esta fase
- Deploy real en servidor.
- DNS real aplicado.
- Integracion real con Meta o TikTok.
- Handoff real con WhatsApp.
- Editor libre de templates para teams.
- Redis, n8n o Evolution.
- Auth real.
- Logica compleja de asignacion.
- Editor visual completo para teams.

## Estado
Arquitectura lista para la siguiente fase de auth real, permisos por superficie, acciones mutativas sobre app shells y evolucion de los read models operativos, todavia sin cambios en produccion.
