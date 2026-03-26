# Compatible Block Expansion v2

Fecha: 2026-03-26 (UTC)

## Objetivo

Expandir la compatibilidad JSON de Leadflow para aceptar payloads más cercanos al ecosistema Jakawi/Vexer sin cambiar el motor del runtime público.

## Qué mejoró en v2

La capa compatible ahora tolera mejor:

- aliases de props
- CTAs anidados
- shapes más ruidosos de media
- arrays con naming alternativo
- diferencias comunes entre `items`, `stats`, `reviews`, `faq_items`, `price_box` y similares

## Bloques con mejora de compatibilidad

### Alta prioridad

#### `hero_block`

Mejoras:

- `badge`, `kicker`, `tag` como alias de `eyebrow`
- `headline`, `heading`, `name` como alias de título
- `subheadline`, `subtitle`, `body`, `copy` como alias de descripción
- `stats`, `kpis`, `numbers` como alias de métricas
- `proof_strip`, `bullets`, `benefits`, `supporting_points` como alias de proof items
- `primary_cta` y `secondary_cta` con `href/url/path`, `label/text/title`, `action`
- soporte de `media_key`, `image_key`, `asset_key` y media inline

#### `hook_and_promise`

Mejoras:

- `title`, `headline`, `heading` como alias de `hook`
- `body`, `copy`, `subheadline` como alias de `promise`
- `bullets`, `points`, `benefits`, `supporting_points` como alias de items
- `primary_cta` o `cta` como CTA principal anidado

#### `social_proof`

Mejoras:

- `stats`, `kpis`, `results` como alias de métricas
- `reviews`, `quotes`, `stories`, `customers` como alias de testimonios
- `proof_items` y `trust_points` como alias de items complementarios
- parsing más tolerante para métricas y reviews:
  - `title/name/headline` para label
  - `stat/number/result` para value
  - `review/testimonial/content` para quote
  - `customer_name/client/person` para author

#### `urgency_timer`

Mejoras:

- `badge` y `tag` como alias de `eyebrow`
- `deadline_at`, `end_at`, `ends_at` como alias de expiración
- `duration_min` y `duration` como alias de duración

#### `offer_stack`

Mejoras:

- `stack_items`, `offer_items`, `included`, `inclusions` como alias de items
- `price_box.amount/value/price` como fuente de precio
- `price_box.note/description/caption` como fuente de nota
- `primary_cta` o `cta` como CTA anidado

#### `faq_accordion`

Mejoras:

- `faq_items`, `faqItems`, `faqs`, `questions` como alias de items
- cada item acepta:
  - `question` o `q`
  - `answer`, `a`, `content`, `body`, `copy`

#### `video_block`

Mejoras:

- `embed_url`, `video_url`, `youtube_url`, `vimeo_url` como aliases
- soporte de `video.embed_url` / `video.url`
- `highlights` y `takeaways` como alias de checklist
- media también puede resolverse por `media_dictionary`

### Prioridad media

#### `features_and_benefits`

Mejoras:

- `benefits`, `features`, `cards`, `bullets` como alias de items

#### `how_it_works`

Mejoras:

- `steps`, `sequence`, `cards` como alias
- parsing más flexible para `step/title/label/headline`

#### `risk_reversal`

Mejoras:

- `guarantees`, `guarantee_items`, `points`, `bullets` como alias
- sigue mapeando a `social_proof` con variante `risk_reversal`

#### `final_cta`

Mejoras:

- `primary_cta`, `cta` o `button` como contenedor del CTA
- `button_text` como alias de label
- `items`, `bullets`, `points`, `benefits` como highlights

## `media_dictionary`

La resolución de media ahora es más útil para payloads externos:

- soporta `media_key`, `image_key`, `video_key`, `asset_key`
- soporta `media_dictionary_key`
- soporta entries string o record
- soporta records con `src`, `url`, `embedUrl`, `embed_url`, `image_url`, `video_url`
- también resuelve media inline anidada desde `media`, `image`, `asset`, `video`, `poster`, `thumbnail`

## Archivos principales

- `apps/web/components/public-funnel/runtime-block-utils.ts`
- `apps/web/components/public-funnel/adapters/public-block-adapters.tsx`
- `apps/web/components/public-funnel/recycled/compatible-commercial-sections.tsx`
- `apps/api/prisma/seed.js`

## Qué sigue pendiente

- más bloques externos especializados
- validación formal del payload compatible
- soporte más rico de logos/grids de marca
- mayor fidelidad con estructuras complejas de theming

## Qué tan cerca deja esto a Leadflow

Leadflow queda bastante más cerca de reutilizar JSONs reales del otro sistema para funnels comerciales tipo landing/VSL/thank-you.

Todavía no es una compatibilidad total uno-a-uno, pero ya no depende de payloads “perfectos”: tolera naming alternativo, nested CTA y media más cercanos a un JSON real exportado desde otro stack.
