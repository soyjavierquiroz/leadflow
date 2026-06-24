# Account Model Impact Analysis

Fecha: 2026-06-24

Baseline seguro:

- Tag: `leadflow-pre-account-evolution-20260624-201946`
- Commit funcional baseline: `4af4407e6e0e455ae8a64f712b7e39438d7c0aeb`
- Documento baseline previo: `docs/baselines/account-evolution-baseline.md`

Alcance de esta fase: analisis, diseno tecnico e inventario. No se implementa comportamiento, no se modifica Prisma schema, no se crean migraciones, no se cambian permisos, no se toca ownership, CRM, WhatsApp, IA ni rutas.

## 1. Resumen ejecutivo

El modelo actual ya permite representar una cuenta individual sin crear entidades nuevas, siempre que se use la composicion existente:

`Workspace -> Team personal -> Sponsor owner -> User TEAM_ADMIN`

El principal reto no es de datos base, sino de semantica y producto: gran parte del codigo asume que `Team` equivale a equipo comercial, que `TEAM_ADMIN` equivale a administrador de equipo, y que las superficies de gestion (`/team/*`) son el centro operativo. Para evolucionar a Individual -> Microequipo -> Team -> Enterprise conviene introducir metadatos futuros en las entidades existentes:

- `Workspace.accountType`: escala comercial/contractual de la cuenta.
- `Team.teamType`: naturaleza operativa del team dentro del workspace.

La recomendacion es preservar los roles internos actuales y cambiar primero la presentacion, onboarding y feature-gating. Esto evita una refactorizacion profunda de guards, ownership, CRM, WhatsApp e IA.

## 2. Mapa de impacto backend

### Supuestos detectados

- `TEAM_ADMIN` es requerido para operar superficies de gestion: teams, members, settings, funnels, publications, rotation pools, ad wheels, team CRM y AI config.
- `MEMBER` opera desde endpoints `sponsors/me/*`, con `sponsorId` como prerequisito implicito.
- `Team` es el scope dominante de operaciones: publicaciones, funnels, domains, tracking profiles, pools, wheels, CRM, AI config y Kredits se consultan por `teamId`.
- `Sponsor` es obligatorio para operacion comercial: leads member, WhatsApp, ad wheel membership, CRM personal, vanity shortlinks, wallet subject y ownership.
- `Workspace` existe como contenedor multi-tenant, pero muchas experiencias reales se activan desde `Team`.
- Onboarding/provisioning actual ya crea workspace, team, admin user, sponsor owner, default rotation pool, AI config y wallet.

### Modulos backend impactados

| Area | Archivos/modulos | Supuesto actual | Impacto futuro |
| --- | --- | --- | --- |
| Auth/roles | `auth/*`, `roles.guard.ts`, `roles.decorator.ts` | Roles internos planos: `SUPER_ADMIN`, `TEAM_ADMIN`, `MEMBER` | Mantener roles, agregar capa de presentacion/capabilities futura. |
| Teams/onboarding | `teams.service.ts`, `system-teams.controller.ts`, `team-members.*`, `team-settings.*` | Provisionar tenant como team comercial con seats | Reutilizar para cuenta individual con `Team personal`, `maxSeats=1` inicial. |
| Sponsors | `sponsors.*`, `team-sponsor-vanity-short-links.*` | Sponsor representa asesor operativo | Para individual, sponsor owner representa al propietario como operador comercial. |
| Funnels/publications | `funnels/*`, `funnel-instances/*`, `funnel-publications/*`, `hybrid-funnel-publications/*` | Administracion desde Team Admin y scope team | Individual puede usar el mismo team personal; UI debe ocultar complejidad de equipo. |
| CRM | `crm/*`, `leads/*`, `assignments/*` | Separacion Team CRM vs Member CRM | Individual debe iniciar en CRM member/unificado simplificado sin romper team CRM. |
| Knowledge/RAG | `knowledge/*`, `ai-config/*` | Configuracion por tenant/team y usuario admin | Debe mostrarse como "Knowledge de cuenta" en individual, sin cambiar storage inicial. |
| Messaging/WhatsApp | `evolution/*`, `messaging-automation/*`, `incoming-webhooks/*` | Instance ownership por sponsor/team | No tocar ownership; individual usa sponsor owner. |
| Public runtime | `public-funnel-runtime/*` | Lead routing requiere publication/team/sponsor/pool | Individual debe provisionar pool default con owner. |
| Rotation/ad wheels | `rotation-pools/*`, `ad-wheels/*` | Equipo con multiples sponsors | Individual debe ocultarlos o tratarlos como infraestructura default. |
| Billing/Kredits | `finance/*`, `system-kredits.*`, `team-members.service.ts` | Team account + sponsor accounts | Individual mantiene tenant wallet y sponsor wallet; billing futuro por `accountType`. |

## 3. Mapa de impacto frontend

### Supuestos detectados

- `requireRole("TEAM_ADMIN")` protege todo el layout `/team`.
- `requireOperationalViewUser()` permite `/member` para `MEMBER` o `TEAM_ADMIN` con sponsor activo.
- `getHomePathForRole()` envia `TEAM_ADMIN -> /team` y `MEMBER -> /member`.
- `getAppShellSnapshot()` deriva `currentTeam` y `currentSponsor`; si faltan usa fallback/mock.
- Navigation actual separa `Team Admin` y `Sponsor / Member`.
- Muchas pantallas usan textos visibles "Team Admin", "Sponsors", "Equipo", "CRM Unificado", "Ruedas", "Pools".

### Superficies frontend impactadas

| Area | Archivos/pantallas | Supuesto actual | Impacto futuro |
| --- | --- | --- | --- |
| Route guards | `apps/web/lib/auth.ts`, layouts `(admin)`, `(team)`, `(member)` | Rutas por rol interno | Puede mantenerse; cambiar home/label/gating por accountType en fase futura. |
| Shell/nav | `app-shell/*`, `(team)/layout.tsx`, `(member)/layout.tsx` | Dos modos: gestion y operacion | Individual necesita una experiencia inicial unificada, probablemente basada en member + accesos selectivos. |
| Dashboard team | `/team` | Centro operativo de equipo | Para individual debe ocultarse o renombrarse a cuenta/operacion cuando aplique. |
| CRM | `/member/crm`, `/team/crm` | CRM personal vs CRM unificado de team | Individual debe ver CRM personal desde inicio; team CRM se desbloquea por microteam/team. |
| Funnels/publications | `/team/publications`, builder VSL, admin tenant builder | Funnels administrados desde Team | Individual necesita acceso a funnel propio sin exponer "team" como concepto. |
| Members/sponsors | `/team/members`, `/team/sponsors` | Gestion de equipo comercial | Ocultar inicialmente para individual; desbloquear con microteam/team. |
| Pools/wheels | `/team/pools`, `/team/wheels`, member active wheel card | Distribucion comercial multi-sponsor | Ocultar inicialmente para individual; default pool queda interno. |
| AI/Knowledge | `/management/ai-config`, `AiSettingsForm` | Team Admin configura IA/Knowledge | Puede ser "IA de mi cuenta" para owner individual, pero requiere copy/gating futuro. |
| WhatsApp | member dashboard / `WhatsAppConnectionManager` | Canal del sponsor | Mostrar desde inicio al owner individual, porque el owner tambien es sponsor. |
| Kredits | member dashboard, `/admin/kredits`, team settings kredits | Balance sponsor/team | Individual debe mostrar balance simple; admin/system se mantiene oculto. |

## 4. Mapa de impacto permisos/guards

### Backend

- `RolesGuard` permite por rol interno exacto y tiene excepcion para Team Admin activo como acceso operacional cuando el decorador lo permite.
- Muchos controladores resuelven scope con `user.workspaceId!`, `user.teamId!`, `user.sponsorId!`.
- `SUPER_ADMIN` puede pasar `teamId` explicito en varios endpoints.
- `TEAM_ADMIN` queda atado al `user.teamId`.
- `MEMBER` queda atado a `user.sponsorId`.

### Frontend

- `requireRole("TEAM_ADMIN")` bloquea `/team` para owner individual si no se conserva `TEAM_ADMIN`.
- `requireOperationalViewUser()` ya permite al Team Admin con sponsor activo usar `/member`.
- Esto favorece el mapeo futuro: propietario individual como `TEAM_ADMIN + Sponsor owner`.

### Recomendacion

No cambiar permisos internos en la primera implementacion. Agregar posteriormente una capa de "capabilities" derivada de `accountType`, `teamType`, `role` y existencia/estado de `sponsorId`.

## 5. Mapa de impacto seeds/onboarding

El flujo `provisionTenant` en `TeamsService` ya crea:

- `Workspace` si no se pasa `workspaceId`.
- `Team` activo con `maxSeats`.
- `User` admin con rol `TEAM_ADMIN` o `SUPER_ADMIN`.
- `Sponsor` activo para el admin.
- `RotationPool` default con el sponsor.
- Link `User.sponsorId`.
- `Team.managerUserId`.
- Config IA default.
- Wallet tenant y welcome Kredits sponsor.
- Deploy opcional de template funnel.

Este flujo es la base ideal para el futuro onboarding individual. Lo que falta es semantica:

- Marcar workspace como `individual`.
- Marcar team como `personal`.
- Ajustar defaults visibles y gating.
- Evitar exponer "team" y "sponsors" cuando hay un solo owner.

## 6. Mapa de impacto integraciones

| Integracion | Dependencias actuales | Impacto del modelo hibrido |
| --- | --- | --- |
| Evolution API | `instanceName`, `teamId/workspaceId`, `sponsorId/userId` | Individual puede funcionar si existe sponsor owner. No cambiar ownership aun. |
| Runtime Context Central | `tenantId` normalmente `teamId`, member/owner por sponsor/instance | Mantener `teamId` como tenant operativo incluso para team personal. |
| IA Gateway | `instanceName`, `funnelId`, `sessionId = instanceName-funnelId` | No cambiar; solo adaptar UI/copy y defaults de funnel. |
| n8n/messaging automation | Assignment, sponsor, messaging connection, webhook secrets | Requiere sponsor owner y pool default; no cambiar contratos. |
| Kloser | Outreach queue, sponsor, assignment, phone/remoteJid | Ocultar o deshabilitar por account type hasta justificar automatizacion. |
| Wallet Engine/Kredits | Tenant account + sponsor account | Individual puede usar ambos; billing futuro decide cuotas y seats. |
| Supabase CRM read | Team/workspace CRM read | Mantener como backend; UI individual debe consumir subset owner. |
| SES mail | Welcome/admin email | Onboarding individual puede reutilizarlo con copy futuro. |
| Tracking/CAPI | FunnelPublication, public runtime, event_id | No tocar en esta fase; account type no debe alterar dedupe/tracking. |

## 7. Tablas afectadas

No se propone crear tablas nuevas todavia.

Tablas/modelos a tocar en fase de migracion futura:

- `Workspace`: agregar `accountType`.
- `Team`: agregar `teamType`.

Tablas que no deben cambiar inicialmente pero dependen de la semantica:

- `User`: mantener `role`, `workspaceId`, `teamId`, `sponsorId`.
- `Sponsor`: mantener owner operativo individual.
- `RotationPool`: seguir usando default pool.
- `Lead`, `Assignment`, `CrmLeadAssignment`, `CrmOutreachQueue`: no cambiar ownership/routing.
- `MessagingConnection`, `AiAgentConfig`, `ChannelInstance`, `KnowledgeAudit`: mantener tenant/team y sponsor/member actuales.
- `FunnelInstance`, `FunnelPublication`, `TrackingProfile`: mantener scope por team.

## 8. Servicios afectados

| Servicio | Esfuerzo | Riesgo | Nota |
| --- | --- | --- | --- |
| `TeamsService.provisionTenant` | Medio | Alto | Punto natural para defaults individual/microteam; toca onboarding y wallets. |
| `TeamMembersService` | Medio | Alto | Seats, roles visibles, asistentes y asesores futuros. |
| `AuthService` / guards | Medio | Alto | Evitar cambios profundos; solo capabilities futuras. |
| `SponsorsService` | Medio | Alto | Owner individual depende de sponsor activo. |
| `FunnelPublicationsService` / hybrid services | Medio | Medio | UI debe permitir funnel individual sin concepto team. |
| `CrmAssignmentService` / CRM services | Alto | Critico | No tocar en primera fase funcional; solo gating/read models. |
| `LeadCaptureAssignmentService` | Alto | Critico | Routing y ownership sensible; conservar pool default. |
| `EvolutionService` / Runtime Context | Medio | Critico | No cambiar tenant/member semantics inicialmente. |
| `AiConfigService` | Medio | Alto | Config tenant/member funciona; adaptar presentacion. |
| `WalletEngineService` | Medio | Alto | Billing/seats por account type debe planearse antes de aplicar. |
| `KnowledgeService` | Medio | Medio | Mostrar como Knowledge de cuenta, mantener tenantId. |

## 9. Pantallas afectadas

### Grupo A: mostrar a usuario individual desde el inicio

- `/member` Dashboard individual.
- `/member/crm` CRM individual.
- `/member/leads` Leads propios.
- `/member/links` Enlaces propios.
- `/member/profile` Perfil.
- WhatsApp connection dentro del dashboard/member operations.
- Balance Kredits simple de sponsor/account.
- Funnel inicial o acceso simplificado a crear/editar funnel propio, cuando exista flujo seguro.
- Tracking/CAPI solo como estado/lectura basica al inicio; edicion avanzada despues.

### Grupo B: ocultar inicialmente

- `/team/members` Equipo / gestion de miembros.
- `/team/sponsors` Sponsors.
- `/team/pools` Rotation Pools.
- `/team/wheels` Ad Wheels.
- Team CRM avanzado `/team/crm` como CRM unificado multi-miembro.
- Outreach queue/Kloser metrics.
- Admin system pages (`/admin/*`), salvo `SUPER_ADMIN`.
- System publications/templates/tenants/kredits.
- Configuracion avanzada de team settings.

### Grupo C: desbloquear por miembros o por `accountType/teamType`

- `/team` dashboard de gestion.
- `/team/leads` vista de leads de equipo.
- `/team/publications` y builder completo.
- `/management/ai-config` Knowledge/RAG y AI team config.
- Tracking/CAPI editable.
- Team settings.
- Rotation Pools cuando hay mas de un asesor o `teamType = commercial_team`.
- Ad Wheels cuando hay plan/equipo comercial y billing habilitado.
- Reports/reporting cuando haya suficiente actividad o plan.
- Kredits avanzados por team cuando account type no sea individual simple.

## 10. Propuesta `Workspace.accountType`

Valores propuestos:

- `individual`
- `microteam`
- `team`
- `enterprise`

Proposito:

- Expresar escala contractual/producto del workspace.
- Controlar onboarding, navegacion, billing, reporting y limites visibles.
- No reemplaza `UserRole`; complementa permisos con contexto de cuenta.

Default sugerido:

- Para workspaces existentes: `team`, porque el producto historico asume equipo comercial.
- Para self-serve nuevo: `individual`.
- Para provisionamiento admin actual: default conservador `team` salvo input explicito.

Compatibilidad hacia atras:

- Mantener null/ausencia como equivalente a `team` durante rollout.
- No recalcular ownership ni sponsor/team existentes.
- Backfill futuro puede marcar workspaces con un solo team y un solo sponsor como candidatos a `individual`, pero no aplicarlo automaticamente sin auditoria.

Impacto UI:

- `individual`: home operacional, lenguaje de cuenta/propietario, ocultar team mechanics.
- `microteam`: mostrar miembros basicos/asistentes, no necesariamente ad wheels.
- `team`: experiencia actual.
- `enterprise`: multi-team, reporting, admin avanzado.

Impacto permisos:

- No debe cambiar guards directamente en primera fase.
- Debe alimentar capabilities futuras como `canManageMembers`, `canAccessTeamCrm`, `canManageTracking`, `canUseAdWheels`.

Impacto billing/seats:

- `individual`: 1 owner seat incluido; asistentes futuros podrian ser add-on.
- `microteam`: seats limitados y roles asistente/asesor.
- `team`: seats comerciales actuales.
- `enterprise`: multi-team/department, reporting y soporte avanzado.

Impacto reporting:

- `individual`: metricas propias.
- `microteam`: metricas por owner/asistente/asesor pequeno.
- `team`: metricas por sponsor, team, funnel, source.
- `enterprise`: agregacion por departments/workspaces/teams.

## 11. Propuesta `Team.teamType`

Valores propuestos:

- `personal`
- `commercial_team`
- `department`

Proposito:

- Distinguir si el `Team` es una unidad personal operativa, un equipo comercial o un departamento enterprise.
- Mantener `Team` como tenant operativo para integraciones.

Default sugerido:

- Existing teams: `commercial_team`.
- Nuevo individual: `personal`.
- Enterprise futuro: `department`.

Compatibilidad hacia atras:

- Ausencia/null se interpreta como `commercial_team`.
- No cambia claves, FK ni rutas existentes.
- Permite que Runtime Context, funnels, CRM y wallets sigan usando `teamId`.

Impacto UI:

- `personal`: ocultar "equipo", "sponsors", "pools", "ruedas"; mostrar "mi cuenta", "mi CRM", "mis funnels".
- `commercial_team`: UI actual.
- `department`: UI enterprise, probablemente con reporting y permisos mas finos.

Impacto permisos:

- `personal` permite `TEAM_ADMIN` como propietario sin exponer administracion de miembros.
- `commercial_team` mantiene gestion de miembros/sponsors.
- `department` requerira capabilities futuras.

Impacto billing/seats:

- `personal`: `maxSeats=1` inicial recomendado.
- `commercial_team`: `maxSeats` actual.
- `department`: seats por departamento y posible parent enterprise.

Impacto reporting:

- `personal`: reportes owner-centric.
- `commercial_team`: reportes por sponsor/pool/funnel.
- `department`: reportes por unidad y agregados.

## 12. Propuesta roles visibles

Mantener roles internos actuales para evitar cambios profundos.

| Rol visible futuro | Mapeo interno inicial | Entidades requeridas | Permisos que se mantienen |
| --- | --- | --- | --- |
| Propietario de Cuenta individual | `TEAM_ADMIN` de `Team personal` + `Sponsor owner` | Workspace, Team, User, Sponsor | Puede entrar a gestion y operacion; UI oculta complejidad team. |
| Asistente | `MEMBER` sin ownership comercial o `MEMBER` con capability limitada futura | User, opcional Sponsor desactivado/no-routing | Fase futura; no tocar guards aun. |
| Asesor | `MEMBER` + `Sponsor` activo | User, Sponsor | CRM/leads/member operations actuales. |
| Administrador | `TEAM_ADMIN` | User con teamId, opcional Sponsor si operara | Gestion de team actual. |
| Super Admin | `SUPER_ADMIN` | User plataforma | Admin system actual. |

Pendiente para fase futura:

- Capabilities por usuario: `canManageBilling`, `canManageFunnels`, `canManageMembers`, `canOperateCrm`, `canReceiveLeads`, `canConnectWhatsapp`.
- Diferenciar asistente sin ownership comercial de asesor con sponsor/routing.
- UI labels por account type sin cambiar `UserRole`.

## 13. Propuesta onboarding futuro

Flujo objetivo:

Registro -> crear Workspace -> crear Team personal -> crear Sponsor owner -> asignar usuario owner -> preparar RotationPool default -> habilitar CRM Individual -> opcional conectar WhatsApp -> opcional crear funnel.

Entidades creadas:

- `Workspace`: nombre, slug, timezone, currency, locale, `accountType=individual` futuro.
- `Team`: workspaceId, name/code derivados del owner/cuenta, `teamType=personal` futuro, `status=active`, `isActive=true`, `maxSeats=1`.
- `User`: workspaceId, teamId, role `TEAM_ADMIN`, status active.
- `Sponsor`: workspaceId, teamId, displayName, email/phone, active, available, routingWeight=1, memberPortalEnabled=true.
- `RotationPool`: default con el sponsor owner.
- `AiAgentConfig`: tenant default.
- Wallet tenant y wallet sponsor.
- Opcional: `MessagingConnection` solo al conectar WhatsApp.
- Opcional: `FunnelInstance/FunnelPublication` solo al crear funnel o aplicar template.

Campos minimos:

- Owner: nombre, email, password.
- Workspace: nombre/slug derivado, timezone, locale.
- Team personal: name/code derivado, maxSeats default.
- Sponsor owner: displayName, email, phone opcional.

Defaults convenientes:

- `Workspace.accountType=individual`.
- `Team.teamType=personal`.
- `Team.maxSeats=1`.
- Default rotation pool: un solo sponsor owner.
- Default AI config por tenant.
- Home inicial: `/member` o dashboard individual equivalente.

Validaciones que deben mantenerse:

- Email unico de usuario.
- Workspace slug unico.
- Team code unico dentro del workspace.
- Sponsor owner activo y linkeado a user.
- `maxSeats >= 1`.
- Sponsor phone normalizado cuando exista.
- Wallet provisioning y AI config no deben fallar silenciosamente sin decision.

No tocar todavia:

- Ownership MLM.
- Assignment locks.
- WhatsApp instance ownership.
- Runtime Context tenant/member semantics.
- CRM lifecycle.
- Tracking/CAPI.
- Kloser/n8n payloads.
- Prisma schema hasta que el diseno sea aprobado.

## 14. Riesgos

| Riesgo | Nivel | Mitigacion |
| --- | --- | --- |
| Cambiar roles internos demasiado pronto | Critico | Mantener `SUPER_ADMIN/TEAM_ADMIN/MEMBER`; agregar labels/capabilities despues. |
| Romper `sponsorId` para propietario individual | Critico | Propietario individual debe tener Sponsor owner activo. |
| Alterar ownership/CRM para adaptar UI | Critico | No tocar CRM/locks; usar gating y defaults. |
| Cambiar `teamId` como tenant operativo | Critico | Mantener team personal como tenant interno. |
| Exponer pantallas team complejas a individual | Alto | Feature-gating por `accountType/teamType`. |
| Billing/seats ambiguos | Alto | Definir contrato antes de migracion; default individual maxSeats=1. |
| IA/Runtime Context dependiente de instanceName/team | Alto | No cambiar semantics; adaptar copy y onboarding. |
| WhatsApp owner ambiguo entre User/Sponsor | Alto | Conservar Sponsor como owner operativo. |
| Backfill automatico incorrecto | Alto | Solo candidatos/auditoria; no convertir sin revision. |
| Reports mezclando personal/equipo | Medio | Agregar filtros por account/team type cuando exista data. |

## 15. Nivel estimado de esfuerzo

| Area | Esfuerzo |
| --- | --- |
| Agregar campos Prisma + backfill conservador | Medio |
| Ajustar onboarding individual usando provisionamiento existente | Medio |
| Feature-gating frontend por account/team type | Medio |
| Renombrar copy y navegacion visible para individual | Medio |
| Capabilities futuras para asistente | Alto |
| Billing/seats por account type | Alto |
| Reporting por account/team type | Medio |
| CRM/ownership real multi-modelo | Alto |
| Enterprise/departments | Alto |

Estimacion global: `Alto` por superficie transversal, aunque la primera entrega puede ser `Medio` si se limita a campos, onboarding y UI gating sin cambiar ownership.

## 16. Recomendacion de implementacion por fases

### Fase 3 propuesta: metadata segura

- Agregar enums/campos `Workspace.accountType` y `Team.teamType`.
- Defaults compatibles: existing = `team`/`commercial_team`.
- Tests de schema/serializacion si aplica.
- No cambiar comportamiento.

### Fase 4 propuesta: lectura y capabilities derivadas

- Exponer account/team type en `/auth/me` o shell snapshot.
- Crear helper de capabilities derivadas.
- Mantener guards actuales.
- No tocar CRM/ownership/WhatsApp.

### Fase 5 propuesta: onboarding individual

- Reutilizar `provisionTenant`.
- Crear Team personal + Sponsor owner + RotationPool default.
- Home inicial individual.
- Validar wallet/AI config.

### Fase 6 propuesta: UI gating individual

- Mostrar Grupo A.
- Ocultar Grupo B.
- Desbloquear Grupo C por account/team type y numero de miembros.
- Cambiar labels visibles: cuenta, propietario, asesor, asistente.

### Fase 7 propuesta: microequipo

- Introducir asistentes/asesores con capabilities.
- Definir si asistente requiere Sponsor o no.
- Mantener routing solo para asesores con Sponsor activo.

### Fase 8 propuesta: team/enterprise

- Expandir departments, reporting, billing avanzado y administracion multi-team.
- Evaluar permisos granulares reales solo cuando las capabilities esten probadas.

## Confirmacion de validacion

Este documento es el unico artefacto esperado de la fase. No se implemento comportamiento funcional, no se modifico Prisma schema, no se crearon migraciones, no se modificaron permisos, no se tocaron tests ni package files.
