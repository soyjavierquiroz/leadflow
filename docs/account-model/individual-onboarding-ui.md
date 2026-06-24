# Individual onboarding UI

## Ruta

`/onboarding/individual`

La ruta vive en el App Router web y requiere usuario autenticado. Si no existe
sesion, redirige a `/login` usando el mismo helper de sesion de la app.

## Objetivo

Permitir que un usuario autenticado cree su espacio inicial como
`Propietario de Cuenta` sin cambiar el modelo interno actual:

Individual = Workspace individual + Team personal + Sponsor owner + User
TEAM_ADMIN.

## Payload

El formulario llama a `POST /v1/onboarding/individual` mediante el cliente
autenticado existente.

```json
{
  "businessName": "Ana Studio",
  "niche": "Belleza",
  "country": "Mexico",
  "phone": "+5215555555555"
}
```

`businessName` es obligatorio. `niche`, `country` y `phone` se envian solo
cuando tienen valor.

## Copy

- "Crea tu espacio de ventas"
- "Organiza tus prospectos de WhatsApp"
- "Empieza solo y luego invita a tu equipo"

La UI evita terminos tecnicos como tenant, team admin, sponsor, workspace, team
u owner tecnico.

## Estados UI

- Validacion local para `businessName` no vacio.
- Boton deshabilitado mientras el submit esta pendiente.
- Copy de carga: "Creando espacio..."
- Error visible dentro del formulario.
- Redirect exitoso a `response.redirectTo` o fallback `/member/crm`.

## Errores esperados

- `409`: "Tu usuario ya pertenece a una cuenta existente. Ingresa desde tu panel actual."
- `401`: redireccion a `/login` segun el patron existente.
- Otros errores: mensaje generico para reintentar.

## Guardrails

- No fuerza onboarding a usuarios existentes.
- No cambia el redirect global post-login.
- No duplica Workspace, Team ni Sponsor; el backend mantiene la idempotencia.
- No modifica CRM, ownership, WhatsApp, IA, Kloser, n8n, Tracking/CAPI, roles
  internos ni permisos criticos.
- No cambia login existente.
