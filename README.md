# Leadflow

Leadflow es una plataforma SaaS para captacion, asignacion y automatizacion de leads.

## Estado actual (v1 base)

La base del monorepo ya incluye:

- Shell funcional de `web` (site, members, admin).
- Shell funcional de `api` (NestJS + Fastify + health).
- Foundation de dominio v1 en `apps/api` con modulos, DTOs e interfaces.
- Persistence Foundation v1 con PostgreSQL + Prisma en `apps/api`.
- Expansion v2 implementada para ownership, publicacion, templates, tracking y handoff.
- Public Funnel Runtime v1 en `apps/web` y `apps/api`.
- Lead Capture & Assignment Flows v1 conectados al runtime publico.
- Tracking Events v1 sobre runtime, capture y assignment.
- App Shells + UI Base v1 para `Super Admin`, `Team Admin` y `Sponsor / Member`.
- UI / Product Clarity Pass v1 con shells internos más claros, más operativos y menos abstractos en `admin`, `team` y `member`.
- Roles & Auth v1 con login real, sesión segura y protección base por superficie.
- Public Funnel Frontend v2 con shell pública más sólida, mejor jerarquía visual, mejor lectura móvil y flujo más coherente entre landing, captura, thank-you y reveal.
- Component Assimilation v1 con adapters públicos listos para absorber componentes reciclados sin rehacer el runtime.
- Lead Capture Form Block v1 con formulario declarativo de primera clase conectado al submit público estándar.
- JSON Block Runtime Expansion v1 con bloques comerciales iniciales realmente funcionales sobre el runtime público.
- JSON Compatibility Layer v1 para aceptar payloads compatibles con `hero_block`, `layout_blocks`, `media_dictionary` y `ui_config` sin rehacer el runtime.
- Template Presets / Block Variants v1 para aplicar presets declarativos y variantes visuales por template/funnel sobre la registry pública actual.
- Compatible Block Expansion v2 con normalización más fiel para aliases, nested CTA, media ruidosa y bloques comerciales compatibles de mayor impacto.
- Recycled Component Intake v2 con capa `public-funnel/recycled/` para hero, hook, social proof, video, offer stack y FAQ sobre los adapters actuales.
- Real JSON Intake Pack v1 con 3 payloads reales o casi reales dentro del repo para validar compatibilidad práctica del runtime público.
- Team Operations v1 con acciones mutativas básicas para `Team Admin`.
- Member Operations v1 con operación real sobre leads asignados, perfil y disponibilidad.
- Reveal & Handoff v1 con sponsor reveal en thank-you, CTA a WhatsApp y redirect inmediato por estrategia.
- Messaging Integrations v1 con conexión individual de WhatsApp por sponsor/member vía Evolution API y base preparada para n8n.
- Evolution QR Connect v1 con lifecycle real de instancia, QR, refresh, reset y disconnect por backend.
- Messaging Automation / n8n v1 con bridge real por webhook, payload estructurado y persistencia de dispatch por assignment.
- Incoming Webhooks / Conversation Signals v1 con señales entrantes autenticadas, persistencia propia y actualización operativa básica de lead/assignment.
- Lead Qualification & Timeline v1 con resumen operativo, calificación simple, notas y timeline consolidada para `member` y `team`.
- Lead Workflows / Reminders / Qualification Playbooks v1 con follow-up vencido/hoy/próximo, sugerencias de próxima acción y playbooks simples por lead.
- Configuracion por entorno para dominios y URLs.
- Baseline de ejecucion con Dockerfiles, Compose de desarrollo y stack Swarm.
- Variante de stack local para primer despliegue controlado desde Portainer.

No hay deploy aplicado en esta fase.

## Nota de login

- El login web usa flujo server-first: el formulario de `/login` envía a una `server action` de Next, esa acción llama a `POST https://api.leadflow.kurukin.com/v1/auth/login`, persiste la cookie de sesión en el servidor de Next y resuelve el redirect final por rol sin depender de `fetch` cliente ni `window.location`.
- El logout web usa flujo server-first: el botón envía a una `server action` de Next, esa acción llama a `POST https://api.leadflow.kurukin.com/v1/auth/logout`, limpia la cookie de sesión del lado Next y redirige a `/login` sin depender de navegación JS en cliente.
- Los redirects internos de `admin`, `team` y `member` resuelven sobre un único host de app: `https://leadflow.kurukin.com`.

## Stack tecnico

- Frontend: Next.js + React + TypeScript + Tailwind.
- Backend: NestJS + Fastify.
- Monorepo: pnpm workspaces + Turborepo.
- Ejecucion: Docker + Docker Compose (dev) + Docker Swarm stack.

## Estrategia de dominio

- Dominio base actual del sistema: `leadflow.kurukin.com`.
- API fija del sistema: `api.leadflow.kurukin.com`.
- El codigo de aplicacion debe ser domain-agnostic.
- El dominio vive solo en configuracion centralizada (`*.env.example`, variables de stack) y documentacion operativa.

Hosts funcionales esperados por convencion:

- `SITE_URL`
- `MEMBERS_URL`
- `ADMIN_URL`
- `API_URL`

Variables transversales:

- `APP_ENV`
- `APP_BASE_DOMAIN`

## Rutas de infraestructura

- Dockerfile web: `apps/web/Dockerfile`
- Dockerfile api: `apps/api/Dockerfile`
- Docker Compose dev: `infra/docker/docker-compose.dev.yml`
- Stack Swarm GHCR: `infra/swarm/docker-stack.yml`
- Stack Swarm local: `infra/swarm/docker-stack.local.yml`
- Variables ejemplo compose: `infra/docker/.env.example`
- Variables ejemplo swarm: `infra/swarm/.env.example`

## Redes objetivo

- `traefik_public` (externa existente en servidor)
- `leadflow_core` (interna del proyecto)
- `leadflow_automation` (placeholder para integraciones futuras)

## Scripts utiles

Desde la raiz del repo:

Desarrollo app:

- `pnpm dev`
- `pnpm dev:web`
- `pnpm dev:api`

Base de datos:

- `pnpm db:generate`
- `pnpm db:migrate:dev`
- `pnpm db:migrate:deploy`
- `pnpm db:seed`

Calidad:

- `pnpm build`
- `pnpm lint`
- `pnpm test`

Docker local:

- `pnpm docker:dev:up`
- `pnpm docker:dev:down`
- `pnpm docker:dev:logs`

Validacion de stacks:

- `pnpm docker:stack:validate`
- `pnpm docker:stack:validate:local`

## Variables de entorno

- Web: `apps/web/.env.example`
- API: `apps/api/.env.example`
- Referencia completa: `docs/environment-v1.md`

## Documentacion clave

- `docs/architecture-v1.md`
- `docs/base-domain-migration-kurukin-v1.md`
- `docs/domain-model-v1.md`
- `docs/cloudflare-saas-runtime-architecture-v2.md`
- `docs/simple-saas-domain-activation-v1.md`
- `docs/persistence-v1.md`
- `docs/public-funnel-runtime-v1.md`
- `docs/lead-capture-assignment-flows-v1.md`
- `docs/tracking-events-v1.md`
- `docs/app-shells-ui-base-v1.md`
- `docs/ui-product-clarity-pass-v1.md`
- `docs/roles-auth-v1.md`
- `docs/team-operations-v1.md`
- `docs/member-operations-v1.md`
- `docs/reveal-handoff-v1.md`
- `docs/messaging-integrations-v1.md`
- `docs/evolution-qr-connect-v1.md`
- `docs/messaging-automation-n8n-v1.md`
- `docs/incoming-webhooks-conversation-signals-v1.md`
- `docs/lead-qualification-timeline-v1.md`
- `docs/lead-workflows-reminders-playbooks-v1.md`
- `docs/public-funnel-frontend-v1.md`
- `docs/public-funnel-frontend-v2.md`
- `docs/component-assimilation-v1.md`
- `docs/lead-capture-form-block-v1.md`
- `docs/json-block-runtime-expansion-v1.md`
- `docs/json-compatibility-layer-v1.md`
- `docs/template-presets-block-variants-v1.md`
- `docs/compatible-block-expansion-v2.md`
- `docs/recycled-component-intake-v2.md`
- `docs/real-json-intake-pack-v1.md`
- `docs/funnel-tracking-model-v1.md`
- `docs/funnel-domain-expansion-v1.md`
- `docs/ownership-publication-template-model-v1.md`
- `docs/domain-persistence-expansion-v2.md`
- `docs/domain-persistence-expansion-implemented-v2.md`
- `docs/infrastructure-v1.md`
- `docs/deployment-v1.md`
- `docs/deployment-local-v1.md`
- `docs/tls-verification-v1.md`
- `docs/deploy-checklist-v1.md`
- `docs/domain-strategy-v1.md`
- `docs/domain-lifecycle-v1.md`
- `docs/environment-v1.md`

## Dominio API

Modulos disponibles:

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
- timeline operativa sobre `leads`

## Persistencia implementada

- Prisma integrado en `apps/api/prisma/schema.prisma`.
- Migracion v2 aplicada para ownership/publicacion/templates.
- Seed de desarrollo con workspace, team, domains, funnel template, funnel instance, funnel steps, publicaciones activas en `/` y `/oportunidad`, tracking profile, handoff strategy, compatibilidad con funnel legacy y usuarios demo autenticables.
- Endpoints de validacion expuestos:
  - `GET /v1/workspaces`
  - `GET /v1/teams`
  - `GET /v1/sponsors`
  - `GET /v1/leads`
  - `GET /v1/rotation-pools`
  - `GET /v1/domains`
  - `GET /v1/funnel-templates`
  - `GET /v1/funnel-instances`
  - `GET /v1/funnel-publications`

## Runtime publico v1

- Resolucion publica implementada por `host + path` con `normalizedHost` exacto, `pathPrefix` normalizado y precedencia por ruta mas especifica.
- Runtime SaaS v2 para dominios externos:
  - `customers.leadflow.kurukin.com` es el `CNAME target` único para clientes
  - `proxy-fallback.leadflow.kurukin.com` es el `fallback origin` fijo usado por Cloudflare
  - `proxy-fallback.leadflow.kurukin.com` no se expone como target del cliente; si aparece un target legado como `proxy-fallback.exitosos.com`, Leadflow lo marca `legacy` y exige recreate
  - Traefik usa router público catch-all y deja routers explícitos solo para `leadflow.kurukin.com` y `api.leadflow.kurukin.com`
  - no se enumeran dominios cliente en YAML/labels del stack
- Modelo de publicacion preparado para dominios externos reales:
  - `team` 1:N `domains`
  - `domain` 1:N `funnel_publications`
  - `Domain.normalizedHost` como clave operativa de resolucion
  - `Domain.domainType` con `system_subdomain`, `custom_apex`, `custom_subdomain`
  - metadata opcional de canonicalidad con `canonicalHost` y `redirectToPrimary`
  - onboarding SaaS con `onboardingStatus`, `verificationStatus`, `sslStatus`, `cloudflareCustomHostnameId`, `cloudflareStatusJson`, `dnsTarget` y `verificationMethod`
- Endpoints publicos disponibles:
  - `GET /v1/public/funnel-runtime/resolve?host=...&path=...`
  - `GET /v1/public/funnel-runtime/publications/:publicationId`
  - `GET /v1/public/funnel-runtime/publications/:publicationId/steps/:stepSlug`
- Web con ruta publica catch-all `/(site)/[[...slug]]` para root y subrutas limpias.
- El payload publico ya devuelve handoff efectivo para el runtime:
  - `thank_you_then_whatsapp`
  - `immediate_whatsapp`
- Renderer JSON-driven con shell visual v2 y registry de adapters para bloques:
  - `hero`
  - `video`
  - `cta`
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
- Compatibilidad base soportada para payloads estilo Jakawi/Vexer con:
  - `template`
  - `ui_config`
  - `media_dictionary`
  - `hero_block`
  - `layout_blocks`
- Compatibilidad v2 reforzada para:
  - aliases de props por bloque
  - `primary_cta` / `secondary_cta` anidados
  - `stats`, `reviews`, `faq_items`, `price_box`, `video.embed_url`
  - media inline o por `media_dictionary`
- Intake pack real disponible en:
  - `apps/web/lib/public-funnel/intake-examples/sales-audit-landing.json`
  - `apps/web/lib/public-funnel/intake-examples/advisor-opportunity-vsl.json`
  - `apps/web/lib/public-funnel/intake-examples/clinic-whatsapp-intake.json`
- Presets iniciales disponibles:
  - `landing_capture_v1`
  - `opportunity_vsl_v1`
  - `thank_you_reveal_v1`
- Compatibilidad mantenida por normalización:
  - `form_placeholder` -> `lead_capture_form`
  - `features` -> `feature_grid`
  - `offer` / `pricing` -> `offer_pricing`
- Adapters preparados para asimilación de componentes reciclados:
  - `testimonial` / `testimonials`
  - `media` / `image`
- Intake `recycled/` activo para secciones comerciales:
  - hero
  - hook
  - social proof
  - video
  - offer stack
  - FAQ accordion
- La demo seed pública de `/` ya corre sobre un payload intake real (`sales-audit-landing.json`) en vez de un objeto inline montado a mano.
- Preview local en desarrollo con `?previewHost=...` si hace falta simular otro host.
- Reveal operativo en el thank-you usando el assignment de la sesion.
- CTA a WhatsApp con enlace `wa.me` y fallback limpio si falta telefono.
- Rutas seed listas para probar:
  - `/`
  - `/gracias`
  - `/oportunidad`
  - `/oportunidad/gracias`
- `lead_capture_form` captura también contexto de URL cuando existe (`utm_*`, `fbclid`, `gclid`, `ttclid`) sin cambiar el endpoint estándar del runtime.
- La capa nueva desacopla markup visual del contrato bruto del bloque y deja una base clara para variantes futuras sin cambiar publicación, assignment ni editor.

## Lead Capture & Assignment v1

- El bloque `lead_capture_form` ahora envia un submit real al API publico.
- El alias legacy `form_placeholder` sigue resolviendo al mismo motor mientras migramos seeds y templates.
- Flujo compuesto disponible:
  - registrar `Visitor`
  - capturar `Lead`
  - asignar sponsor por round robin simple
  - persistir `Assignment`
  - registrar `DomainEvent`
  - navegar al siguiente step si existe
- Endpoints publicos disponibles:
  - `POST /v1/public/funnel-runtime/visitors`
  - `POST /v1/public/funnel-runtime/leads`
  - `POST /v1/public/funnel-runtime/assignments/auto`
  - `POST /v1/public/funnel-runtime/submissions`
- Endpoints de lectura ampliados:
  - `GET /v1/leads?sponsorId=...`
  - `GET /v1/leads?funnelPublicationId=...`
  - `GET /v1/leads/:id/timeline`
  - `GET /v1/leads/reminders/summary`
  - `GET /v1/leads/:id/playbook`
  - `PATCH /v1/leads/:id/qualification`
  - `PATCH /v1/leads/:id/follow-up`
  - `POST /v1/leads/:id/notes`
  - `GET /v1/assignments`
  - `GET /v1/assignments?sponsorId=...`
  - `GET /v1/assignments?funnelPublicationId=...`
- Estrategia de assignment v1:
  - contexto principal `FunnelPublication` + `FunnelInstance`
  - pool operativo de `RotationPool`
  - seleccion del siguiente sponsor elegible por round robin simple
  - reutilizacion de asignacion abierta si el lead ya fue asignado

## Tracking Events v1

- Persistencia interna de tracking sobre `DomainEvent`.
- Campos nuevos de contexto:
  - `eventId`
  - `funnelInstanceId`
  - `funnelPublicationId`
  - `funnelStepId`
- Eventos browser registrados desde el runtime:
  - `funnel_viewed`
  - `step_viewed`
  - `form_started`
  - `form_submitted`
  - `cta_clicked`
  - `handoff_completed`
- Eventos server registrados desde API:
  - `lead_created`
  - `assignment_created`
  - `assignment_failed`
- `handoff_started`

## Messaging Integrations v1

- Modelo nuevo `MessagingConnection` ligado 1:1 a `Sponsor`.
- Bridge de automation preparado por `AutomationDispatch` para despachar contexto estructurado hacia n8n sin romper el fallback comercial actual.
- Modelo nuevo `ConversationSignal` para persistir señales entrantes desde n8n/Evolution y reflejarlas sobre leads y assignments.
- Endpoint privado disponible para visibilidad del member:
  - `GET /v1/messaging-automation/me`
- Endpoints de conversation signals:
  - `POST /v1/incoming-webhooks/messaging`
  - `GET /v1/incoming-webhooks/messaging/signals?leadId=...`
- Variables nuevas de automation:
  - `MESSAGING_AUTOMATION_WEBHOOK_BASE_URL`
  - `MESSAGING_AUTOMATION_WEBHOOK_TOKEN`
  - `MESSAGING_AUTOMATION_DISPATCH_TIMEOUT_MS`
  - `MESSAGING_AUTOMATION_DISPATCH_RETRIES`
  - `INCOMING_MESSAGING_WEBHOOK_SECRET`
- Trigger v1 del bridge:
  - se dispara al crearse una asignacion nueva desde el runtime publico
  - persiste `pending`, `skipped`, `dispatched` o `failed`
  - no bloquea el submit publico ni el fallback `wa.me` si n8n no esta disponible
- Señales entrantes soportadas:
  - `conversation_started`
  - `message_inbound`
  - `message_outbound`
  - `lead_contacted`
  - `lead_qualified`
  - `lead_follow_up`
  - `lead_won`
  - `lead_lost`
- Efecto operativo v1:
  - persiste la señal
  - crea `DomainEvent` de auditoria
  - actualiza lead y assignment con estados simples y trazables
- Provider inicial soportado:
  - `EVOLUTION`
- Estados persistidos:
  - `disconnected`
  - `provisioning`
  - `qr_ready`
  - `connecting`
  - `connected`
  - `error`
- Endpoints member disponibles:
  - `GET /v1/messaging-integrations/me`
  - `POST /v1/messaging-integrations/me/connect`
  - `POST /v1/messaging-integrations/me/qr`
  - `POST /v1/messaging-integrations/me/refresh`
  - `POST /v1/messaging-integrations/me/reset`
  - `POST /v1/messaging-integrations/me/disconnect`
- Superficie privada nueva:
  - `/member/channel`
- Variables nuevas en `apps/api/.env.example`:
  - `EVOLUTION_API_INTERNAL_BASE_URL`
  - `EVOLUTION_API_PUBLIC_BASE_URL`
  - `EVOLUTION_API_BASE_URL` como fallback legacy
  - `EVOLUTION_API_KEY`
  - `EVOLUTION_INSTANCE_PREFIX`
  - `EVOLUTION_WEBHOOK_EVENT` con valor recomendado `MESSAGES_UPSERT`
  - `MESSAGING_AUTOMATION_WEBHOOK_BASE_URL`
  - `EVOLUTION_REQUEST_TIMEOUT_MS`
  - `EVOLUTION_REQUEST_RETRIES`
  - `EVOLUTION_QR_POLL_ATTEMPTS`
  - `EVOLUTION_QR_POLL_DELAY_MS`
- Reveal & handoff actual sigue funcionando con fallback a `wa.me` mientras la conexión real se usa solo como base operativa y de futura automatización.
- La ruta principal de control es:
  - `Leadflow Web -> Leadflow API -> Evolution API por red interna`
- La URL pública de Evolution queda solo como fallback opcional o referencia documental.

## Roles & Auth v1

- Roles base implementados:
  - `SUPER_ADMIN`
  - `TEAM_ADMIN`
  - `MEMBER`
- Modelo persistido:
  - `User`
  - `AuthSession`
- Endpoints auth disponibles:
  - `POST /v1/auth/login`
  - `POST /v1/auth/logout`
  - `GET /v1/auth/me`
- Proteccion por superficie:
  - `/admin/*` solo `SUPER_ADMIN`
  - `/team/*` solo `TEAM_ADMIN`
  - `/member/*` solo `MEMBER`
- Guards backend:
  - autenticacion por cookie HttpOnly
  - autorizacion por rol sobre endpoints privados
- Usuarios demo del seed:
  - `admin@leadflow.local / Admin123!`
  - `team@leadflow.local / Team123!`
  - `ana.member@leadflow.local / Member123!`
  - `bruno.member@leadflow.local / Member456!`
- Comportamiento esperado del login web:
  - cualquier respuesta `2xx` de `POST /v1/auth/login` se trata como éxito
  - el frontend mantiene `credentials: "include"`
  - el redirect final usa el `redirectPath` devuelto por el API
  - si la navegación posterior no ocurre, el estado `Ingresando...` debe liberarse y mostrar error
  - `SUPER_ADMIN -> /admin`
  - `TEAM_ADMIN -> /team`
  - `MEMBER -> /member`
- Comportamiento esperado del logout web:
  - `POST /v1/auth/logout` usa `credentials: "include"`
  - cualquier respuesta `2xx` se trata como logout exitoso
  - el frontend fuerza navegación dura a `/login`
  - una vez cerrada la sesión, volver a `/admin`, `/team` o `/member` debe redirigir a `/login`

## Team Operations v1

- Superficie `Team Admin` conectada con operaciones reales en:
  - `/team/funnels`
  - `/team/domains`
  - `/team/publications`
  - `/team/sponsors`
  - `/team/pools`
  - `/team/leads`
- Endpoints operativos agregados o ampliados:
  - `POST /v1/domains`
  - `PATCH /v1/domains/:id`
  - `DELETE /v1/domains/:id`
  - `POST /v1/domains/:id/refresh`
  - `POST /v1/domains/:id/recreate-onboarding`
  - `GET /v1/tracking-profiles`
  - `GET /v1/handoff-strategies`
  - `POST /v1/funnel-instances`
  - `PATCH /v1/funnel-instances/:id`
  - `POST /v1/funnel-publications`
  - `PATCH /v1/funnel-publications/:id`
  - `PATCH /v1/sponsors/:id`
  - `GET /v1/rotation-pools/members`
  - `PATCH /v1/rotation-pools/members/:memberId`
- Operaciones habilitadas:
  - registrar domains y devolver instrucciones DNS operativas
  - editar metadata del domain sin mutar silenciosamente el hostname activo
  - eliminar domains y limpiar el custom hostname de Cloudflare cuando exista
  - refrescar onboarding real contra Cloudflare SaaS cuando hay configuración
  - recrear onboarding para limpiar targets heredados, regenerar `dnsTarget` y re-sincronizar estados
  - crear funnel instances desde templates aprobados
  - activar o pausar funnels operativos
  - crear publicaciones y validar conflictos `host + path`
  - activar o pausar publications
  - activar o pausar sponsors
  - actualizar disponibilidad operativa
  - ver y reordenar miembros de pools
  - consultar leads del team con filtros básicos
- Restricción mantenida:
  - `Team Admin` no puede editar templates ni JSON estructural libre

## Member Operations v1

- Superficie `Sponsor / Member` conectada con operación real en:
  - `/member`
  - `/member/leads`
  - `/member/profile`
- Endpoints operativos agregados o ampliados:
  - `GET /v1/sponsors/me`
  - `PATCH /v1/sponsors/me`
  - `GET /v1/leads?status=...`
  - `GET /v1/leads/:id`
  - `PATCH /v1/leads/:id`
  - `GET /v1/assignments?status=...`
  - `PATCH /v1/assignments/:id`
- Operaciones habilitadas:
  - ver leads asignados reales
  - aceptar leads nuevos desde el member
  - mover estado simple del lead
  - cerrar assignments
  - editar perfil visible del sponsor
  - pausar o reactivar disponibilidad para recibir nuevos handoffs
- Restricciones mantenidas:
  - sin inbox conversacional
  - sin WhatsApp, Evolution o n8n
  - sin notas avanzadas ni CRM completo

## Reveal & Handoff v1

- Reveal del sponsor asignado sobre el bloque `sponsor_reveal_placeholder`.
- Handoff modes soportados:
  - `thank_you_then_whatsapp`
  - `immediate_whatsapp`
- El submit publico devuelve `assignment`, `nextStep` y `handoff` para persistir el contexto del thank-you.
- El runtime construye un enlace robusto a WhatsApp con:
  - numero normalizado
  - mensaje inicial prellenado
  - fallback si falta sponsor o telefono
- Tracking conectado:
  - `handoff_started` desde API
  - `cta_clicked` desde web
  - `handoff_completed` cuando se dispara el click o redirect real

## App Shells + UI Base v1

- Superficies visibles implementadas en `apps/web`:
  - `/admin`
  - `/admin/teams`
  - `/admin/templates`
  - `/admin/publications`
  - `/team`
  - `/team/funnels`
  - `/team/domains`
  - `/team/publications`
  - `/team/sponsors`
  - `/team/pools`
  - `/team/leads`
  - `/member`
  - `/member/leads`
  - `/member/profile`
- Componentes UI base creados:
  - `app-shell-layout`
  - `app-sidebar`
  - `top-bar`
  - `section-header`
  - `kpi-card`
  - `data-table`
  - `empty-state`
  - `status-badge`
  - `sponsor-card`
  - `publication-card`
- Datos reales conectados cuando la API esta disponible:
  - `workspaces`
  - `domains`
  - `funnel-templates`
  - `funnel-instances`
  - `funnel-publications`

## Cloudflare SaaS Domain Onboarding v1

- Variables de entorno API:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ZONE_ID`
  - `CLOUDFLARE_SAAS_FALLBACK_ORIGIN`
  - `CLOUDFLARE_SAAS_CUSTOMER_CNAME_TARGET`
  - `CLOUDFLARE_API_BASE_URL` opcional
  - `CLOUDFLARE_REQUEST_TIMEOUT_MS` opcional
- Flujo alineado al runtime SaaS v2:
  - el team registra el hostname del cliente en Leadflow
  - Leadflow crea/actualiza el custom hostname en Cloudflare
  - Leadflow devuelve un único `CNAME target`: `customers.leadflow.kurukin.com`
  - Cloudflare edge presenta el cert del dominio del cliente
  - Cloudflare reenvía al origin fijo `proxy-fallback.leadflow.kurukin.com`
  - la UI muestra hostname solicitado, domain type, target actual, estado Cloudflare, estado SSL, last sync y acciones CRUD/re-onboard
  - si un dominio conserva `dnsTarget` o `custom_origin_server` legado, la UI lo marca `legacy` + `recreate required`
  - `PATCH /v1/domains/:id` no permite cambiar el host de dominios ya onboardeados; ese cambio debe hacerse con `POST /v1/domains/:id/recreate-onboarding`
  - el resolver final de funnels sigue ocurriendo por `host + path`
  - `domains`
  - `sponsors`
  - `rotation-pools`
  - `leads`
  - `assignments`
  - `events`
- Fallbacks mock temporales y aislados:
  - metadata de `teams` por falta de endpoint HTTP dedicado
  - preferencias del `member profile`
  - datasets de respaldo para que `build` y shell funcionen aun sin API en runtime
- Auth real sigue fuera de alcance:
  - no se bloquean rutas todavia
  - los layouts y surfaces ya quedan listos para insertar guards, session y permisos sin rehacer UI

## Compatibilidad actual

- `Workspace` sigue como frontera tenant.
- `Team` es el owner operativo real.
- `Funnel` se mantiene como modelo legacy/transicional.
- `Lead` y `Assignment` ya pueden enlazarse tambien a `FunnelInstance` y `FunnelPublication`.

## Estado de despliegue

- Preparado para despliegue en Portainer con dos variantes de stack:
  - `infra/swarm/docker-stack.local.yml` (sin GHCR, primer despliegue en nodo unico, con Postgres dedicado del stack)
  - `infra/swarm/docker-stack.yml` (con GHCR, ruta objetivo de escalado)
- Runtime de contenedores para Swarm:
  - Web: `node apps/web/server.js` (Next standalone, produccion)
  - API: `node apps/api/dist/main.js` (Nest compilado, produccion)
- TLS para Cloudflare Full (strict) en stack local:
  - Routers explícitos para `leadflow.kurukin.com` y `api.leadflow.kurukin.com`.
  - Router público catch-all para `customers.leadflow.kurukin.com`, `proxy-fallback.leadflow.kurukin.com` y tráfico proxied de clientes.
  - Certificados de origen enfocados en hostnames fijos del SaaS, no en dominios cliente individuales.
- Deploy aun no ejecutado.

## Nota operativa

Esta fase ya conecta runtime publico, captura, assignment, tracking events y las primeras superficies visibles del SaaS, sin deploy ni cambios de infraestructura productiva.
