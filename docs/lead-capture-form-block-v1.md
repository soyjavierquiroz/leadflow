# Lead Capture Form Block v1

Fecha: 2026-03-26 (UTC)

## Objetivo

Convertir la captura pública de Leadflow en un bloque declarativo de primera clase dentro del runtime JSON-driven, sin abrir formularios arbitrarios ni endpoints custom.

## Nombre de bloque

- `lead_capture_form`

Compatibilidad mantenida:

- `form_placeholder` sigue resolviendo al mismo bloque mediante normalización interna.

## Contrato del bloque

### Props de bloque

- `eyebrow`
- `headline`
- `subheadline`
- `button_text`
- `helper_text`
- `privacy_note`
- `success_mode`
- `fields`
- `settings`

### `success_mode`

Valores soportados en v1:

- `next_step`
- `inline_message`

Comportamiento:

- `next_step`: si el motor devuelve `nextStep`, el runtime navega automáticamente.
- `inline_message`: el bloque muestra confirmación inline y no hace redirect automático.

### `fields`

Cada field soporta:

- `name`
- `label`
- `type`
- `required`
- `placeholder`
- `autocomplete`
- `width`
- `options`
- `hidden`
- `default_value`

### Tipos de field soportados

- `text`
- `tel`
- `email`
- `textarea`
- `select`
- `hidden`

### `settings`

En v1 se soporta de forma explícita:

- `capture_url_context`
- `source_channel`
- `tags`
- `success_message`

No se permite:

- endpoint por JSON
- submit custom
- lógica arbitraria por bloque
- ejecución de callbacks libres

## Cómo se conecta con el motor estándar

El submit del bloque sigue yendo a:

- `POST /v1/public/funnel-runtime/submissions`

Y el motor estándar sigue resolviendo:

- registro o actualización de visitor
- creación o actualización de lead
- assignment
- `nextStep`
- persistencia de contexto de sesión
- handoff visible posterior
- tracking browser-side y server-side ya existente

## Contexto de URL capturado

Cuando `settings.capture_url_context` está activo, el bloque captura:

- `utm_source`
- `utm_campaign`
- `utm_medium`
- `utm_content`
- `utm_term`
- `fbclid`
- `gclid`
- `ttclid`

Persistencia actual:

- `utmSource` y `utmCampaign` siguen alimentando `Visitor`
- el resto queda en payload operativo del runtime y del tracking
- hidden fields del bloque también pueden poblarse desde la URL sin volver frágil el formulario

## Mapeo controlado de campos

El runtime mapea de forma controlada los campos reconocidos hacia el payload core:

- `fullName`
- `phone`
- `email`
- `companyName`

Los demás valores declarativos se envían como `fieldValues` operativos para trazabilidad, pero no abren lógica libre en persistencia.

## Seed/demo usado en esta fase

El seed del funnel demo ya usa `lead_capture_form` real con:

- nombre
- WhatsApp
- email
- empresa
- select de tamaño de equipo
- textarea de objetivo principal
- hidden fields para UTMs/click ids

## Limitaciones actuales

- no existe builder visual
- no hay validaciones condicionales complejas por field
- no hay multi-step form
- los campos extra no crean todavía columnas nuevas en dominio
- el motor sigue exigiendo nombre y al menos un canal de contacto útil

## Qué sigue después

- presets de formulario por template/funnel type
- validaciones declarativas más ricas sin abrir lógica libre
- variantes de layout del bloque
- mejor explotación operativa de `fieldValues` y attribution context dentro del producto
