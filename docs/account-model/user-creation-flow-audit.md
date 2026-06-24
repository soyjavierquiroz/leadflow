# User creation flow audit

Fecha: 2026-06-24

## Alcance

Esta auditoria cubre el flujo completo desde creacion de usuario hasta cuenta
individual operativa.

No se implementaron cambios de producto ni backend. No se tocaron CRM,
ownership, WhatsApp, IA, Kloser, n8n, Tracking/CAPI, permisos ni migraciones.

## Resumen ejecutivo

El alta individual ya tiene la segunda mitad del flujo:

1. Usuario autenticado sin `workspaceId`, `teamId` ni `sponsorId`.
2. Redirect post-login a `/onboarding/individual`.
3. `POST /v1/onboarding/individual`.
4. Provisioning de `Workspace individual`, `Team personal`, `Sponsor owner` y
   vinculacion del `User`.
5. Redirect a `/member/crm`.

El hueco esta antes de ese punto: hoy no hay una forma publica o clara de crear
ese `User` inicial sin contexto. Entrar a `/onboarding/individual` sin sesion
redirige correctamente a `/login`, pero el login solo acepta usuarios ya
existentes.

La recomendacion minima para produccion actual es agregar una accion de Super
Admin: `Crear cuenta individual`. Debe crear un `User` activo y luego
provisionar el contexto individual usando el servicio existente de onboarding,
o un servicio compartido que reutilice su logica transaccional. Esto permite
validar mercado manualmente sin abrir signup publico todavia.

## Estado actual

### Auth y sesion

- URL web: `/login`
- Endpoint API: `POST /v1/auth/login`
- Servicio: `AuthService.authenticate()`
- Tablas: `User`, `AuthSession`
- Credencial: email + password con hash `scrypt`
- Roles: `SUPER_ADMIN`, `TEAM_ADMIN`, `MEMBER`
- Redirect API:
  - `SUPER_ADMIN -> /admin`
  - `TEAM_ADMIN -> /team`
  - `MEMBER -> /member`
- Redirect web adicional: `loginWithServerSession()` llama
  `getPostAuthRedirectPath()`. Si el usuario autenticado no tiene contexto
  operativo, redirige a `/onboarding/individual`.

No hay endpoint `POST /v1/auth/register`, `POST /v1/auth/signup`, magic link ni
OAuth. La sesion se resuelve por cookie HttpOnly y `GET /v1/auth/me`.

### Password reset

- URL web: `/auth/forgot-password`
- URL web: `/auth/reset-password?token=<token>`
- Servicio: server actions en `apps/web/app/login/actions.ts`
- Tablas: `User.resetToken`, `User.resetTokenExpires`
- Email: `sendPasswordResetEmail()` via paquete compartido `@leadflow/mail`
- Limite: sirve para usuarios ya existentes. No crea usuarios ni invitaciones.

### SSO

- URL/API: `/v1/sso/blacklist`, `/v1/system/sso/blacklist-admin`
- Servicio: `SsoService`
- Estado: genera URLs/JWT para Blacklist a partir de usuario autenticado.
- Limite: no es proveedor de login ni crea usuarios.

## Como se crean usuarios hoy

### 1. Super Admin crea tenant/agencia

Mapa:

| Campo | Valor |
| --- | --- |
| URL | `/admin/tenants` |
| Accion UI | `Crear Agencia` |
| Endpoint | `POST /v1/system/tenants` |
| Controller | `SystemTeamsController.createTenant()` |
| Servicio | `TeamsService.createSystemTenant()` -> `TeamsService.provisionTenant()` |
| Guard | `SystemTenantAccessGuard`, requiere `SUPER_ADMIN` |
| Payload UI actual | `{ tenantName, adminEmail }` |
| Tablas principales | `Workspace`, `Team`, `User`, `Sponsor`, `RotationPool`, `RotationMember`, `AiAgentConfig` |
| Roles creados | `User.role = TEAM_ADMIN`, `User.status = active` |
| Password | Generado si no se provee `adminPassword`; se envia por email y se devuelve como `temporaryPassword` en `provisionTenant()` |
| Email | `MailService.sendWelcomeEmail(adminEmail, adminPassword, teamName)` |
| Redirect | La UI muestra toast y refresca. No loguea al nuevo admin automaticamente. |

Detalles:

- `createSystemTenant()` recibe solo `tenantName` y `adminEmail`.
- Deriva `adminFullName` desde email y tenant.
- Llama `provisionTenant()` con `workspaceName`, `teamName`,
  `adminFullName`, `adminEmail` y `sponsorDisplayName`.
- `provisionTenant()` crea `Workspace` activo con defaults actuales.
- Crea `Team` activo con `teamType` default `commercial_team` y `maxSeats`
  default `10`.
- Crea `User` admin activo.
- Crea `Sponsor` activo para ese admin.
- Vincula `User.sponsorId`.
- Actualiza `Team.managerUserId`.
- Crea pool fallback y asegura config IA default.
- Provisiona wallets/kredits de tenant y sponsor.

Acceso posterior:

- El admin creado puede iniciar sesion en `/login`.
- Desde `/admin/tenants`, Super Admin tiene accion `Ingresar como Cliente`.
- Esa accion llama `POST /v1/system/auth/impersonate/:targetUserId` y redirige
  al `homePath` del usuario objetivo, normalmente `/team`.

### 2. Team Admin crea miembro/asesor

Mapa:

| Campo | Valor |
| --- | --- |
| URL | `/team/members` |
| Accion UI | `Invitar usuario` |
| Endpoint | `POST /v1/team/members` |
| Controller | `TeamMembersController.create()` |
| Servicio | `TeamMembersService.invite()` |
| Guard | `RequireRoles(SUPER_ADMIN, TEAM_ADMIN)` con scope de workspace/team |
| Payload UI actual | `{ fullName, email, whatsappNumber }` |
| Tablas principales | `User`, `Sponsor`; tambien wallets/kredits async |
| Rol creado | `User.role = MEMBER` |
| Estado inicial | `User.status = disabled`, `Sponsor.isActive = false` |
| Password | Temporal generado y devuelto en respuesta |
| Email | `MailerService.sendAdvisorWelcomeEmail()` |
| Redirect | No hay redirect. La UI cierra modal y muestra password temporal. |

Detalles:

- No es una invitacion por token. El usuario se crea inmediatamente.
- El miembro no puede operar hasta activacion de licencia.
- Activacion: `PATCH /v1/team/members/:id/status` con `{ isActive: true }`.
- Al activar, si hay asiento disponible, se marca `Sponsor.isActive = true` y
  `User.status = active`.
- Team Admin puede impersonar miembros desde `/team/members` con
  `POST /v1/team/members/:id/impersonate`.

### 3. Seeds/scripts

Mapa:

| Campo | Valor |
| --- | --- |
| Archivo | `apps/api/prisma/seed.js` |
| Servicio | Script Prisma directo |
| Tablas | `Workspace`, `User`, `Team`, `FunnelTemplate`, `Funnel`, `Domain`, `FunnelInstance`, `FunnelStep`, `FunnelPublication` |
| Usuario creado | `admin@leadflow.local` con rol `SUPER_ADMIN` |
| Password | `Admin123!` hasheado con `scrypt` |
| Redirect | No aplica |

El seed actual observado crea un Super Admin local y data base de Immunotec. La
documentacion antigua `docs/roles-auth-v1.md` menciona usuarios demo
adicionales, pero el seed actual en repo ya no refleja exactamente esa lista.

### 4. Password reset

No crea usuarios. Solo permite setear password nuevo para usuarios existentes
con `User.resetToken` vigente.

### 5. Auth providers

No se encontro signup publico, magic links, OAuth ni proveedor externo de auth
para crear usuarios. El modulo SSO existente es de salida hacia Blacklist, no de
entrada para autenticacion Leadflow.

## Existe signup publico

No.

Rutas web revisadas:

| Ruta | Estado |
| --- | --- |
| `/register` | No existe |
| `/signup` | No existe |
| `/login` | Existe, solo login |
| `/auth/forgot-password` | Existe, recuperacion para usuarios existentes |
| `/auth/reset-password` | Existe, set password via token existente |
| `/onboarding/individual` | Existe, requiere sesion |
| `/admin/users` | No existe |
| `/admin/tenants` | Existe, crea tenant/agencia |
| `/team/members` | Existe, crea miembros dentro de team existente |

Endpoints de creacion de usuario encontrados:

| Endpoint | Crea usuario | Comentario |
| --- | --- | --- |
| `POST /v1/system/tenants` | Si | Admin inicial de tenant, via Super Admin |
| `POST /v1/system/provision-tenant` | Si | Provisioning completo de tenant |
| `POST /v1/team/members` | Si | Miembro de team existente |
| `POST /v1/onboarding/individual` | No crea el usuario base | Provisiona contexto para usuario autenticado existente |

## Como se crea tenant/team actualmente

Flujo Super Admin:

1. Super Admin entra a `/admin/tenants`.
2. UI carga tenants con `GET /v1/system/tenants?includeArchived=true`.
3. Super Admin abre `Crear Agencia`.
4. UI valida `{ tenantName, adminEmail }`.
5. UI llama `POST /v1/system/tenants`.
6. `SystemTenantAccessGuard` exige sesion `SUPER_ADMIN`.
7. `TeamsService.createSystemTenant()` normaliza input.
8. `TeamsService.provisionTenant()` crea todo el contexto.
9. UI muestra `Agencia creada. Accesos enviados.` y refresca.

Entidades creadas:

- `Workspace`
  - `status = active`
  - `accountType = team` por default de schema
  - timezone/currency/locale defaults
- `Team`
  - `status = active`
  - `teamType = commercial_team` por default de schema
  - `maxSeats = 10` si no se provee otro valor
  - `managerUserId = adminUser.id`
- `User`
  - `workspaceId = workspace.id`
  - `teamId = team.id`
  - `sponsorId = sponsor.id`
  - `role = TEAM_ADMIN` por default del servicio
  - `status = active`
- `Sponsor`
  - `workspaceId = workspace.id`
  - `teamId = team.id`
  - `status = active`
  - `isActive = true`
  - `memberPortalEnabled = true`
- `RotationPool` fallback con `RotationMember` del sponsor owner.
- Config default de IA del tenant.
- Wallet/kredits de tenant y sponsor.

Relacion resultante:

`User -> Sponsor -> Team -> Workspace`

Tambien:

`User.workspaceId/teamId/sponsorId` apuntan directamente al mismo contexto.

## Onboarding individual actual

Mapa:

| Campo | Valor |
| --- | --- |
| URL | `/onboarding/individual` |
| Endpoint | `POST /v1/onboarding/individual` |
| Controller | `AccountProvisioningController.provisionIndividualAccount()` |
| Servicio | `AccountProvisioningService.provisionIndividualAccount()` |
| Guard | `RequireAuth()` |
| Payload | `{ businessName, niche?, country?, phone? }` |
| Tablas | `Workspace`, `Team`, `Sponsor`, `User`, `RotationPool`, `RotationMember` |
| Roles | Mantiene `SUPER_ADMIN` si ya lo era; si no, actualiza a `TEAM_ADMIN` |
| Redirect | API devuelve `redirectTo: "/member/crm"` |

Flujo web:

1. Usuario abre `/onboarding/individual`.
2. `getSessionUser()` llama `GET /v1/auth/me`.
3. Si no hay sesion, redirect a `/login`.
4. Si el usuario ya tiene contexto operativo, redirect a `user.homePath`.
5. Si `needsIndividualOnboarding(user)` es true, renderiza formulario.
6. Submit llama `POST /v1/onboarding/individual`.
7. Exito redirige a `/member/crm`.

Condicion de `needsIndividualOnboarding()`:

- No aplica a `SUPER_ADMIN`.
- Requiere usuario autenticado sin team existente.
- Requiere ausencia de workspace/team operativos.
- Requiere ausencia de sponsor operativo activo.

Servicio actual:

- Valida `businessName`.
- Rechaza usuarios que ya pertenezcan a tenant/team no individual.
- Crea `Workspace.accountType = individual`.
- Crea `Team.teamType = personal`, `maxSeats = 1`.
- Crea o normaliza `Sponsor` owner activo.
- Vincula `User.workspaceId`, `User.teamId`, `User.sponsorId`.
- Cambia rol a `TEAM_ADMIN`, salvo que el usuario sea `SUPER_ADMIN`.
- Asegura `Team.managerUserId`.
- Asegura pool fallback con owner.

Hueco clave:

Este endpoint presupone que el `User` ya existe y esta autenticado. No crea
email/password ni sesion inicial.

## Huecos identificados

- No hay signup publico.
- No hay `/register` ni `/signup`.
- No hay endpoint publico de creacion de usuario.
- No hay magic link de alta.
- No hay email verification de cuenta nueva.
- No hay invitacion individual por token.
- No hay accion Super Admin para `Crear cuenta individual`.
- No hay UI para crear un `User` sin workspace/team/sponsor.
- El CTA actual de login hacia `/onboarding/individual` no resuelve el alta si
  el visitante no tiene cuenta; vuelve a `/login`.
- `POST /v1/onboarding/individual` no puede completar el flujo por si solo
  porque requiere sesion.
- La creacion por `/team/members` crea miembros dentro de un team existente, no
  owners individuales.
- La creacion por `/admin/tenants` crea cuenta comercial tipo team, no
  individual/personal.
- Password reset existe, pero solo para usuarios existentes.
- El envio de email existe para welcome/password reset, pero no hay plantilla
  especifica de invitacion individual.

## Opciones evaluadas

### Opcion A: Super Admin crea Cuenta Individual

Flujo:

1. Super Admin abre `/admin/tenants` o una vista nueva de cuentas.
2. Accion `Crear cuenta individual`.
3. Payload:

```json
{
  "name": "Ana Owner",
  "email": "ana@example.com",
  "phone": "+5215555555555",
  "businessName": "Ana Studio",
  "niche": "Belleza",
  "country": "Mexico",
  "temporaryPassword": "opcional",
  "sendInviteEmail": true
}
```

4. Backend crea `User` activo con password temporal o provista.
5. Backend provisiona `Workspace individual`, `Team personal`, `Sponsor owner`.
6. Backend envia email o devuelve password temporal al Super Admin.
7. Usuario entra por `/login`.
8. Como ya tiene contexto operativo, puede ir directo a `/member/crm`.

Ventajas:

- Menor exposicion publica.
- Reutiliza patrones actuales de Super Admin y password temporal.
- Permite validar mercado manualmente.
- Evita disenar email verification, anti-abuse y self-serve billing ahora.
- No cambia login.

Riesgos:

- Hay que evitar duplicar logica entre `TeamsService.provisionTenant()` y
  `AccountProvisioningService.provisionIndividualAccount()`.
- Debe ser idempotente o fallar claramente si email ya existe.
- Debe cuidar que el owner individual quede como `TEAM_ADMIN + Sponsor active`
  para acceso a gestion y operacion.
- La UI de `/admin/tenants` mezcla "agencia" y "individual" si se agrega ahi
  sin copy/filtrado minimo.

Esfuerzo estimado: bajo-medio.

### Opcion B: Signup publico individual

Flujo:

1. Visitante abre `/signup` o `/register`.
2. Crea `User` sin contexto o con contexto provisional.
3. Login automatico o email verification.
4. Redirect a `/onboarding/individual`.
5. Onboarding provisiona contexto individual.

Ventajas:

- Flujo self-serve real.
- Aprovecha el onboarding individual actual casi tal cual.
- Puede escalar adquisicion sin operacion manual.

Riesgos:

- Exige decisiones de anti-abuse, email verification, rate limits, spam, estado
  inicial, terminos, billing y soporte.
- Puede abrir cuentas basura en produccion.
- Requiere disenar bien set password/login automatico.
- Mayor superficie de seguridad.

Esfuerzo estimado: medio-alto.

### Opcion C: Crear tenant de 1 miembro usando flujo actual

Flujo:

1. Super Admin usa `provisionTenant()` con `maxSeats = 1`.
2. Se marca `Workspace.accountType = individual`.
3. Se marca `Team.teamType = personal`.
4. Sponsor admin inicial funciona como owner.

Ventajas:

- Reutiliza el provisioning mas probado.
- Ya crea User, Workspace, Team, Sponsor, email, password y wallets.
- Menor cantidad de piezas nuevas si se parametriza bien.

Riesgos:

- `provisionTenant()` hoy es semanticamente de agencia/team comercial.
- Defaults actuales son `accountType = team`, `teamType = commercial_team`.
- Puede filtrar mecanicas de tenants comerciales a individuales.
- Requiere extender DTO/servicio con semantica nueva y tests para no romper
  tenants actuales.

Esfuerzo estimado: medio.

## Recomendacion

Recomendada: Opcion A con reutilizacion controlada del provisioning individual.

Implementacion minima sugerida:

1. Agregar endpoint de sistema:

`POST /v1/system/individual-accounts`

2. Guard:

`SUPER_ADMIN` solamente.

3. Payload:

```json
{
  "name": "Ana Owner",
  "email": "ana@example.com",
  "phone": "+5215555555555",
  "businessName": "Ana Studio",
  "niche": "Belleza",
  "country": "Mexico",
  "temporaryPassword": "opcional",
  "sendInviteEmail": true
}
```

4. Servicio:

- Crear `User` activo con:
  - `fullName = name`
  - `email` normalizado
  - `passwordHash` de password temporal/provisto
  - `role = TEAM_ADMIN`
  - `status = active`
  - sin `workspaceId/teamId/sponsorId` al inicio de la transaccion, o crear todo
    en un metodo unico transaccional.
- Llamar a una variante reusable de `provisionIndividualAccount()` que acepte
  `userId` y payload.
- Garantizar:
  - `Workspace.accountType = individual`
  - `Team.teamType = personal`
  - `Team.maxSeats = 1`
  - `Sponsor.isActive = true`
  - `Sponsor.memberPortalEnabled = true`
  - `User.sponsorId = sponsor.id`
  - `Team.managerUserId = user.id`
- Enviar email de bienvenida individual o devolver password temporal.
- Responder:

```json
{
  "success": true,
  "userId": "...",
  "workspaceId": "...",
  "teamId": "...",
  "sponsorId": "...",
  "temporaryPassword": "solo si no se envio email o segun politica",
  "loginUrl": "/login",
  "homePath": "/member/crm"
}
```

5. UI:

- Agregar accion en Super Admin.
- Puede vivir inicialmente en `/admin/tenants` como modal separado
  `Crear cuenta individual`, pero con copy explicito para no confundir agencia
  comercial con individual.
- En el listado, idealmente mostrar o filtrar `Workspace.accountType` en una
  fase posterior.

6. Redirect post-login:

- Si el endpoint ya provisiona el contexto completo, el usuario no necesita
  pasar por `/onboarding/individual`; al iniciar sesion puede ir directo a
  `/member/crm` o a su `homePath` ajustado en frontend.
- Si se decide crear solo el `User` sin contexto, entonces debe iniciar sesion y
  completar `/onboarding/individual`. Esto conserva el flujo actual, pero deja
  un paso manual adicional.

Preferencia operacional:

Crear contexto completo desde Super Admin para reducir friccion y errores de
alta manual. Mantener `/onboarding/individual` como fallback para usuarios
autenticados sin contexto.

## Esfuerzo

| Area | Esfuerzo | Nota |
| --- | --- | --- |
| Endpoint sistema | Bajo | Patron existente en `SystemTeamsController` |
| Servicio de cuenta individual | Medio | Reutilizar `AccountProvisioningService`, evitar duplicacion |
| UI Super Admin | Bajo-medio | Modal similar a `Crear Agencia` |
| Email welcome individual | Bajo-medio | Reutilizar mailer o copy nuevo |
| Tests | Medio | Unit/integration de idempotencia, conflicto email, defaults semanticos |
| Migraciones | Ninguna esperada | Campos `accountType` y `teamType` ya existen |

## Riesgos

- Confundir individual con tenant comercial en UI/listados.
- Duplicar usuarios si se permite email existente sin politica clara.
- Crear `User` pero fallar antes de crear workspace/team/sponsor si no se usa
  transaccion unica.
- Romper tenants comerciales si se modifica `provisionTenant()` sin defaults
  conservadores.
- Dejar owner individual como `MEMBER` impediria acceso a superficies
  esperadas; debe ser `TEAM_ADMIN` internamente.
- Redirigir a `/team` puede exponer mecanicas de equipo antes del gating de UI.
  Para individual conviene aterrizar en `/member/crm`.
- Envio de email puede fallar. Debe registrarse y devolver password temporal o
  estado claro segun politica.

## Archivos candidatos para siguiente fase

Backend:

- `apps/api/src/modules/account-provisioning/account-provisioning.service.ts`
- `apps/api/src/modules/account-provisioning/account-provisioning.controller.ts`
- `apps/api/src/modules/account-provisioning/dto/provision-individual-account.dto.ts`
- `apps/api/src/modules/teams/system-teams.controller.ts`
- `apps/api/src/modules/teams/teams.service.ts`
- `apps/api/src/modules/teams/dto/provision-tenant.dto.ts`
- `apps/api/src/modules/mail/mail.service.ts`
- `apps/api/src/modules/shared/mailer.service.ts`
- `apps/api/src/modules/auth/auth.service.ts`

Frontend:

- `apps/web/components/system/system-tenants-client.tsx`
- `apps/web/lib/system-tenants.ts`
- `apps/web/lib/system-tenants.types.ts`
- `apps/web/lib/system-tenant-form.schema.ts`
- `apps/web/lib/individual-onboarding.ts`
- `apps/web/lib/individual-onboarding-routing.ts`
- `apps/web/app/onboarding/individual/page.tsx`
- `apps/web/app/login/page.tsx`
- `apps/web/components/auth/login-form.tsx`

Tests/docs:

- `apps/api/src/modules/account-provisioning/account-semantics.spec.ts` o nuevo
  spec de provisioning individual.
- `apps/web/lib/individual-onboarding-routing.spec.ts`
- `apps/web/lib/individual-onboarding.spec.tsx`
- `docs/account-model/individual-onboarding.md`
- `docs/account-model/individual-onboarding-ui.md`

## Siguiente paso recomendado

Implementar una fase pequena:

1. Extraer o agregar metodo transaccional
   `createIndividualAccountFromAdmin(payload)` en un servicio de provisioning.
2. Exponer `POST /v1/system/individual-accounts`.
3. Agregar modal Super Admin `Crear cuenta individual`.
4. Enviar email o mostrar password temporal.
5. Verificar login del usuario creado y acceso a `/member/crm`.

Criterios de aceptacion:

- Super Admin puede crear una cuenta individual real sin signup publico.
- El usuario creado puede iniciar sesion por `/login`.
- La cuenta resultante queda:
  - `Workspace.accountType = individual`
  - `Team.teamType = personal`
  - `Team.maxSeats = 1`
  - `User.role = TEAM_ADMIN`
  - `User.status = active`
  - `Sponsor.isActive = true`
- No cambia CRM, ownership, WhatsApp, IA, Kloser, n8n ni Tracking/CAPI.
- No cambia login para usuarios existentes.
