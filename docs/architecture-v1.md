# Architecture v1

## Objetivo de esta fase

Dejar Leadflow listo para ejecutar su shell web, una API con dominio de negocio v1, persistencia real en PostgreSQL, expansion implementada para ownership/publicacion/templates, un runtime publico JSON-driven ya conectado a captura, assignment, reveal, handoff y tracking events v1, las primeras superficies privadas visibles del SaaS, auth real base por rol, operaciones mutativas iniciales tanto para `Team Admin` como para `Member`, una capa real de QR connect por sponsor/member sobre Evolution API usando backend e infraestructura interna como ruta principal, y un bridge basico pero real hacia n8n con payload estructurado y persistencia de dispatch, sin tocar produccion.

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
- Login real en `/login`.
- Capa auth server-first en `apps/web/lib/auth.ts`.
- Proteccion de rutas privada por layout:
  - `/admin/*` -> `SUPER_ADMIN`
  - `/team/*` -> `TEAM_ADMIN`
  - `/member/*` -> `MEMBER`
- Redirects por rol despues de login y cuando un usuario intenta entrar a una superficie ajena.
- Capa server-side para app shells en `apps/web/lib/app-shell`.
- Team operations v1 conectadas sobre `/team/*` con formularios y acciones para:
  - funnel instances
  - funnel publications
  - sponsors
  - rotation pool members
  - leads con filtros basicos
- Member operations v1 conectadas sobre `/member/*` con acciones para:
  - aceptar handoffs
  - mover estado simple de leads
  - editar perfil operativo del sponsor
  - pausar o reactivar disponibilidad
  - revisar detalle basico del lead sin inbox
- Messaging integrations v1 conectadas sobre `/member/channel` para:
  - ver estado actual de la conexion WhatsApp del sponsor
  - conectar o reprovisionar una instancia en Evolution
  - pedir y refrescar QR real
  - refrescar estado del canal
  - resetear la conexión
  - desconectar el canal
  - preparar webhook base para futura orquestacion con n8n
  - hacer polling simple mientras el estado esta en `provisioning`, `qr_ready` o `connecting`
  - visualizar readiness del bridge de automation y los ultimos dispatches persistidos
- Islas cliente puntuales para:
  - `form_placeholder`
  - `sponsor_reveal_placeholder`
- Reveal & handoff v1 sobre el runtime publico:
  - reveal del sponsor asignado en thank-you
  - CTA a WhatsApp con mensaje prellenado
  - redirect automatico cuando el handoff efectivo es `immediate_whatsapp`
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
- `AuthModule` con login, logout, `me`, sesiones persistidas y guards por rol.
- Endpoints mutativos iniciales para operacion de `Team Admin`.
- Endpoints privados adicionales para operacion de `Member`.
- `MessagingIntegrationsModule` con adaptador Evolution API usando URL interna como ruta principal y fallback público opcional.
- `MessagingAutomationModule` con bridge webhook hacia n8n, payload snapshot y persistencia del resultado por assignment.
- Contrato publico enriquecido para reveal/handoff en runtime y submit.
- Modulos disponibles:
  - `auth`
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
  - `messaging-integrations`
  - `messaging-automation`
- Endpoints auxiliares adicionales para UI operativa:
  - `GET /v1/tracking-profiles`
  - `GET /v1/handoff-strategies`
  - `GET /v1/rotation-pools/members`
- Endpoints mutativos iniciales de team operations:
  - `POST /v1/funnel-instances`
  - `PATCH /v1/funnel-instances/:id`
  - `POST /v1/funnel-publications`
  - `PATCH /v1/funnel-publications/:id`
  - `PATCH /v1/sponsors/:id`
  - `PATCH /v1/rotation-pools/members/:memberId`
- Endpoints member operations:
  - `GET /v1/sponsors/me`
  - `PATCH /v1/sponsors/me`
  - `GET /v1/leads?status=...`
  - `GET /v1/leads/:id`
  - `PATCH /v1/leads/:id`
  - `GET /v1/assignments?status=...`
  - `PATCH /v1/assignments/:id`
- Endpoints messaging integrations:
  - `GET /v1/messaging-integrations/me`
  - `POST /v1/messaging-integrations/me/connect`
  - `POST /v1/messaging-integrations/me/qr`
  - `POST /v1/messaging-integrations/me/refresh`
  - `POST /v1/messaging-integrations/me/reset`
  - `POST /v1/messaging-integrations/me/disconnect`
- Endpoints messaging automation:
  - `GET /v1/messaging-automation/me`
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
- Endpoints auth:
  - `POST /v1/auth/login`
  - `POST /v1/auth/logout`
  - `GET /v1/auth/me`
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
- `User`
- `AuthSession`
- `MessagingConnection`
- `AutomationDispatch`
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
- reveal y handoff visible a WhatsApp usando estrategia efectiva por funnel/publicacion
- tracking events v1 con `eventId` y contexto de funnel/step
- autenticacion real por cookie HttpOnly con sesiones persistidas en DB
- autorizacion base por rol sobre API y superficies privadas
- operacion mutativa inicial del team sin tocar templates ni JSON estructural
- operacion mutativa inicial del member sobre sponsor, leads y assignments propios
- canal de mensajeria real por sponsor para WhatsApp con estado persistido y ownership por member
- adaptador v1 de Evolution API con retries, timeout y control de instancia por backend
- routing interno preferente hacia Evolution con fallback público opcional
- lifecycle completo de QR connect: ensure, create, webhook, qr, refresh, reset y disconnect
- bridge v1 hacia n8n disparado tras una asignacion nueva, con persistencia de payload, respuesta y error

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
  - devuelve contexto de reveal/handoff
  - guarda contexto local para el thank-you
- Cuando el step contiene `sponsor_reveal_placeholder`, la web:
  - revela el sponsor asignado con datos visibles seguros
  - arma el CTA a WhatsApp
  - redirige automaticamente si el handoff mode lo exige
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
- Inbox conversacional para members.
- Editor libre de templates para teams.
- Automatizacion avanzada con n8n, workers o routers complejos de webhook.
- Respuestas automaticas avanzadas y logica de conversacion.
- Redis o colas dedicadas para mensajeria.
- SSO, MFA, password reset y gestion avanzada de usuarios.
- Permisos finos por recurso o policy engine.
- Logica compleja de asignacion.
- Editor visual completo para teams.
- Invites.

## Estado

Arquitectura lista para una siguiente fase de workflows activos sobre n8n, webhooks entrantes y mensajeria operativa mas rica, sin rehacer ni el lifecycle base de Evolution ni el bridge ya persistido de automation.
