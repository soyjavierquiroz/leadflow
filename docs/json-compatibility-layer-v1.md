# JSON Compatibility Layer v1

Fecha: 2026-03-26 (UTC)

## Objetivo

Permitir que Leadflow acepte un JSON más cercano al sistema Jakawi/Vexer y lo traduzca al runtime público actual sin rehacer el motor ni abandonar el contrato propio de Leadflow.

## Contrato compatible soportado

La capa de compatibilidad acepta como base:

- `template`
- `ui_config`
- `media_dictionary`
- `hero_block`
- `layout_blocks`

Esto convive con el shape nativo ya existente de Leadflow:

- `{ blocks: [...] }`

## Flujo interno

1. El runtime recibe `blocksJson`.
2. `parseRuntimeBlocks` detecta si el payload es nativo o compatible.
3. Si es compatible:
   - lee `template`
   - lee `ui_config`
   - resuelve `media_dictionary`
   - convierte `hero_block` en bloque principal interno
   - convierte `layout_blocks` al shape interno de `RuntimeBlock`
4. Luego aplica presets/variants.
5. Finalmente renderiza con la misma registry/adapters del runtime actual.

## Modo de compatibilidad

Estados internos:

- `leadflow_native`
- `leadflow_compatible`

Esto permite saber si el step está corriendo JSON nativo o un payload adaptado.

## `media_dictionary`

`media_dictionary` ya queda soportado como capa declarativa.

Uso actual:

- el payload puede referenciar assets por `media_key`, `image_key`, `video_key` y variantes camelCase equivalentes
- la normalización resuelve el asset antes de llegar al adapter
- se soportan entradas tipo string o record con `src`, `url`, `embedUrl`, `alt`, `caption`

## Compatibilidad de bloques

### Compatibles directos o casi directos

- `hero_block` -> `hero`
- `hook_and_promise` -> `hook_and_promise`
- `social_proof` -> `social_proof`
- `urgency_timer` -> `urgency_timer`
- `faq` -> `faq`
- `faq_accordion` -> `faq`
- `video_block` -> `video`

### Compatibles por adapter

- `offer_stack` -> `offer_pricing`
- `features_and_benefits` -> `feature_grid`
- `how_it_works` -> `feature_grid`
- `risk_reversal` -> `social_proof` con variante `risk_reversal`
- `final_cta` -> `cta`

## Bloques pendientes o no soportados todavía

- builders de layout arbitrarios
- lógica condicional libre por bloque
- formularios externos o endpoints custom
- theming complejo por payload
- bloques avanzados de checkout/pricing dinámico

## Archivos principales

- `apps/web/components/public-funnel/runtime-block-utils.ts`
- `apps/web/components/public-funnel/template-presets.ts`
- `apps/web/components/public-funnel/adapters/public-block-adapters.tsx`
- `apps/web/components/public-funnel/funnel-runtime-page.tsx`

## Qué tan cerca deja esto a Leadflow de reutilizar JSONs del otro sistema

Queda razonablemente cerca para payloads de landing/commercial content que ya usen:

- `hero_block`
- `layout_blocks`
- `media_dictionary`
- bloques comerciales estándar

Todavía no es compatibilidad total uno-a-uno, pero sí una base útil para absorber JSONs del otro sistema con menor fricción y sin romper el runtime propio de Leadflow.

## Qué sigue después

- ampliar el catálogo de mappings compatibles
- soportar más estructuras de `ui_config`
- formalizar validación del payload compatible
- añadir más adapters específicos para bloques “externos” de alto valor
