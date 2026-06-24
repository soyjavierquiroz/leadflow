# LeadFlow Account Evolution Baseline

Fecha: 2026-06-24T20:19:49+00:00

## 1. Estado Git

- Branch: `main`
- Commit funcional etiquetado: `4af4407e6e0e455ae8a64f712b7e39438d7c0aeb`
- Tag de retorno: `leadflow-pre-account-evolution-20260624-201946`
- Rama local de respaldo del working tree previo al commit: `backup/pre-account-evolution-working-tree`
- Ultimo commit antes de estabilizar fixes: `e26c0c4 chore(infra): document public ref base url`
- Commit funcional creado antes del tag: `4af4407 chore: stabilize public funnel tracking seo and ad wheels baseline`
- Working tree: limpio al momento de crear el tag. Este documento se agrega despues del tag para no mover el punto de retorno funcional.
- Sin conflictos detectados antes de la sincronizacion/tag.
- Sincronizacion: `git fetch --all --tags` y `git pull --ff-only` terminaron con `Already up to date.`
- Validaciones focalizadas antes del commit/tag:
  - `pnpm --filter @leadflow/api typecheck`: OK.
  - `pnpm --filter @leadflow/web typecheck`: OK.
  - Observacion: ambos comandos emitieron warning de engine porque el entorno usa Node `v18.19.1` y el repo pide `>=20.16.0`.

## 2. Arquitectura actual

LeadFlow esta organizado como monorepo con API NestJS en `apps/api`, web Next.js en `apps/web`, Prisma/Postgres en `apps/api/prisma/schema.prisma`, y paquetes compartidos en `packages`.

Entidades principales actuales:

- `Workspace`: contenedor raiz multi-tenant. Tiene `teams`, `sponsors`, `users`, `funnels`, `domains`, `funnelPublications`, `trackingProfiles`, `leads`, `assignments`, `messagingConnections`, eventos, CRM y cola de outreach.
- `Team`: unidad operativa dentro de un workspace. Agrupa sponsors, usuarios, funnels, publications, rotation pools, ad wheels, AI configs, channel instances, CRM y knowledge audits.
- `User`: identidad de autenticacion con `role`, scope opcional a `workspaceId`, `teamId` y `sponsorId`.
- `Sponsor`: asesor/miembro comercial dentro de un team. Puede tener `User` 1:1 via `User.sponsorId`, `MessagingConnection`, AI config y participacion en pools/ad wheels.
- `Lead`: lead capturado bajo workspace y funnel; puede tener visitor, funnel publication/instance, origin ad wheel y assignment actual.
- `Assignment`: asignacion operacional `Lead -> Sponsor` con `ownershipKey`, team, funnel, publication, rotation pool y ad wheel de origen.
- `FunnelInstance`: instancia editable/publicable de un template/funnel para un team.
- `FunnelPublication`: publicacion activa por dominio/path; contiene SEO/OG, pixel IDs y tokens CAPI por publicacion.
- `Domain`: dominio del team, con onboarding Cloudflare SaaS y relacion a funnel/publications.
- `TrackingProfile`: configuracion de tracking por team; ahora convive con campos de tracking por publication.
- `RotationPool`: pool de sponsors para asignacion.
- `AdWheel`: rueda pagada por team/publication, con participants y turns.
- `MessagingConnection`: conexion WhatsApp/Evolution unica por sponsor, con workspace/team/sponsor, estado QR/conexion y estado Runtime Context.
- `KnowledgeAudit`: auditoria de operaciones Knowledge/RAG por tenant/team y usuario.
- `crm_outreach_queue`: existe como modelo Prisma `CrmOutreachQueue` con `@@map("crm_outreach_queue")`.

Relaciones actuales:

- `Workspace -> Team -> Sponsor/User`.
- `Workspace -> Lead`.
- `Team -> FunnelPublication / RotationPool / AdWheel`.
- `Lead -> Assignment -> Sponsor`.
- `MessagingConnection -> Sponsor -> User` y tambien `MessagingConnection -> Workspace/Team`. El modelo real no tiene `userId` directo en `MessagingConnection`; el usuario operativo se deriva por el sponsor asociado.
- `FunnelPublication -> Domain/FunnelInstance/TrackingProfile/HandoffStrategy`.
- `Lead -> CrmLeadAssignment -> Sponsor` para lifecycle CRM/MLM, separado del `Assignment` operacional historico.

## 3. Roles actuales

### SUPER_ADMIN

- Rutas web principales: `/admin`, `/admin/tenants`, `/admin/teams`, `/admin/kredits`, `/admin/templates`, `/admin/estructuras`, `/admin/publications`.
- API principal: workspaces, system tenants, domains system, SSO system, team/funnel/publication/tracking scopes cuando el controlador lo permite.
- Permisos: administracion de plataforma, tenants, dominios, publicaciones de sistema, impersonacion/God Mode, scope explicito por `teamId` en varios endpoints.
- Limites conocidos: muchos controladores aun requieren `workspaceId/teamId` efectivo; no todos los endpoints aceptan operar sin scope tenant.

### TEAM_ADMIN

- Rutas web principales: `/team`, `/team/leads`, `/team/crm`, `/team/members`, `/team/wheels`, `/management/ai-config`, `/team/pools`, `/team/settings`, `/team/profile`.
- API principal: team CRM, team members, team leads, sponsors, rotation pools, ad wheels, publications, funnel instances, AI config de team/member.
- Permisos: gestion de equipo, miembros, sponsors, pools, publicaciones, ruedas, CRM unificado, outreach queue y configuracion IA.
- Limites conocidos: normalmente queda limitado a su propio `teamId`; solo puede entrar a vista operacional `/member` si tiene sponsor activo (`isHybridOperationalAdmin`).

### MEMBER

- Rutas web principales: `/member`, `/member/crm`, `/member/leads`, `/member/links`, `/member/profile`.
- API principal: accepts de CRM en `sponsors/me/crm/assignments`, leads/asignaciones de su sponsor, operaciones de ad wheel member, upload autorizado por scope.
- Permisos: operar leads propios, CRM personal, links y perfil.
- Limites conocidos: si `sponsor.isActive === false`, la UI bloquea CRM y participacion automatica; no administra equipo ni configuraciones globales.

La autorizacion API usa `SessionAuthGuard` + `RolesGuard`. Hay excepcion controlada para Team Admin activo que puede usar vista operacional cuando el decorador lo permite.

## 4. Integraciones actuales

### Evolution API

- Variables: `EVOLUTION_API_URL`, `EVOLUTION_GLOBAL_KEY`, `EVOLUTION_REQUEST_TIMEOUT_MS`, `N8N_WEBHOOK_BASE_URL`, `N8N_EVOLUTION_WEBHOOK_ID`.
- Modulos: `apps/api/src/modules/evolution/*`, `apps/api/src/modules/ai-config/*`, `apps/api/src/modules/runtime-context/*`.
- Responsabilidad: crear instancia WhatsApp Baileys, leer QR/status, configurar webhook `MESSAGES_UPSERT`, enviar texto y registrar binding Runtime Context.

### Kurukin AI Gateway / IA Gateway

- Variables: `IA_GATEWAY_BASE_URL`, `GATEWAY_AUTH_TOKEN`, `IA_GATEWAY_REQUEST_TIMEOUT_MS`.
- Modulos: `apps/api/src/modules/ai-config/ai-config.service.ts`, `ai-config.controller.ts`.
- Responsabilidad: inicializar, ejecutar y cerrar sesiones de orquestacion IA contra `/v1/session/init`, `/v1/execute`, `/v1/session/close`.

### Runtime Context Central

- Variables: `RUNTIME_CONTEXT_CENTRAL_BASE_URL`, `RUNTIME_CONTEXT_CENTRAL_API_KEY`, `RUNTIME_CONTEXT_INTERNAL_KEY`, `RUNTIME_CONTEXT_INTERNAL_API_KEY`, `RUNTIME_CONTEXT_BASE_URL`, `RUNTIME_CONTEXT_MODE`, `RUNTIME_CONTEXT_REQUEST_TIMEOUT_MS`, `RUNTIME_CONTEXT_REGISTER_PATH`, `RUNTIME_CONTEXT_RESOLVE_FULL_PATH`, `RUNTIME_CONTEXT_RESOLVE_RETRIES`, `RUNTIME_CONTEXT_RESOLVE_DELAY_MS`, `RUNTIME_CONTEXT_OWNERSHIP_UPSERT_ENABLED`, `RUNTIME_CONTEXT_OWNERSHIP_UPSERT_URL`, `RUNTIME_CONTEXT_OWNERSHIP_UPSERT_PATH`.
- Modulos: `apps/api/src/modules/runtime-context/*`, `apps/api/src/modules/evolution/runtime-context.service.ts`, `apps/api/src/modules/knowledge/knowledge.service.ts`.
- Responsabilidad: registrar/resolver bindings de instancia WhatsApp, sincronizar config/funnel context, upsert de ownership/action context y soporte Knowledge/RAG.

### n8n

- Variables: `N8N_DISPATCHER_WEBHOOK_URL`, `N8N_DISPATCHER_API_KEY`, `N8N_WEBHOOK_INTERNAL_BASE`, `N8N_OUTBOUND_WEBHOOK_URL`, `N8N_AUTOMATION_WEBHOOK_BASE_URL`, `MESSAGING_AUTOMATION_WEBHOOK_TOKEN`, `MESSAGING_AUTOMATION_DISPATCH_TIMEOUT_MS`, `MESSAGING_AUTOMATION_DISPATCH_RETRIES`, `N8N_WEBHOOK_SECRET`, `N8N_RAG_INGESTION_WEBHOOK_URL`.
- Modulos: `apps/api/src/modules/messaging-automation/*`, `apps/api/src/modules/sponsors/sponsors.service.ts`, `apps/api/src/modules/webhooks/system-api.guard.ts`, `apps/api/src/modules/knowledge/knowledge.service.ts`.
- Responsabilidad: dispatch automatizado, webhooks inbound/outbound, integracion de IA/lead dispatch, y RAG ingestion.

### Kloser Missions

- Variables: `KLOSER_API_URL`, `KLOSER_HMAC_SECRET`, `KLOSER_REQUEST_TIMEOUT_MS`, `KLOSER_API_TIMEOUT_MS`, `KLOSER_MISSION_ENABLED`, `KLOSER_MISSION_DRY_RUN`, `KLOSER_STRATEGY_INITIAL_CONTACT`.
- Modulos: `apps/api/src/modules/crm/crm-kloser-mission.service.ts`, `apps/api/src/modules/kloser/kloser-api.client.ts`, `apps/api/src/modules/messaging-automation/lead-dispatcher.service.ts`, `apps/api/src/modules/ai-config/kloser-tenant-config.ts`.
- Responsabilidad: handoff MLM-safe a misiones externas, callbacks firmados HMAC, health/metrics y payloads con ownership conversacional bloqueado.

### Wallet Engine / Kredits

- Variables: `WALLET_ENGINE_BASE_URL`, `WALLET_ENGINE_INTERNAL_URL`, `WALLET_ENGINE_API_KEY`.
- Modulos: `apps/api/src/modules/finance/wallet-engine.service.ts`, `teams/system-kredits.service.ts`, `teams/team-members.service.ts`, `ad-wheels/ad-wheels.service.ts`.
- Responsabilidad: consultar, acreditar y debitar Kredits; provisionar bienvenida; cobrar seats/ruedas; exponer balance.

### Supabase Conversational/CRM Store

- Variables detectadas: `CRM_UNIFIED_SUPABASE_ENABLED`, `CRM_UNIFIED_SUPABASE_TIMEOUT_MS`, `KURUKIN_SUPABASE_DATABASE_URL`.
- Modulo: `apps/api/src/modules/crm/kurukin-crm-read.client.ts`.
- Responsabilidad: lectura externa/unificada CRM desde store Supabase/Kurukin cuando esta habilitado.

### AWS SES mail

- Variables: `AWS_REGION`, `AWS_DEFAULT_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`, `MAIL_REPLY_TO_ADDRESS`.
- Modulos: `packages/shared/mail/src/index.ts`, `apps/api/src/modules/mail/*`, `apps/api/src/modules/shared/mailer.service.ts`.
- Responsabilidad: envio de correos transaccionales; se omite si SES o `MAIL_FROM_ADDRESS` no estan configurados.

## 5. CRM actual

- Team CRM: `TeamCrmController` expone inbox unificado, outreach queue, dry-run/requeue, dispatch metrics y health/metrics de Kloser para `SUPER_ADMIN`/`TEAM_ADMIN`; varias acciones quedan limitadas a `TEAM_ADMIN`.
- Member CRM: `SponsorCrmAssignmentsController` permite a `MEMBER` aceptar assignments propios; la UI member consume CRM/leads/links de su sponsor.
- Assignment lifecycle: `CrmLeadAssignment` maneja `pending_assignment`, `accepted`, `auto_accepted`, `expired`, `reassigned`, `closed`; `CrmAssignmentEvent` audita eventos.
- Ownership MLM: `ownershipLockedUntil` aplica lock de 72 horas; reasignaciones sin override fallan si el lock esta activo.
- Handoffs: `CrmOutreachDispatchBridgeService` reclama items, valida safety, renderiza template y entrega a dispatcher/Kloser; estados incluyen `queued`, `ready`, `processing`, `handed_off`, `dispatched`, `completed`, `failed`, `cancelled`.
- Outreach queue: `CrmOutreachQueue` agenda intentos con retry, external mission id/status/error y payload.
- Auto accept: conversaciones WhatsApp inbound pueden auto-aceptar assignment y fijar `conversationOwnerSponsorId`.
- Locks conversacionales: `CrmConversationOwnershipService` resuelve sponsor receptor por `receiverSponsorId` o `MessagingConnection.externalInstanceId`, busca lead por telefono y aplica auto-accept si no hay conflicto de lock.

## 6. IA actual

- Configuracion IA vive en `AiAgentConfig` (`tenantId`, `memberId`, `basePrompt`, `routeContexts`, `ctaPolicy`, `aiPolicy`, `isActive`) y en servicios `apps/api/src/modules/ai-config/*`.
- Config por tenant: `memberId = null`.
- Config por miembro: `memberId = Sponsor.id`.
- Runtime context IA se resuelve por `instanceName` desde `ChannelInstance.instanceName` o `MessagingConnection.externalInstanceId`.
- `sessionId` canonico para orquestacion se construye como `${instanceName}-${funnelId}`.
- `funnelId` es requerido para inicializar sesion; luego se puede recuperar desde `sessionId`.
- Dependencias principales: `instanceName`, `funnelId`, Runtime Context / AI Gateway, `Team` como tenant y `Sponsor` como member/wallet subject.
- AI Gateway solo ejecuta orquestacion pesada con `GATEWAY_AUTH_TOKEN` configurado.
- Runtime resolve-full devuelve `tenant_id`, `wallet_subject`, `basePrompt`, `runtime_config`, `config_version`, `service_owner_key` y metadata de routing.

## 7. WhatsApp actual

- `MessagingConnection` representa la conexion operativa WhatsApp/Evolution por sponsor; tiene `provider`, `status`, `externalInstanceId`, QR/pairing, automation webhook y Runtime Context status.
- Evolution provisioning: `POST /evolution/connect` valida ownership de `instanceName`, crea instancia si no existe, configura webhook, registra binding Runtime Context y devuelve QR/pairing.
- QR flow: `getQrCode(instanceName)` en Evolution API, estado consultable por `GET /evolution/status`.
- Webhook setup: `EvolutionService.setWebhook` configura evento `MESSAGES_UPSERT` contra URL compuesta desde `N8N_WEBHOOK_BASE_URL` + `N8N_EVOLUTION_WEBHOOK_ID`.
- Runtime Context bindings: se registran con provider `evolution`, channel `whatsapp`, `instance_name`, `tenant_id`, `vertical_key`, `brand_key`, `business_model_type` y service owner `lead-handler`.
- `instanceName` actual permitido: nombre legible `lf-${teamSegment}-${userSegment}`, o variantes `lf_${user.id}`, `user.id`, `lf_${sponsorId}`, `sponsorId`.
- Owner operativo actual: `Sponsor` asociado al `User`; `MessagingConnection` no apunta directo a `User`.

## 8. Base de datos

Datasource: PostgreSQL via `DATABASE_URL`.

Modelos/tablas principales:

- Tenancy/auth: `Workspace`, `Team`, `User`, `AuthSession`, `Sponsor`.
- Funnel/runtime: `Funnel`, `FunnelTemplate`, `FunnelInstance`, `FunnelStep`, `FunnelStepHistory`, `FunnelPublication`, `Domain`.
- Tracking/eventos: `TrackingProfile`, `ConversionEventMapping`, `DomainEvent`, `FunnelEvent`, `Visitor`, `TrackedLink`.
- Routing/assignment: `RotationPool`, `RotationMember`, `Lead`, `Assignment`, `AdWheel`, `AdWheelParticipant`, `AdWheelTurn`.
- Messaging/AI: `MessagingConnection`, `AiAgentConfig`, `ChannelInstance`, `AutomationDispatch`, `KnowledgeAudit`.
- CRM: `CrmLeadAssignment`, `CrmAssignmentEvent`, `CrmOutreachQueue`, `LeadNote`.

Relaciones criticas:

- `Workspace` cascades hacia teams, leads, assignments, messaging, CRM y eventos.
- `Team` cascades hacia sponsors, publications, pools, wheels, CRM y messaging.
- `Sponsor` tiene `User?`, `MessagingConnection?`, assignments, ad wheel participation y CRM ownership.
- `Lead.currentAssignmentId` es unico; `Assignment.ownershipKey` es unico.
- `MessagingConnection.sponsorId` es unico; `externalInstanceId` es unico.
- `ChannelInstance.instanceName` es unico.
- `FunnelInstance.funnelId` es unico.
- `FunnelPublication` esta indexado por domain/status/path y es unico por `[domainId, pathPrefix]`.
- `CrmLeadAssignment` indexa scope/status, lead/status, assigned sponsor/status, conversation owner/status y lock.
- `CrmOutreachQueue` indexa scope/status/schedule, retry, external status, mission id, sponsor/status y lead/intent/status.

Enums relevantes:

- Roles/auth: `UserRole`, `UserStatus`.
- Tenancy: `WorkspaceStatus`, `TeamStatus`, `SponsorStatus`, `AvailabilityStatus`.
- Routing: `RotationStrategy`, `RotationPoolStatus`, `AdWheelStatus`, `TrafficLayer`.
- Funnel: `FunnelStatus`, `FunnelTemplateStatus`, `FunnelInstanceStatus`, `FunnelStructuralType`, `FunnelStepType`, `FunnelPublicationStatus`, `FunnelRuntimeHealthStatus`.
- Domain: `DomainStatus`, `DomainOnboardingStatus`, `DomainType`, `DomainVerificationStatus`, `DomainSslStatus`, `DomainVerificationMethod`.
- Tracking: `TrackingProvider`, `TrackingProfileStatus`, `DeduplicationMode`.
- Lead/assignment: `LeadSourceChannel`, `VisitorKind`, `VisitorStatus`, `LeadStatus`, `LeadQualificationGrade`, `AssignmentStatus`, `AssignmentReason`.
- CRM: `CrmAssignmentStatus`, `CrmAssignmentSource`, `CrmAssignmentEventType`, `CrmOutreachStatus`, `CrmOutreachIntentType`.
- Messaging/AI: `MessagingProvider`, `MessagingConnectionStatus`, `MessagingRuntimeContextStatus`, `AutomationDispatchStatus`, `KnowledgeAuditOperation`, `TrackedLinkStatus`.

## 9. Areas de alto riesgo

| Area | Riesgo | Motivo |
| --- | --- | --- |
| Ownership MLM | Critico | Locks de 72h, conversation owner, accepted/auto_accepted y reassignment impactan propiedad comercial. |
| Assignment locks | Critico | `ownershipLockedUntil`, row locks y uniqueness pueden bloquear o duplicar ownership si se modifica mal. |
| Auto accept | Alto | WhatsApp inbound puede cambiar ownership/estado automaticamente. |
| Lead routing | Critico | Combina public runtime, rotation pool, ad wheel, fallback sponsor y paid/organic attribution. |
| WhatsApp ownership | Critico | `MessagingConnection` pertenece a Sponsor; cambios a cuenta/owner pueden romper instanceName, webhook y CRM inbound. |
| Runtime Context | Critico | Es fuente para bindings, resolve-full, config sync, action context y ownership upsert. |
| Kloser | Alto | Handoff externo depende de HMAC, mission state y payload MLM-safe. |
| n8n | Alto | Dispatch y webhooks tienen secretos/rutas internas; errores pueden duplicar o perder automatizaciones. |
| AI Gateway | Alto | Orquestacion depende de `instanceName`, `sessionId` y `funnelId`; cambios de modelo pueden romper sesiones. |
| Tracking/CAPI | Critico | Tokens por publication, pixel IDs publicos, `CompleteRegistration` y `event_id` dedupe son sensibles. |
| Kredits | Alto | Wallet debits/credits afectan cobros, seats, bienvenida y ad wheels. |
| Knowledge/RAG | Medio | Usa Runtime Context/n8n ingestion y `KnowledgeAudit`; riesgo principal en sync/config y costo Kredits. |
| Domain/publication SEO/OG | Medio | Cambios de publication/domain afectan runtime publico, metadata y assets OG. |
| Supabase CRM read | Medio | Store externo opcional puede divergir del CRM local si cambia el modelo de cuenta. |

## 10. Confirmacion final

"LeadFlow se encuentra respaldado y existe un punto de retorno seguro para iniciar la evolución del modelo de cuentas."
