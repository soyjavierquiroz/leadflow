# Super Admin individual account creation

Fecha: 2026-06-24

## Resumen

Leadflow no abre signup publico general todavia. Para crear vendedores
independientes en produccion, Super Admin usa una accion operativa en
`/admin/tenants`.

Flujo:

1. Super Admin entra a `/admin/tenants`.
2. Abre `Crear cuenta individual`.
3. Completa propietario, email, negocio y datos opcionales.
4. El backend crea el usuario y su contexto individual completo.
5. El propietario entra por `/login`.
6. Luego opera en `/member/crm`.

## Ruta Admin

UI: `/admin/tenants`

Accion visible:

- `Crear cuenta individual`

Copy del modal:

- `Crear cuenta individual`
- `Para vendedores independientes que empiezan solos y luego pueden crecer a equipo.`

El formulario visible evita terminos internos como tenant, sponsor y workspace.

## Endpoint

`POST /v1/system/tenants/individual`

Proteccion:

- Requiere sesion autenticada.
- Requiere `User.role = SUPER_ADMIN`.
- Usuarios sin sesion reciben rechazo de auth.
- Usuarios autenticados sin rol `SUPER_ADMIN` reciben rechazo de permisos.

Payload:

```json
{
  "name": "Ana Owner",
  "email": "ana@example.com",
  "phone": "+59170000000",
  "businessName": "Ana Studio",
  "niche": "Belleza",
  "country": "Bolivia",
  "temporaryPassword": "opcional",
  "sendInviteEmail": false
}
```

Campos requeridos:

- `name`
- `email`
- `businessName`

Reglas:

- `email` se normaliza a lowercase.
- `email` debe ser unico.
- Si `email` ya existe, responde `409` con codigo
  `INDIVIDUAL_ACCOUNT_EMAIL_EXISTS`.
- `temporaryPassword` es opcional.
- Si no se envia `temporaryPassword`, el backend genera una contraseña segura.
- La contraseña no se loggea.
- La contraseña temporal se devuelve solo en la respuesta inmediata para que
  Super Admin pueda copiarla.

Respuesta:

```json
{
  "userId": "user-id",
  "workspaceId": "workspace-id",
  "teamId": "team-id",
  "sponsorId": "sponsor-id",
  "email": "ana@example.com",
  "temporaryPassword": "valor-de-un-solo-uso-visual",
  "loginUrl": "/login",
  "recommendedRedirect": "/member/crm",
  "accountType": "individual",
  "teamType": "personal"
}
```

## Entidades Creadas

La creacion ocurre en transaccion:

- `User`
  - `role = TEAM_ADMIN`
  - `status = active`
  - email normalizado
  - password hasheado con el helper de auth actual
- `Workspace`
  - `accountType = individual`
  - `status = active`
  - defaults actuales: `UTC`, `USD`, `es`
- `Team`
  - `teamType = personal`
  - `maxSeats = 1`
  - `status = active`
  - `isActive = true`
  - `managerUserId = userId`
- `Sponsor`
  - owner operativo del usuario
  - `status = active`
  - `isActive = true`
  - `availabilityStatus = available`
  - `memberPortalEnabled = true`
- `RotationPool`
  - fallback activo con el sponsor owner como miembro

El endpoint reutiliza el provisioning individual existente para mantener las
semanticas de `Workspace.accountType`, `Team.teamType`, owner sponsor y pool
fallback en un solo camino.

## Password e Invitacion

No hay signup publico, magic link ni invitacion por token para este caso.

Si `sendInviteEmail = true`, el backend intenta usar la infraestructura actual
de welcome email con la contraseña temporal. Un fallo de envio se registra como
error operativo, pero no revierte la cuenta ya creada.

La UI muestra la contraseña temporal devuelta con la advertencia:

`Copiala ahora. No se volvera a mostrar.`

## Guardrails

Este flujo no reutiliza usuarios existentes. Si el email ya existe, responde
`409` y no intenta mezclar contextos.

La transaccion evita parciales de `User` sin cuenta individual si falla el
provisioning de workspace, team, sponsor o pool.

No cambia:

- CRM
- Lead
- Assignment
- Ownership MLM
- WhatsApp
- MessagingConnection
- Runtime Context
- Kloser
- n8n
- AI Gateway
- Tracking/CAPI
- permisos actuales de `TEAM_ADMIN` y `MEMBER`
- login publico general
- creacion actual de agencias/team tenants

## Prueba End-To-End

1. Entrar como `SUPER_ADMIN`.
2. Ir a `/admin/tenants`.
3. Abrir `Crear cuenta individual`.
4. Completar:
   - Nombre del propietario
   - Email nuevo
   - Nombre del negocio
   - Datos opcionales si aplican
5. Crear la cuenta.
6. Copiar la contraseña temporal si se muestra.
7. Cerrar sesion.
8. Entrar por `/login` con el email creado.
9. Confirmar llegada a `/member/crm`.
10. Verificar en base de datos:
    - `User.role = TEAM_ADMIN`
    - `Workspace.accountType = individual`
    - `Team.teamType = personal`
    - `Team.maxSeats = 1`
    - `User.sponsorId` apunta al owner sponsor
    - existe pool fallback activo con ese sponsor

## Validacion Tecnica

Comandos recomendados:

```bash
pnpm --filter @leadflow/api test -- account-provisioning team-provisioning-defaults
pnpm --filter @leadflow/web test -- system-individual-accounts
pnpm --filter @leadflow/api typecheck
pnpm --filter @leadflow/web typecheck
```
