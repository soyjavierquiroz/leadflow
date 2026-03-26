# JSON Block Runtime Expansion v1

Fecha: 2026-03-26 (UTC)

## Objetivo

Expandir el runtime público para soportar un conjunto inicial de bloques comerciales reales sobre la base JSON-driven ya existente.

## Bloques soportados en esta fase

Bloques nuevos o consolidados como v1 comercial:

- `hook_and_promise`
- `urgency_timer`
- `social_proof`
- `feature_grid`
- `offer_pricing`
- `faq`
- `thank_you_reveal`
- `whatsapp_handoff_cta`
- `lead_capture_form`

Compatibilidad / normalización interna:

- `form_placeholder` -> `lead_capture_form`
- `features` -> `feature_grid`
- `offer` -> `offer_pricing`
- `pricing` -> `offer_pricing`
- `testimonial` / `testimonials` -> `testimonials`

## Arquitectura aplicada

La expansión mantiene separadas cuatro capas:

- parsing y helpers de contrato en `apps/web/components/public-funnel/runtime-block-utils.ts`
- registry de bloques en `apps/web/components/public-funnel/adapters/public-block-adapters.tsx`
- primitives visuales en `apps/web/components/public-funnel/adapters/public-funnel-primitives.tsx`
- lógica específica de bloques en componentes/adapters dedicados

Componentes cliente nuevos cuando el bloque lo requiere:

- `apps/web/components/public-funnel/urgency-timer-block.tsx`
- `apps/web/components/public-funnel/whatsapp-handoff-cta.tsx`

## Cómo conecta el JSON con el runtime

1. La API sigue devolviendo `blocks_json` por step.
2. La web lee el bloque crudo como `RuntimeBlock`.
3. Se normaliza el tipo de bloque cuando hace falta.
4. Cada adapter convierte el contrato bruto en props visuales/comportamiento.
5. Solo los bloques que necesitan estado o side effects usan componente cliente.

Esto permite seguir siendo JSON-driven sin meter JSX monolítico ni lógica libre por publicación.

## Estado real por bloque

### `hook_and_promise`

- funcional
- pensado para aperturas comerciales claras
- puede empujar CTA declarativo

### `urgency_timer`

- funcional en cliente
- soporta `expires_at` o `duration_minutes`
- pensado para reforzar urgencia sin scripts custom

### `social_proof`

- funcional
- soporta métricas y testimonios

### `feature_grid`

- funcional
- soporta grilla de beneficios/razones

### `offer_pricing`

- funcional
- soporta precio, nota, beneficios y CTA

### `faq`

- consolidado

### `thank_you_reveal`

- funcional
- combina confirmación + reveal usando el contexto real de sesión

### `whatsapp_handoff_cta`

- funcional
- renderiza CTA standalone a WhatsApp usando el handoff ya resuelto

### `lead_capture_form`

- funcional
- bloque de primera clase conectado al submit compuesto estándar

## Seed/demo actualizado

El funnel demo ahora usa de verdad:

- hero comercial
- `hook_and_promise`
- `social_proof`
- `feature_grid`
- `urgency_timer`
- `lead_capture_form`
- `offer_pricing`
- `faq`
- `thank_you_reveal`
- `whatsapp_handoff_cta`

Esto impacta tanto `/` como `/oportunidad`, porque ambas publicaciones comparten la misma composición base del funnel instance.

## Qué queda pendiente

- variantes por template preset
- catálogos visuales por vertical
- timers con persistencia de deadline más rica
- bloques de media/oferta más profundos
- un modelo más explícito para explotar `fieldValues` dentro del dominio sin volver el sistema frágil
