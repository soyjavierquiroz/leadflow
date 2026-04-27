# Domain Model

## Tenant vs Team

Estado actual del modelo en `apps/api/prisma/schema.prisma`:

- `Workspace` es la entidad padre.
- `Team` pertenece a un `Workspace` por `workspaceId`.
- La relacion es `1:N`: un `Workspace` puede tener muchos `Team`; cada `Team` pertenece a un solo `Workspace`.

### Diferencia comercial

- En Super Admin, `Tenant` se usa como nombre comercial para una agencia aprovisionada.
- Hoy ese "tenant" se materializa tecnicamente como un `Team` con contexto de `Workspace`.
- `Workspace` funciona como contenedor y frontera compartida; `Team` funciona como unidad operativa explotable.

### Diferencia tecnica

- La suscripcion del cliente vive en `Team`: `subscriptionExpiresAt` y `maxSeats`.
- El consumo de asientos tambien vive en `Team`: se deriva de sus `Sponsor` activos.
- El ownership operativo de dominios, publicaciones, pools, ruedas, tracking, handoff, mensajeria y auditoria vive en `Team`.
- `Lead` no tiene `teamId` directo; vive en `Workspace` y se enruta operativamente por `Funnel`, `FunnelInstance`, `FunnelPublication` y `Assignment`.
- `Assignment` si fija el owner operativo final con `teamId`, `sponsorId` y opcionalmente `rotationPoolId` o `originAdWheelId`.

### Ownership actual por agregado

- Suscripcion y asientos: `Team`
- Sponsors / members: `Team`
- Domains: `Team`
- Funnel instances y funnel publications: `Team`
- Rotation pools y ad wheels: `Team`
- Leads: `Workspace` con ownership operativo derivado hacia `Team`
- Funnels legacy (`Funnel`): `Workspace`, con `defaultTeamId` y `defaultRotationPoolId` opcionales

### Regla practica para UI

- Usa `Tenant` cuando la pantalla hable de aprovisionamiento comercial o administracion del cliente.
- Usa `Team` cuando la pantalla hable de ownership operativo, reparto, sponsors, funnels activos, pools, ruedas o ejecucion diaria.
