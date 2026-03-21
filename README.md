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
- Roles & Auth v1 con login real, sesión segura y protección base por superficie.
- Team Operations v1 con acciones mutativas básicas para `Team Admin`.
- Member Operations v1 con operación real sobre leads asignados, perfil y disponibilidad.
- Reveal & Handoff v1 con sponsor reveal en thank-you, CTA a WhatsApp y redirect inmediato por estrategia.
- Messaging Integrations v1 con conexión individual de WhatsApp por sponsor/member vía Evolution API y base preparada para n8n.
- Evolution QR Connect v1 con lifecycle real de instancia, QR, refresh, reset y disconnect por backend.
- Messaging Automation / n8n v1 con bridge real por webhook, payload estructurado y persistencia de dispatch por assignment.
- Configuracion por entorno para dominios y URLs.
- Baseline de ejecucion con Dockerfiles, Compose de desarrollo y stack Swarm.
- Variante de stack local para primer despliegue controlado desde Portainer.

No hay deploy aplicado en esta fase.

## Stack tecnico

- Frontend: Next.js + React + TypeScript + Tailwind.
- Backend: NestJS + Fastify.
- Monorepo: pnpm workspaces + Turborepo.
- Ejecucion: Docker + Docker Compose (dev) + Docker Swarm stack.

## Estrategia de dominio

- `exitosos.com` es dominio temporal de staging.
- El dominio de lanzamiento sera distinto y se definira en ventana de release.
- El codigo de aplicacion debe ser domain-agnostic.
- El dominio vive solo en configuracion centralizada (`*.env.example`, variables de stack) y documentacion de staging.

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
- `docs/domain-model-v1.md`
- `docs/persistence-v1.md`
- `docs/public-funnel-runtime-v1.md`
- `docs/lead-capture-assignment-flows-v1.md`
- `docs/tracking-events-v1.md`
- `docs/app-shells-ui-base-v1.md`
- `docs/roles-auth-v1.md`
- `docs/team-operations-v1.md`
- `docs/member-operations-v1.md`
- `docs/reveal-handoff-v1.md`
- `docs/messaging-integrations-v1.md`
- `docs/evolution-qr-connect-v1.md`
- `docs/messaging-automation-n8n-v1.md`
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

## Persistencia implementada

- Prisma integrado en `apps/api/prisma/schema.prisma`.
- Migracion v2 aplicada para ownership/publicacion/templates.
- Seed de desarrollo con workspace, team, domain, funnel template, funnel instance, funnel steps, publicaciones activas en `/` y `/oportunidad`, tracking profile, handoff strategy, compatibilidad con funnel legacy y usuarios demo autenticables.
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

- Resolucion publica implementada por `host + path` con match exacto de host, path normalizado y precedencia por ruta mas especifica.
- Endpoints publicos disponibles:
  - `GET /v1/public/funnel-runtime/resolve?host=...&path=...`
  - `GET /v1/public/funnel-runtime/publications/:publicationId`
  - `GET /v1/public/funnel-runtime/publications/:publicationId/steps/:stepSlug`
- Web con ruta publica catch-all `/(site)/[[...slug]]` para root y subrutas limpias.
- El payload publico ya devuelve handoff efectivo para el runtime:
  - `thank_you_then_whatsapp`
  - `immediate_whatsapp`
- Renderer JSON-driven MVP con bloques:
  - `hero`
  - `text`
  - `video`
  - `cta`
  - `faq`
  - `form_placeholder`
  - `thank_you`
  - `sponsor_reveal_placeholder`
- Preview local en desarrollo con `?previewHost=...` si hace falta simular otro host.
- Reveal operativo en el thank-you usando el assignment de la sesion.
- CTA a WhatsApp con enlace `wa.me` y fallback limpio si falta telefono.
- Rutas seed listas para probar:
  - `/`
  - `/gracias`
  - `/oportunidad`
  - `/oportunidad/gracias`

## Lead Capture & Assignment v1

- El bloque `form_placeholder` ahora envia un submit real al API publico.
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
- Endpoint privado disponible para visibilidad del member:
  - `GET /v1/messaging-automation/me`
- Variables nuevas de automation:
  - `MESSAGING_AUTOMATION_WEBHOOK_BASE_URL`
  - `MESSAGING_AUTOMATION_WEBHOOK_TOKEN`
  - `MESSAGING_AUTOMATION_DISPATCH_TIMEOUT_MS`
  - `MESSAGING_AUTOMATION_DISPATCH_RETRIES`
- Trigger v1 del bridge:
  - se dispara al crearse una asignacion nueva desde el runtime publico
  - persiste `pending`, `skipped`, `dispatched` o `failed`
  - no bloquea el submit publico ni el fallback `wa.me` si n8n no esta disponible
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

## Team Operations v1

- Superficie `Team Admin` conectada con operaciones reales en:
  - `/team/funnels`
  - `/team/publications`
  - `/team/sponsors`
  - `/team/pools`
  - `/team/leads`
- Endpoints operativos agregados o ampliados:
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
  - `funnel-templates`
  - `funnel-instances`
  - `funnel-publications`
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
  - Routers `site`, `members`, `admin`, `api` con `tls.certresolver=le`.
  - Dominio principal y SANs explicitos en `leadflow-site` para cubrir apex y subdominios operativos.
- Deploy aun no ejecutado.

## Nota operativa

Esta fase ya conecta runtime publico, captura, assignment, tracking events y las primeras superficies visibles del SaaS, sin deploy ni cambios de infraestructura productiva.
