# Public Funnel Frontend v1

## Qué se mejoró visualmente

- Hero más sólido y creíble, con mejor jerarquía, señal visual de producto y contexto del funnel.
- Secciones de texto más limpias, con tarjetas y separación más clara de ideas.
- CTA con mayor jerarquía visual y copy más directo.
- Formulario de captura más entendible, con explicación breve de qué pasa después.
- Thank-you más presentable, con continuidad narrativa del flujo.
- Reveal del sponsor más claro, mostrando al sponsor asignado como parte del producto y no como bloque técnico.
- Mejor spacing general, mejor lectura en mobile y más consistencia entre bloques.

## Qué componentes públicos se pulieron

- `funnel-runtime-page`
  - shell público más claro
  - navegación de pasos más legible
  - bloques `hero`, `text`, `video`, `cta`, `faq` y `thank_you` con mejor presentación
- `public-capture-form`
  - mejor framing del paso de conversión
  - mejor disposición de campos y explicación del flujo
  - CTA más claro
- `assigned-sponsor-reveal`
  - reveal más convincente
  - continuidad más clara hacia WhatsApp
  - mejor presentación del sponsor y del CTA de handoff

## Limitaciones que siguen existiendo

- El runtime sigue siendo JSON-driven y no hay editor visual todavía.
- El modelo de templates no cambió; este sprint mejora presentación, no autoría visual.
- El handoff sigue usando la estrategia actual y mantiene `wa.me` como fallback cuando aplica.
- El contenido sigue dependiendo de los bloques existentes; no se agregó un sistema nuevo de composición ni variaciones avanzadas por template.
- Hay espacio para profundizar responsive behavior y branding por template cuando llegue una fase de frontend más amplia.
