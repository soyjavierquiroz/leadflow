# Component Assimilation v1

Fecha: 2026-03-26 (UTC)

## Objetivo

Preparar Leadflow para reutilizar componentes visuales existentes o importados dentro del funnel público sin romper el renderer base ni rehacer el runtime.

## Decisión estructural

Se creó una zona explícita para asimilación en:

- `apps/web/components/public-funnel/adapters/`

La idea no es reemplazar el runtime, sino insertar una capa intermedia entre `blocks_json` y el markup visual final.

## Base implementada

### Registry de adapters

`apps/web/components/public-funnel/adapters/public-block-adapters.tsx`

Esta registry:

- recibe `RuntimeBlock`
- mantiene el switch principal del renderer público
- desacopla la presentación de la shell del contrato bruto del bloque
- permite agregar nuevos adapters sin tocar la página pública completa

### Primitives visuales

`apps/web/components/public-funnel/adapters/public-funnel-primitives.tsx`

Incluye superficies, pills, stat cards, quote cards, checklist items y estilos de CTA para mantener consistencia entre bloques.

### Helpers de contrato

`apps/web/components/public-funnel/runtime-block-utils.ts`

Centraliza parsing y normalización para:

- strings
- arrays
- faq items
- feature items
- metrics
- testimonials
- media
- offers
- resolución de CTA

## Qué adapters quedaron listos

- `hero`
- `text`
- `video`
- `cta`
- `faq`
- `thank_you`
- `sponsor_reveal_placeholder`

Y además quedaron listos adapters base para bloques reciclables futuros:

- `social_proof`
- `testimonial` / `testimonials`
- `feature_grid` / `features`
- `media` / `image`
- `offer` / `pricing`

## Estrategia de asimilación

### Qué reciclar primero

Conviene reciclar primero componentes con mayor impacto visible y menor riesgo contractual:

- hero sections
- CTA sections
- feature grids
- social proof / testimonials
- media blocks
- pricing / offer blocks

### Cómo adaptarlos al contrato actual

- mantener `blocks_json` como entrada
- aceptar aliases de tipo cuando sea útil (`testimonial` y `testimonials`, por ejemplo)
- normalizar props en helpers antes de llegar al markup
- permitir que un mismo contrato base soporte más de una variante visual

### Cómo desacoplar schema y markup

- `runtime-block-utils.ts` resuelve el parsing
- `public-block-adapters.tsx` decide qué adapter usar
- `public-funnel-primitives.tsx` concentra el lenguaje visual

Así el schema no queda atado a un árbol JSX monolítico.

### Cómo soportar variantes futuras

La estrategia base ya soporta:

- aliases de tipo de bloque
- `variant` o `layout` como señal visual dentro del mismo bloque
- incorporación futura de componentes importados dentro de `adapters/` sin tocar la ruta pública ni el fetch del runtime

## Reuso real en esta fase

Se reutilizaron componentes internos ya existentes cuando aportaban valor directo:

- `apps/web/components/app-shell/section-header.tsx`
- `apps/web/components/app-shell/kpi-card.tsx`
- `apps/web/components/app-shell/status-badge.tsx`

Esto evita reinventar piezas neutras de UI y mantiene coherencia con el resto del producto.

## Limitaciones actuales

- El repo todavía no trae una carpeta de componentes de marketing importados lista para enchufar.
- No hay catálogo formal de variantes por template.
- No existe un sistema de override visual por publication.
- Los nuevos adapters base están preparados, pero no todos están poblados aún por contenido real del seed actual.

## Qué sigue después

- ingresar componentes reciclados reales dentro de `adapters/`
- definir presets por template o funnel type
- formalizar contratos mínimos por adapter para que el team pueda importar piezas sin romper el renderer
- decidir qué bloques merecen pasar de “adapter base” a “componente oficial de template”
