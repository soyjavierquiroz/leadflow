# Architecture v1

## Objetivo de esta fase

Dejar Leadflow listo para ejecutar su shell web, una API con dominio de negocio v1, persistencia real en PostgreSQL, expansion implementada para ownership/publicacion/templates, un runtime publico JSON-driven ya conectado a captura, assignment, reveal, handoff y tracking events v1, las primeras superficies privadas visibles del SaaS, auth real base por rol, operaciones mutativas iniciales tanto para `Team Admin` como para `Member`, una capa real de QR connect por sponsor/member sobre Evolution API usando backend e infraestructura interna como ruta principal, un bridge basico pero real hacia n8n con payload estructurado y persistencia de dispatch, recepción autenticada de señales entrantes para actualizar el estado operativo sin abrir todavía un inbox, y una capa pragmatica de workflows/reminders/playbooks para volver mas guiada la operación diaria sobre leads, sin tocar produccion.

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
- Renderer JSON-driven del funnel público con shell visual v2 y capa de adapters:
  - `hero`
  - `hook_and_promise`
  - `urgency_timer`
  - `social_proof`
  - `feature_grid`
  - `offer_pricing`
  - `faq`
  - `lead_capture_form`
  - `thank_you`
  - `thank_you_reveal`
  - `whatsapp_handoff_cta`
  - `sponsor_reveal_placeholder`
- Adapters públicos listos para asimilación de componentes reciclados:
  - `testimonial` / `testimonials`
  - `media` / `image`
- Compatibilidad mantenida por normalización:
  - `form_placeholder` -> `lead_capture_form`
  - `features` -> `feature_grid`
  - `offer` / `pricing` -> `offer_pricing`
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
- UI / Product Clarity Pass v1 sobre shells internos para reforzar contexto por rol, navegación operativa, KPIs más claros y copy menos técnico.
- Team operations v1 conectadas sobre `/team/*` con formularios y acciones para:
  - funnel instances
  - funnel publications
  - sponsors
  - rotation pool members
  - leads con filtros basicos, resumen operativo y timeline enriquecida
  - leads con reminders summary, playbook recomendado y proximo seguimiento visible
- Member operations v1 conectadas sobre `/member/*` con acciones para:
  - aceptar handoffs
  - mover estado simple de leads
  - editar perfil operativo del sponsor
  - pausar o reactivar disponibilidad
  - revisar detalle operativo del lead sin inbox
  - calificar, resumir, agendar follow-up y agregar notas
  - ver timeline consolidada por lead
  - priorizar follow-ups vencidos, del dia, proximos y sin fecha
  - ver playbook recomendado y siguiente accion efectiva
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
  - `lead_capture_form`
  - `sponsor_reveal_placeholder`
- Public Funnel Frontend v2 sobre el runtime actual para mejorar hero, CTA, formulario, thank-you, sponsor reveal y handoff sin cambiar el modelo JSON-driven.
- Lead Capture Form Block v1 como bloque declarativo de primera clase conectado al submit compuesto del runtime público.
- JSON Block Runtime Expansion v1 para soportar bloques comerciales reales y una normalización clara entre contrato JSON y markup.
- Component Assimilation v1 con registry de adapters en `apps/web/components/public-funnel/adapters` para desacoplar markup visual del contrato de `blocks_json` y preparar variantes de template futuras.
- JSON Compatibility Layer v1 para aceptar payloads con `template`, `ui_config`, `media_dictionary`, `hero_block` y `layout_blocks`, traducirlos al shape interno y renderizarlos con la misma registry pública.
- Template Presets / Block Variants v1 con presets declarativos en `apps/web/components/public-funnel/template-presets.ts` para resolver composición sugerida, defaults y variantes visuales sin duplicar el runtime.
- Compatible Block Expansion v2 para aceptar aliases más reales por bloque, nested CTA, shapes de media más ruidosos y mappings comerciales con mayor fidelidad.
- Recycled Component Intake v2 con capa `apps/web/components/public-funnel/recycled` para secciones comerciales reutilizables consumidas por los adapters públicos.
- Real JSON Intake Pack v1 con fixtures concretos en `apps/web/lib/public-funnel/intake-examples` para validar compatibilidad práctica end-to-end sobre payloads reales o casi reales.
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
- Reuso puntual de componentes internos dentro del funnel público cuando aportan claridad visual sin contaminar el runtime:
  - `section-header`
  - `kpi-card`
  - `status-badge`
- Capa browser-side de tracking para:
  - vistas de funnel y step
  - clicks de CTA
  - inicio y submit del formulario
  - entrada al thank-you con assignment
- Build preparado para contenedor con `output: standalone`.
- Fetch real a API cuando existe backend disponible y fallback controlado a mocks aislados para evitar romper shells en `build` o preview local.
- Compatibilidad actual mantenida por normalización/adapters:
  - `hero_block` -> `hero`
  - `video_block` -> `video`
  - `faq_accordion` -> `faq`
  - `offer_stack` -> `offer_pricing`
  - `features_and_benefits` / `how_it_works` -> `feature_grid`
  - `risk_reversal` -> `social_proof`
  - `final_cta` -> `cta`
  - `form_placeholder` -> `lead_capture_form`
- Compatibilidad v2 reforzada además para:
  - `stats` / `kpis` / `numbers`
  - `reviews` / `quotes` / `customers`
  - `faq_items` / `faqs`
  - `price_box`
  - `primary_cta` / `secondary_cta`
  - `video.embed_url`
- Intake pack real disponible para validación manual o seed:
  - `sales-audit-landing.json`
  - `advisor-opportunity-vsl.json`
  - `clinic-whatsapp-intake.json`
- Intake reciclado activo para:
  - `hero`
  - `hook_and_promise`
  - `social_proof`
  - `video`
  - `offer_pricing`
  - `faq`
- La landing demo actual usa directamente uno de los payloads intake reales del pack, manteniendo el mismo runtime público de Leadflow.
- Presets iniciales disponibles:
  - `landing_capture_v1`
  - `opportunity_vsl_v1`
  - `thank_you_reveal_v1`

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
- `IncomingWebhooksModule` para recibir señales entrantes autenticadas desde n8n/Evolution y reflejarlas en el dominio operativo.
- `LeadsModule` ampliado para timeline consolidada, notas manuales, calificación simple, reminders summary y playbooks derivados.
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
  - `incoming-webhooks`
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
- Endpoints incoming webhooks:
  - `POST /v1/incoming-webhooks/messaging`
  - `GET /v1/incoming-webhooks/messaging/signals?leadId=...`
- Endpoints lead qualification timeline:
  - `GET /v1/leads/:id/timeline`
  - `GET /v1/leads/reminders/summary`
  - `GET /v1/leads/:id/playbook`
  - `PATCH /v1/leads/:id/qualification`
  - `PATCH /v1/leads/:id/follow-up`
  - `POST /v1/leads/:id/notes`
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
- `ConversationSignal`
- `LeadNote`
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
- señales entrantes v1 autenticadas por secret, persistidas y aplicadas sobre lead/assignment con trazabilidad
- capa operativa de lead con calificación simple, notas manuales, next action, follow-up, reminders summary y playbooks simples por estado/calificacion

## Runtime publico v1

### Modelo de publicacion externa v1

- `team` puede tener multiples `domains`
- cada `domain` puede tener multiples `funnel_publications`
- `Domain.host` conserva el host configurado para UI y trazabilidad
- `Domain.normalizedHost` es la clave operativa para lookup server-side
- `Domain.status` mantiene el estado operativo para resolucion
- `Domain.onboardingStatus` modela el ciclo SaaS del domain
- `Domain.domainType` diferencia:
  - `system_subdomain`
  - `custom_apex`
  - `custom_subdomain`
- `Domain.isPrimary` marca el host principal del team
- `Domain.canonicalHost` y `Domain.redirectToPrimary` quedan como metadata de canonicalidad para la siguiente fase
- `Domain.verificationStatus`, `Domain.sslStatus`, `Domain.cloudflareCustomHostnameId`, `Domain.cloudflareStatusJson`, `Domain.dnsTarget` y `Domain.verificationMethod` cubren onboarding Cloudflare SaaS v1
- `Domain.dnsTarget` queda alineado al target público del cliente (`customers.<saas>`) y deja de representar el fallback origin
- `DomainSummary` expone `operationalStatus`, `isLegacyConfiguration`, `recreateRequired` y `legacyReason` para que la UI detecte registros heredados sin tratarlos como flujo sano
- `FunnelPublication.pathPrefix` se persiste normalizado y define el binding publico dentro del mismo host
- la unicidad operativa queda en `normalizedHost + pathPrefix`

### Cloudflare SaaS Domain Onboarding v1

Hostnames fijos del SaaS:

- `proxy-fallback.leadflow.kurukin.com`: origin fijo que Cloudflare usa para llegar al runtime
- `customers.leadflow.kurukin.com`: target DNS único que Leadflow entrega a clientes

Flujo:

1. el team registra el domain en `/team/domains`
2. Leadflow persiste el `Domain`
3. si hay configuración Cloudflare, la API crea o actualiza el custom hostname
4. Leadflow devuelve un `CNAME target` único para el flujo principal
5. Cloudflare edge termina TLS del hostname del cliente y reenvía al `fallback origin`
6. `Refresh` reimpulsa la validación y consulta del custom hostname
7. si el registro quedó con `dnsTarget` o `custom_origin_server` legado, Leadflow lo marca `legacy` y `recreate required`
8. `Recreate onboarding` elimina el custom hostname viejo, crea uno nuevo bajo el flujo actual y regenera `dnsTarget`
9. cuando hostname + SSL quedan en `active` y el target coincide con `customers.leadflow.kurukin.com`, el domain pasa a operación

La UI devuelve:

- hostname solicitado
- domain type
- CNAME target único
- estado Cloudflare
- estado SSL
- last sync
- acciones `Editar`, `Eliminar`, `Refresh` y `Recrear onboarding`
- badges `legacy` y `recreate required` cuando aplica

Estados v1:

- `onboardingStatus`: `draft`, `pending_dns`, `pending_validation`, `active`, `error`
- `verificationStatus`: `unverified`, `pending`, `verified`, `failed`
- `sslStatus`: `unconfigured`, `pending`, `active`, `failed`

Reglas por tipo:

- `custom_subdomain`: flujo principal por `CNAME` hacia el target SaaS
- `custom_apex`: onboarding modelado y documentado; la activación final depende de soporte real de apex proxying
- `system_subdomain`: host gestionado internamente por Leadflow
- nunca se expone `proxy-fallback.leadflow.kurukin.com` como target DNS del cliente; ese host queda solo como origin interno de Cloudflare

### Resolucion `host + path`

El runtime publico sigue estas reglas:

1. normalizar el `host` entrante y buscar `Domain.normalizedHost` exacto
2. normalizar el `path` entrante hacia un `pathPrefix` comparable
3. considerar solo domains activos, publicaciones activas e instancias activas
4. tomar las publicaciones cuyo `pathPrefix` sea prefijo valido del request
5. elegir longest-prefix-match
6. si existe publicacion activa en `/`, funciona como fallback natural
7. si no hay match, responder `404`

Precedencia:

- mismo host siempre gana sobre cualquier otro host porque el lookup es exacto
- dentro del host, `/oportunidad/webinar` gana sobre `/oportunidad`
- dentro del host, `/oportunidad` gana sobre `/`
- no se permiten duplicados del mismo `host + pathPrefix`

### Resolucion de step

Una vez resuelta la `FunnelPublication`:

- el path base de la publicacion carga el `entry step`
- una subruta relativa dentro de esa publicacion intenta resolver `step.slug`
- si el step no existe, la API responde `404`

### Contrato web/api

- La web pide el runtime por `host + path`.
- La API devuelve dominio, publicacion, funnel, template, tracking efectivo, handoff efectivo, step actual y navegacion de steps.
- La web renderiza `blocks_json` del step actual.
- Cuando el step contiene `lead_capture_form` (o el alias legacy `form_placeholder`), la web ejecuta un submit publico que:
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
  - `leadflow.kurukin.com` -> `web` (router explícito)
  - `api.leadflow.kurukin.com` -> `api` (router explícito)
  - `HostRegexp({host:.+})` -> `web` (router catch-all público)
- El catch-all sirve:
  - `customers.leadflow.kurukin.com`
  - `proxy-fallback.leadflow.kurukin.com`
  - cualquier custom hostname proxied desde Cloudflare
- No se agregan dominios cliente uno por uno al stack.

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

Arquitectura lista para una siguiente fase de timeline más rica, workflows activos sobre n8n y sincronización de mensajería más profunda, sin rehacer ni el lifecycle base de Evolution ni el bridge ya persistido de automation.
