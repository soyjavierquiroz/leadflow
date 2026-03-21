# Roles & Auth v1

## Objetivo
Agregar autenticacion real minima a Leadflow sin rehacer las superficies privadas ya creadas en `apps/web`.

El foco de esta fase es:
- login funcional
- sesion segura por cookie HttpOnly
- roles base
- guards backend
- proteccion de rutas frontend
- usuarios demo sembrados en seed

Queda fuera de esta fase:
- SSO
- MFA
- recuperacion de password
- invitaciones
- gestion avanzada de usuarios
- permisos finos por recurso

## Roles base
- `SUPER_ADMIN`
  - acceso a `/admin/*`
  - acceso a endpoints privados de plataforma como `GET /v1/workspaces`
- `TEAM_ADMIN`
  - acceso a `/team/*`
  - acceso a endpoints privados scopeados al team/workspace
- `MEMBER`
  - acceso a `/member/*`
  - acceso a sus leads y assignments scopeados a su sponsor

## Modelo persistente

### `User`
Campos principales:
- `id`
- `workspaceId`
- `teamId`
- `sponsorId`
- `fullName`
- `email`
- `passwordHash`
- `role`
- `status`
- `lastLoginAt`

Relaciones:
- `Workspace -> User[]`
- `Team -> User[]`
- `Sponsor -> User?`

Decisiones pragmáticas:
- `SUPER_ADMIN` puede vivir a nivel workspace sin team ni sponsor.
- `TEAM_ADMIN` se asocia a `workspaceId + teamId`.
- `MEMBER` se asocia a `workspaceId + teamId + sponsorId`.
- `sponsorId` es unico para mantener un member principal por sponsor en esta fase.

### `AuthSession`
Campos principales:
- `id`
- `userId`
- `sessionTokenHash`
- `expiresAt`
- `lastSeenAt`
- `userAgent`
- `ipAddress`

Decisiones:
- el token de sesion se guarda solo hasheado en DB
- el navegador recibe un token opaco en cookie
- la cookie usa `HttpOnly` y `SameSite=Lax`

## Flujo de login
1. La web renderiza `/login`.
2. El usuario envia email y password a `POST /v1/auth/login`.
3. El API valida el password con `scrypt`.
4. El API crea `AuthSession`, actualiza `lastLoginAt` y setea cookie de sesion.
5. La respuesta devuelve `user` y `redirectPath`.
6. La web redirige segun rol:
   - `SUPER_ADMIN -> /admin`
   - `TEAM_ADMIN -> /team`
   - `MEMBER -> /member`

Endpoints auth:
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`

## Proteccion backend
Se agrego un `AuthModule` con:
- `AuthService`
- `SessionAuthGuard`
- `RolesGuard`
- decoradores `RequireAuth`, `RequireRoles`, `CurrentAuthUser`

Patron operativo:
- los endpoints privados leen la sesion desde cookie
- el guard adjunta el usuario autenticado al request
- el controller aplica el scope correcto segun rol

Ejemplos:
- `SUPER_ADMIN` puede listar `workspaces`
- `TEAM_ADMIN` no puede leer `workspaces`, pero si `teams`, `funnels`, `publications`, `sponsors`, `pools`, `leads`
- `MEMBER` puede leer sus `leads` y `assignments`, pero no `teams` ni `workspaces`

## Proteccion frontend
La proteccion vive en `apps/web/lib/auth.ts` y en los layouts de cada superficie.

Reglas:
- sin sesion: redirect a `/login`
- con sesion y rol incorrecto: redirect al `homePath` del rol autenticado
- con sesion correcta: render normal del shell

Layouts protegidos:
- `app/(admin)/layout.tsx`
- `app/(team)/layout.tsx`
- `app/(member)/layout.tsx`

## Integracion con app shells existentes
No se rehizo la UI base. En cambio:
- se reutilizaron los layouts y la navegacion ya creados
- el top bar ahora muestra el usuario autenticado real
- los app shells usan `GET /v1/auth/me` para derivar contexto actual
- las colecciones visibles siguen usando datos reales cuando el endpoint existe
- donde todavia no hay backend suficiente, se mantiene fallback controlado a mocks

## Seed demo
El seed crea usuarios listos para validar la fase:
- `admin@leadflow.local / Admin123!`
- `team@leadflow.local / Team123!`
- `ana.member@leadflow.local / Member123!`
- `bruno.member@leadflow.local / Member456!`

Relaciones demo:
- 1 `SUPER_ADMIN` sobre el workspace principal
- 1 `TEAM_ADMIN` sobre `Sales Core`
- 2 `MEMBER` vinculados a sponsors demo

## Pendiente para fases futuras
- invitaciones y alta de usuarios desde UI
- edicion de perfil persistente
- password reset
- expiracion/rotacion de sesiones mas avanzada
- CSRF hardening adicional para mutaciones privadas
- permisos finos por recurso
- soporte para acceso cross-surface cuando el negocio lo requiera
