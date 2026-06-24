# Individual onboarding

## Objetivo

La fase 4 agrega un alta controlada para usuario individual sin reemplazar el
provisioning actual de equipos. El modelo operativo es:

Registro -> Workspace individual -> Team personal -> Sponsor owner -> User
TEAM_ADMIN.

Usuario individual significa un Team de una sola persona.

## Entidades creadas

`provisionIndividualAccount(user, payload)` crea o reutiliza:

- `Workspace` con `accountType = individual`.
- `Team` con `teamType = personal`, `maxSeats = 1` y `workspaceId` del
  workspace individual.
- `User` asociado a ese workspace/team con rol interno `TEAM_ADMIN`, salvo que
  el usuario ya sea `SUPER_ADMIN`.
- `Sponsor` owner activo, disponible y vinculado al usuario y al team.
- `RotationPool` fallback activo con el owner como miembro cuando no existe uno.

El endpoint preparado para este flujo es:

`POST /v1/onboarding/individual`

El endpoint requiere usuario autenticado y devuelve el contexto creado junto con
el redirect esperado.

## Payload minimo

```json
{
  "businessName": "Ana Studio",
  "niche": "wellness",
  "country": "BO",
  "phone": "+59170000000"
}
```

`businessName` es obligatorio. `niche`, `country` y `phone` quedan como payload
inicial para evolucionar el onboarding sin cambiar el contrato.

## Idempotencia

El servicio usa una transaccion Prisma y valida primero el usuario autenticado.

Si el usuario ya pertenece a un `Workspace individual` y a un `Team personal`,
reutiliza ese contexto. Si ya tiene `Sponsor` en el team personal, no crea otro.
Si el team ya tiene `RotationPool` fallback activo, lo reutiliza y solo agrega el
owner si falta como miembro.

Si el usuario ya pertenece a un tenant de equipo/comercial, el flujo se detiene
con conflicto para no modificar tenants existentes.

## Redirect esperado

La respuesta del endpoint incluye:

```json
{
  "redirectTo": "/member/crm"
}
```

El flujo individual no cambia los redirects existentes del flujo team ni envia
al usuario al panel avanzado de Team Admin.

## Rol interno

El owner individual sigue siendo `TEAM_ADMIN` internamente porque los guards,
servicios y permisos actuales ya modelan al propietario operativo del tenant con
ese rol. Esta fase agrega semantica de cuenta (`individual` + `personal`) sin
crear un rol nuevo ni cambiar los guards.

Si por alguna razon el usuario ya es `SUPER_ADMIN`, el servicio no lo degrada.

## Sponsor owner

Se crea un `Sponsor` owner porque las superficies operativas existentes usan
`sponsorId` para CRM de miembro, disponibilidad, asignacion, routing y perfiles
operativos. En individual, ese sponsor representa al mismo owner del team
personal.

## Que NO cambia en esta fase

No se modifica:

- Leads.
- Assignments.
- Ownership MLM.
- MessagingConnection.
- Runtime Context.
- Kloser.
- AI Gateway.
- n8n.
- Tracking/CAPI.
- CRM actual.
- Provisioning actual de tenants/equipos.
- Guards o permisos existentes.

Los defaults protegidos siguen siendo:

- `Workspace.accountType = team`.
- `Team.teamType = commercial_team`.

## Evolucion futura a microteam

El siguiente paso natural es permitir que una cuenta individual invite miembros
y pase a `accountType = microteam` manteniendo `Team.teamType = personal` o
creando reglas explicitas de promocion. Esa evolucion debe agregar un flujo
separado, migracion de semantica y tests de compatibilidad antes de ampliar
asientos o ownership.
