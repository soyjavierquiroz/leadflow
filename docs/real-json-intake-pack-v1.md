# Real JSON Intake Pack v1

Fecha: 2026-03-26 (UTC)

## Objetivo

Validar la compatibilidad práctica del runtime público de Leadflow usando payloads concretos, reales o casi reales, inspirados directamente en el ecosistema JSON externo tipo Jakawi/Vexer.

## Ubicación del pack

- `apps/web/lib/public-funnel/intake-examples/`

Payloads incluidos:

- `sales-audit-landing.json`
- `advisor-opportunity-vsl.json`
- `clinic-whatsapp-intake.json`

## Qué payloads se tomaron como referencia

No se importó código del otro sistema. En cambio, se construyeron fixtures internos con estas características reales o casi reales:

- naming heterogéneo por bloque
- nested CTA (`primary_cta`, `secondary_cta`, `button`, `cta`)
- media resuelta por `media_dictionary` o anidada
- arrays con `stats`, `reviews`, `faq_items`, `offer_items`, `logo_strip`
- bloques de oportunidad, landing y vertical servicio/clinic

## Payload usado por la demo activa

La landing pública demo ahora usa directamente:

- `apps/web/lib/public-funnel/intake-examples/sales-audit-landing.json`

El seed lo monta desde:

- `apps/api/prisma/seed.js`

## Compatibilidad por payload

### `sales-audit-landing.json`

Bloques que entran directos o casi directos:

- `hero_block`
- `hook_and_promise`
- `social_proof`
- `urgency_timer`
- `video_block`
- `faq_accordion`
- `lead_capture_form`

Bloques que entran por adapter:

- `offer_stack` -> `offer_pricing`
- `risk_reversal` -> `social_proof`
- `final_cta` -> `cta`

Normalización adicional usada:

- `stats`
- `reviews`
- `logo_strip`
- `video.embed_url`
- `price_box`
- `offer_items`
- `faq_items`
- `field_type`, `is_required`, `choices`

### `advisor-opportunity-vsl.json`

Bloques que entran directos o casi directos:

- `hero_block`
- `video_block`
- `social_proof`
- `lead_capture_form`

Bloques que entran por adapter:

- `offer_stack` -> `offer_pricing`
- `final_cta` -> `cta`

Normalización adicional usada:

- `numbers`
- `quotes`
- `included`
- `button`
- `field_name`

### `clinic-whatsapp-intake.json`

Bloques que entran directos o casi directos:

- `hero_block`
- `social_proof`
- `urgency_timer`
- `lead_capture_form`
- `faq_accordion`

Bloques que entran por adapter:

- `risk_reversal` -> `social_proof`

Normalización adicional usada:

- `results`
- `customers`
- `duration`
- `faqs`
- `default` para hidden fields

## Qué tan compatible quedó Leadflow con JSONs reales

Leadflow ya quedó razonablemente sólido para:

- landings comerciales
- páginas de oportunidad con VSL
- funnels de captación + WhatsApp handoff
- payloads con naming inconsistente pero reconocible

La compatibilidad práctica ya no depende de payloads “bonitos” o estrictamente alineados con el contrato interno.

## Qué mejoró visualmente en esta fase

- social proof con logo strip y testimonial wall más rica
- offer stack más completo y legible
- final CTA más fuerte cuando entra como `final_cta`
- video block con presentación más comercial y mejor contexto visual

## Qué bloques ya están listos para reutilización seria

- `hero_block`
- `hook_and_promise`
- `social_proof`
- `urgency_timer`
- `video_block`
- `lead_capture_form`
- `offer_stack`
- `faq_accordion`
- `final_cta`
- `risk_reversal`

## Gaps que siguen existiendo

- validación formal/schema del payload intake
- layouts condicionales arbitrarios
- theming complejo por JSON
- estructuras más avanzadas de tabs, carousels o multi-column layout builders
- packs de logos/testimonials más ricos con metadatos de marca

## Qué sigue después

- formalizar validación del intake pack
- sumar snapshots o tests de compatibilidad sobre estos payloads
- absorber un drop externo/importado real cuando exista dentro del repo
- ampliar variantes por vertical a partir de estos casos reales
