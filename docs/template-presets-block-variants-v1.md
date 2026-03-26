# Template Presets / Block Variants v1

Fecha: 2026-03-26 (UTC)

## Objetivo

Permitir que Leadflow reutilice mejor el runtime JSON-driven actual mediante presets y variantes por template/funnel, sin crear todavía un editor visual ni duplicar la lógica base de bloques.

## Archivo principal

- `apps/web/components/public-funnel/template-presets.ts`

## Enfoque

La estrategia de esta fase separa cuatro piezas:

- contrato bruto del JSON
- normalización del payload
- presets declarativos por template
- adapters visuales por bloque

Así, el preset no reemplaza al runtime. Solo ayuda a:

- sugerir composición
- inyectar defaults razonables
- resolver variantes visuales por bloque

## Presets implementados

### `landing_capture_v1`

Pensado para landing de captación comercial.

Composición sugerida:

- `hero`
- `hook_and_promise`
- `social_proof`
- `feature_grid`
- `lead_capture_form`
- `offer_pricing`
- `faq`

Variantes por defecto:

- `hero` -> `leadflow_signal`
- `hook_and_promise` -> `signal`
- `social_proof` -> `metrics_trust`
- `lead_capture_form` -> `conversion_card`
- `offer_pricing` -> `offer_stack`
- `faq` -> `accordion`

Defaults destacados:

- `hero.primaryCtaLabel = "Quiero dejar mis datos"`
- `lead_capture_form.success_mode = "next_step"`

### `opportunity_vsl_v1`

Pensado para una oportunidad con video/VSL y captura más compacta.

Composición sugerida:

- `hero`
- `video`
- `social_proof`
- `lead_capture_form`
- `offer_pricing`
- `faq`

Variantes por defecto:

- `hero` -> `opportunity`
- `video` -> `vsl_focus`
- `social_proof` -> `testimonials_focus`
- `lead_capture_form` -> `compact_capture`
- `offer_pricing` -> `offer_stack`

### `thank_you_reveal_v1`

Pensado para steps de confirmación y continuidad comercial.

Composición sugerida:

- `thank_you_reveal`
- `whatsapp_handoff_cta`
- `cta`

Variantes por defecto:

- `thank_you_reveal` -> `confirmation_reveal`
- `whatsapp_handoff_cta` -> `handoff_primary`

## Variantes implementadas en v1

Bloques con variantes iniciales activas:

- `hero`
  - `leadflow_signal`
  - `opportunity`
- `lead_capture_form`
  - `conversion_card`
  - `compact_capture`
- `social_proof`
  - `metrics_trust`
  - `testimonials_focus`
  - `risk_reversal`
- `offer_pricing`
  - `offer_stack`
- `faq`
  - `accordion`
- `thank_you_reveal`
  - `confirmation_reveal`
- `whatsapp_handoff_cta`
  - `handoff_primary`

## Resolución de presets y variants

Orden actual de resolución:

1. variante explícita en el bloque
2. variante declarada en `ui_config.block_variants`
3. variante por defecto del preset

Los defaults del preset se aplican antes del bloque para que el propio JSON del bloque pueda sobrescribirlos si hace falta.

## Relación con la capa compatible

La capa compatible puede recibir:

- `template`
- `ui_config.preset`
- `ui_config.block_variants`

Después:

1. el payload se normaliza a `RuntimeBlock`
2. se resuelve el preset
3. se aplican defaults y variants
4. la registry actual renderiza el bloque

Esto permite que un JSON más cercano al otro sistema siga entrando por el motor actual de Leadflow.

## Seed/demo actual

La demo de `/` ya usa:

- `template: "landing_capture_v1"`
- `ui_config.preset`
- `ui_config.block_variants`
- `hero_block`
- `layout_blocks`

Con eso el seed ya prueba:

- compatibilidad de contrato
- resolución de `media_dictionary`
- presets
- variantes visuales reales

## Qué queda pendiente

- más presets por vertical o template comercial
- más variantes por bloque reciclado
- validación formal de presets y variants
- soporte más rico de `ui_config`
- catálogo de presets/template packs reutilizables
