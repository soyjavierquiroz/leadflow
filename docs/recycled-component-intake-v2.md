# Recycled Component Intake v2

Fecha: 2026-03-26 (UTC)

## Objetivo

Preparar Leadflow para absorber componentes visuales reciclados de forma ordenada y empezar a usar una capa real de intake dentro del funnel público.

## Situación de partida

Dentro del repo no existía todavía una carpeta externa/importada con componentes reciclables lista para conectar.

Por eso, en esta fase se hizo lo siguiente:

- se creó una capa explícita `apps/web/components/public-funnel/recycled/`
- se movieron a esa capa secciones visuales de alto impacto ya operativas en el funnel
- los adapters actuales pasaron a consumir esa capa en lugar de cargar todo el markup directamente

## Componentes integrados en la capa `recycled/`

Archivo principal:

- `apps/web/components/public-funnel/recycled/compatible-commercial-sections.tsx`

Secciones integradas:

- `RecycledHeroSection`
- `RecycledHookSection`
- `RecycledSocialProofSection`
- `RecycledVideoSection`
- `RecycledOfferStackSection`
- `RecycledFaqAccordionSection`

## Qué significa “recycled” en esta fase

No hubo un drop externo nuevo dentro del repo.

Los componentes incorporados en v2 son reciclados desde el markup comercial ya activo del funnel público y reorganizados como capa reusable. Esto deja una estructura lista para que, en la siguiente fase, entren componentes importados o adaptados con menos fricción.

## Cómo se conecta con los adapters

Los adapters actuales siguen siendo la frontera entre:

- contrato JSON
- normalización
- runtime interno
- componente visual final

La diferencia es que ahora varios adapters renderizan una pieza `recycled/*` en lugar de cargar JSX monolítico propio.

## Bloques que ya usan la capa reciclada

- `hero`
- `hook_and_promise`
- `social_proof`
- `video`
- `offer_pricing`
- `faq`

## Beneficios inmediatos

- intake más ordenado para componentes externos futuros
- menos JSX gigante dentro del adapter principal
- mejor separación entre compatibilidad y presentación
- base más clara para variantes futuras sin tocar el runtime base

## Qué sigue pendiente

- incorporar un paquete externo/importado real cuando exista dentro del repo
- separar las secciones recicladas en archivos por bloque si crecen más
- sumar variantes visuales más específicas por vertical/template
- absorber piezas externas para logos, testimonial walls, offer stacks más ricos y media layouts más complejos
