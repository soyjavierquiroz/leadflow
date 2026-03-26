# Public Funnel Frontend v2

Fecha: 2026-03-26 (UTC)

## Objetivo

Subir el nivel visual del funnel público de Leadflow sin cambiar el motor de runtime, el modelo de publicación ni el contrato base JSON-driven.

## Qué se mejoró

- Shell pública más sólida en `apps/web/components/public-funnel/funnel-runtime-page.tsx` con:
  - mejor jerarquía visual
  - progreso del step visible
  - resumen operativo más claro
  - mayor coherencia entre hero, contenido, captura y cierre
- Hero renovado:
  - CTA principal más claro
  - proof points visibles
  - métricas y contexto de publicación/handoff
  - mejor presencia visual en desktop y móvil
- Secciones de contenido más legibles:
  - mejor spacing
  - tarjetas con mejor contraste
  - ritmo visual más consistente entre bloques
- CTA blocks más comerciales:
  - acción principal más dominante
  - soporte narrativo del siguiente paso
  - continuidad hacia previous/next step sin romper tracking
- Form capture más creíble:
  - framing más simple
  - menor sensación de formulario técnico
  - mejor lectura móvil
  - foco en claridad de qué datos se piden y qué pasa después
- Thank-you más fuerte:
  - confirma mejor el estado del flujo
  - hace visible la continuidad comercial
  - se siente parte del producto y no un placeholder
- Sponsor reveal / handoff más claro:
  - sponsor presentado como owner real
  - estado, contacto y continuidad mejor explicados
  - CTA de WhatsApp más claro
  - mejor fallback cuando falta teléfono

## Cómo se conecta con el runtime actual

- El runtime sigue resolviendo `host + path` igual que antes.
- `blocks_json` sigue siendo la fuente de composición del step.
- No se cambió el modelo de publicación.
- No se cambió el flujo de assignment.
- No se tocó el handoff más allá de su presentación pública y una mejora menor de CTA para anchors.
- Tracking browser-side sigue emitiendo los mismos eventos operativos.

## Archivos principales

- `apps/web/components/public-funnel/funnel-runtime-page.tsx`
- `apps/web/components/public-funnel/public-capture-form.tsx`
- `apps/web/components/public-funnel/assigned-sponsor-reveal.tsx`
- `apps/web/components/public-funnel/tracked-cta.tsx`
- `apps/web/components/public-funnel/runtime-block-utils.ts`
- `apps/web/components/public-funnel/adapters/public-block-adapters.tsx`
- `apps/web/components/public-funnel/adapters/public-funnel-primitives.tsx`

## Limitaciones que siguen

- No existe editor visual de templates.
- El contenido sigue dependiendo del `blocks_json` actual y de los datos cargados por el runtime.
- No hay branding por template todavía.
- No hay sistema avanzado de variantes o experimentación por publicación.
- `wa.me` sigue siendo el fallback visible del handoff cuando aplica.

## Qué sigue después

- introducir variantes por template usando la registry de adapters ya creada
- incorporar componentes reciclados reales en `adapters/` cuando entren al repo
- ampliar bloques públicos con social proof, media, features y offer usando contratos visuales más ricos
- definir una capa de presets por template sin abrir todavía un editor visual
