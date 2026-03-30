# Leadflow VSL Edition

Esta guía resume cómo operar funnels híbridos bajo el modelo `Data-Driven Assembly` usando `blocksJson` y `mediaMap`.

## 1. Cómo estructurar un botón que abra el formulario de captura

Hay dos patrones soportados por el runtime actual:

### A. CTA que salta al bloque `lead_capture_form`

Si tu `blocksJson` incluye un bloque `lead_capture_form`, los adapters comerciales apuntan automáticamente al ancla `#public-capture-form`.

Ejemplo:

```json
[
  {
    "type": "hook_and_promise",
    "headline": "Perfila tu barba en minutos",
    "primary_cta_text": "Quiero dejar mis datos"
  },
  {
    "type": "lead_capture_form",
    "headline": "Completa tu pedido",
    "buttonText": "Reservar ahora"
  }
]
```

Notas:

- `hook_and_promise` usa `primary_cta_text` como label visible.
- Si existe un `lead_capture_form` en la página, el CTA se enlaza automáticamente al formulario nativo.
- El submit del formulario sigue usando el flujo estándar de Leadflow para crear visitante, lead y continuidad del funnel.

### B. CTA de `grand_slam_offer` que abre el drawer de pedido

El bloque `grand_slam_offer` no necesita un builder adicional. Su CTA principal abre un drawer lateral y monta `PublicCaptureForm`.

Ejemplo mínimo:

```json
{
  "type": "grand_slam_offer",
  "headline": "Llévate hoy tu kit Dragon T9",
  "primary_cta_text": "Aprovechar oferta Dragon T9"
}
```

Notas:

- Si ya existe un bloque `lead_capture_form`, el drawer reutiliza esa configuración.
- Si no existe, el runtime genera un formulario compacto fallback.
- El wiring actual vive en `apps/web/components/public-funnel/public-grand-slam-offer-block.tsx`.

## 2. Cómo mapear una nueva imagen del CDN en `mediaMap`

`mediaMap` es un objeto JSON simple donde la llave lógica se resuelve contra una URL absoluta del CDN.

Ejemplo:

```json
{
  "hero": "https://cdn.leadflow.io/media/dragon-t9/hero.webp",
  "product_box": "https://cdn.leadflow.io/media/dragon-t9/product-box.webp",
  "gallery_1": "https://cdn.leadflow.io/media/dragon-t9/gallery-1.webp",
  "seo_cover": "https://cdn.leadflow.io/media/dragon-t9/seo-cover.webp"
}
```

Llaves sugeridas:

- `hero`
- `product_box`
- `gallery_1`
- `seo_cover`

Notas:

- Usa URLs absolutas, por ejemplo `https://cdn.leadflow.io/media/...`.
- `leadflow-media-resolver.ts` prioriza primero el bloque y luego cae a `mediaMap`.
- Para VexerCore Pro, las llaves más útiles son `hero`, `product_box`, `gallery_1`, `heroImage` y `seo_cover`.

## 3. Cómo usar el timer de cuenta regresiva

El runtime actual soporta el bloque `urgency_timer`.

Ejemplo con fecha fija:

```json
{
  "type": "urgency_timer",
  "prefix_text": "Últimas unidades",
  "main_text": "La promoción expira hoy.",
  "expires_at": "2026-03-31T23:59:59Z"
}
```

Ejemplo con duración relativa:

```json
{
  "type": "urgency_timer",
  "prefix_text": "Descuento activo",
  "main_text": "Tienes una ventana corta para reservar.",
  "duration_minutes": 90
}
```

Notas:

- `prefix_text` se usa como headline.
- `main_text` se usa como subheadline.
- Puedes usar `expires_at` para una fecha ISO o `duration_minutes` para una duración relativa.
- El componente visual vive en `apps/web/components/public-funnel/urgency-timer-block.tsx`.

## 4. Recomendación práctica para Dragon T9

Un set mínimo seguro para empezar:

```json
[
  {
    "type": "hook_and_promise",
    "primary_cta_text": "Quiero mi Dragon T9 ahora"
  },
  {
    "type": "unique_mechanism",
    "media_url": "product_box"
  },
  {
    "type": "grand_slam_offer",
    "primary_cta_text": "Aprovechar oferta Dragon T9"
  },
  {
    "type": "lead_capture_form",
    "headline": "Completa tu pedido"
  }
]
```

Con eso:

- el hook puede saltar al formulario nativo;
- el mechanism resuelve imagen desde `product_box`;
- la oferta abre el drawer con `PublicCaptureForm`;
- y el runtime conserva compatibilidad con `leadflow-media-resolver.ts`.
