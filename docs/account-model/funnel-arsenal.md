# Funnel Arsenal por Business Blueprint

El Funnel Arsenal es la ruta simple para cuentas individuales. Los usuarios básicos no crean embudos desde cero: habilitan manualmente un embudo sugerido para su tipo de negocio.

## Modelo

```text
BusinessBlueprint
-> Funnel Arsenal
-> Funnel Template
-> Enable for my account
-> FunnelPublication del Team personal
```

Cada template está definido de forma estática en `@leadflow/account-model` con:

- `templateKey`
- `blueprintKey`
- `label`
- `description`
- `goal`
- `recommendedFor`
- `cta`
- `pathSuggestion`
- `difficulty`
- `blocksPresetKey`

## Builder Avanzado vs Arsenal

El builder avanzado sigue existiendo para Team Admin y flujos avanzados. El arsenal no lo reemplaza, no elimina sus rutas y no cambia permisos críticos del builder.

Para cuentas individuales, `/member/funnels` muestra templates recomendados y permite habilitarlos con un botón. No muestra herramientas de edición avanzada ni creación desde cero.

## Resolución de Blueprint

`GET /v1/funnel-arsenal/me` valida el team actual, lee `CommercialProfile` y usa `blueprintKey` para devolver los templates del blueprint.

Si no existe `CommercialProfile`, se usa el fallback `blueprint.other.v1`.

## Habilitación Manual

`POST /v1/funnel-arsenal/me/:templateKey/enable`:

- valida usuario autenticado y team personal individual;
- valida que el template pertenezca al blueprint del perfil;
- crea un `FunnelTemplate`, `Funnel`, `FunnelInstance`, pasos mínimos y `FunnelPublication` propios del team personal;
- usa `pathSuggestion` y agrega sufijo si el path ya existe;
- es idempotente por `funnelInstance.code`;
- deja tracking, handoff, IA y automatizaciones sin configurar.

## Qué No Se Automatiza Todavía

- No se crean embudos al crear la cuenta.
- No se activa IA.
- No se conecta n8n.
- No se crea ni modifica CRM.
- No se modifica ownership.
- No se toca WhatsApp, Kloser, Tracking ni CAPI.
- No se reemplaza el builder avanzado.
