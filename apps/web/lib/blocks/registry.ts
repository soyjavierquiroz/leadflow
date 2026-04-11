import type { FC } from "react";

import {
  PublicAnnouncementBlockBridge,
  PublicGrandSlamOfferBlockBridge,
  PublicHookAndPromiseBlockBridge,
  PublicLeadCaptureConfigBridge,
  PublicStepByStepBlockBridge,
  PublicStickyRuntimeBlockBridge,
  PublicUniqueMechanismBlockBridge,
} from "@/components/blocks/PublicRuntimeBlockBridges";
import { ParadigmShift } from "@/components/blocks/paradigm-shift";
import type { JsonValue } from "@/lib/public-funnel-runtime.types";

export type BuilderBlockDefinition = {
  key: string;
  name: string;
  description: string;
  category: string;
  schema: Record<string, JsonValue>;
  example: Record<string, JsonValue>;
};

const defineBlock = (
  definition: BuilderBlockDefinition,
): BuilderBlockDefinition => definition;

export const stickyConversionBarDefinition = defineBlock({
  key: "sticky_conversion_bar",
  name: "Barra Sticky de Conversión",
  description:
    "Muestra una barra fija arriba en desktop y un CTA fijo abajo en mobile después de un scroll configurable.",
  category: "conversion",
  schema: {
    type: "sticky_conversion_bar",
    key: "string",
    desktopText: "string",
    desktopButtonText: "string",
    mobileButtonText: "string",
    triggerOffsetPixels: 320,
    bgColor: "#0f172a",
    textColor: "#f8fafc",
    buttonBgColor: "#22c55e",
    buttonTextColor: "#052e16",
    borderColor: "#1e293b",
    href: "#public-capture-form",
    action: "scroll_to_capture | open_lead_capture_modal",
  },
  example: {
    type: "sticky_conversion_bar",
    key: "sticky-conversion-main",
    desktopText:
      "Activa tu evaluación personalizada antes de salir de esta página.",
    desktopButtonText: "Quiero mi evaluación",
    mobileButtonText: "Quiero mi evaluación",
    triggerOffsetPixels: 320,
    bgColor: "#0f172a",
    textColor: "#f8fafc",
    buttonBgColor: "#22c55e",
    buttonTextColor: "#052e16",
    borderColor: "#1e293b",
    action: "scroll_to_capture",
  },
});

export const builderBlockDefinitionsByKey: Record<
  string,
  BuilderBlockDefinition
> = {
  sticky_conversion_bar: stickyConversionBarDefinition,
  announcement: defineBlock({
    key: "announcement",
    name: "Announcement Banner",
    description:
      "Franja superior para urgencia, promo o mensaje corto repetido en marquee.",
    category: "attention",
    schema: {
      type: "announcement",
      key: "string",
      text: "string",
    },
    example: {
      type: "announcement",
      key: "announcement-top",
      text: "ENVIO GRATIS HOY | STOCK LIMITADO | ATENCION PRIORITARIA",
    },
  }),
  hero: defineBlock({
    key: "hero",
    name: "Hero / Apertura",
    description:
      "Bloque de apertura con promesa, métricas, prueba y CTA principal del funnel.",
    category: "attention",
    schema: {
      type: "hero",
      key: "string",
      variant: "leadflow_signal | opportunity",
      eyebrow: "string",
      title: "string",
      description: "string",
      accent: "string",
      primaryCtaLabel: "string",
      primaryCtaHref: "#public-capture-form",
      secondaryCtaLabel: "string",
      secondaryCtaHref: "/",
      metrics: [
        {
          label: "string",
          value: "string",
          description: "string",
        },
      ],
      proofItems: ["string"],
      media: {
        src: "https://cdn.example.com/hero.webp",
        alt: "string",
      },
    },
    example: {
      type: "hero",
      key: "hero-main",
      variant: "leadflow_signal",
      eyebrow: "protocolo premium",
      title: "Descubre si este protocolo encaja con tu caso en minutos",
      description:
        "Abrimos el funnel con una promesa clara, prueba visible y un siguiente paso simple.",
      accent: "Evaluación personalizada sin fricción",
      primaryCtaLabel: "Quiero mi evaluación",
      primaryCtaHref: "#public-capture-form",
      secondaryCtaLabel: "Ver cómo funciona",
      secondaryCtaHref: "#detalle",
      metrics: [
        {
          label: "Respuesta",
          value: "< 15 min",
          description: "Tiempo de lectura para entender la propuesta.",
        },
        {
          label: "Canal",
          value: "WhatsApp",
          description: "Continuidad comercial visible desde el primer bloque.",
        },
      ],
      proofItems: [
        "Promesa fácil de entender",
        "Jerarquía visual lista para mobile",
        "CTA conectado al flujo de captura",
      ],
    },
  }),
  hook_and_promise: defineBlock({
    key: "hook_and_promise",
    name: "Hook and Promise",
    description:
      "Bloque narrativo principal para abrir la tensión, explicar la promesa y empujar al CTA.",
    category: "narrative",
    schema: {
      type: "hook_and_promise",
      key: "string",
      eyebrow_text: "string",
      headline: "string",
      subheadline: "string",
      hook_text: "string",
      primary_benefit_bullets: ["string"],
      trust_badges: ["string"],
      primary_cta_text: "string",
      cta_lead_in: "string",
      helper_text: "string",
      action: "hook_primary | open_lead_capture_modal",
      href: "#public-capture-form",
      media_key: "hero",
    },
    example: {
      type: "hook_and_promise",
      key: "hook-main",
      eyebrow_text: "edicion limitada",
      headline: "Perfila tu barba en casa con acabado profesional",
      subheadline:
        "Una propuesta clara, creíble y fácil de accionar desde el primer scroll.",
      hook_text:
        "Si ya probaste máquinas comunes y no logras líneas limpias, aquí cambia el resultado.",
      primary_benefit_bullets: [
        "Define contornos con precisión",
        "Reduce volumen en minutos",
        "Mantiene continuidad hacia la captura",
      ],
      trust_badges: ["envio rapido", "pago seguro", "garantia"],
      primary_cta_text: "Quiero mi Dragon T9",
      cta_lead_in: "En pocos minutos sabrás si es para ti.",
      helper_text: "Te llevamos al siguiente paso sin romper el tracking.",
      action: "scroll_to_capture",
      href: "#public-capture-form",
      media_key: "hero",
    },
  }),
  lead_capture_config: defineBlock({
    key: "lead_capture_config",
    name: "Lead Capture Config",
    description:
      "Configura el modal de captura que pueden reutilizar otros bloques como hook o sticky bar.",
    category: "conversion",
    schema: {
      type: "lead_capture_config",
      key: "string",
      modal_config: {
        title: "string",
        description: "string",
        default_country: "BO",
        fields: {
          name: {
            label: "string",
            placeholder: "string",
            error_msg: "string",
          },
          phone: {
            label: "string",
            placeholder: "string",
            error_msg: "string",
          },
        },
        cta_button: {
          text: "string",
          subtext: "string",
        },
      },
      success_redirect: "/gracias",
    },
    example: {
      type: "lead_capture_config",
      key: "capture-config-main",
      modal_config: {
        title: "Estas a un paso",
        description: "Completa tus datos para pasar a la siguiente etapa.",
        default_country: "BO",
        fields: {
          name: {
            label: "Nombre",
            placeholder: "Tu nombre completo",
            error_msg: "Ingresa tu nombre para continuar.",
          },
          phone: {
            label: "WhatsApp",
            placeholder: "Tu numero de WhatsApp",
            error_msg: "Ingresa un numero valido.",
          },
        },
        cta_button: {
          text: "Quiero continuar",
          subtext: "Respuesta prioritaria por WhatsApp.",
        },
      },
    },
  }),
  lead_capture_form: defineBlock({
    key: "lead_capture_form",
    name: "Lead Capture Form",
    description:
      "Formulario principal de captura con campos declarativos, variantes y settings de continuidad.",
    category: "conversion",
    schema: {
      type: "lead_capture_form",
      key: "string",
      variant: "conversion_card | compact_capture",
      eyebrow: "string",
      headline: "string",
      subheadline: "string",
      button_text: "string",
      helper_text: "string",
      privacy_note: "string",
      success_mode: "next_step | inline_message",
      fields: [
        {
          name: "full_name",
          label: "Nombre completo",
          field_type: "text | tel | email | textarea | select | hidden",
          is_required: true,
          placeholder: "string",
          autocomplete: "name",
          width: "full | half | third",
        },
      ],
      settings: {
        source_channel: "form",
        capture_url_context: true,
        tags: ["string"],
        success_message: "string",
      },
    },
    example: {
      type: "lead_capture_form",
      key: "capture-form-main",
      variant: "conversion_card",
      eyebrow: "Paso de conversion",
      headline: "Deja tus datos y continuamos contigo",
      subheadline:
        "La captura mantiene contexto, assignment y siguiente paso dentro del runtime.",
      button_text: "Quiero continuar",
      helper_text: "Te contactaremos por el canal configurado.",
      privacy_note: "Usamos tus datos solo para continuar esta conversacion.",
      success_mode: "next_step",
      fields: [
        {
          name: "full_name",
          label: "Nombre completo",
          field_type: "text",
          is_required: true,
          placeholder: "Tu nombre completo",
          autocomplete: "name",
          width: "full",
        },
        {
          name: "phone",
          label: "WhatsApp",
          field_type: "tel",
          is_required: true,
          placeholder: "+591 70000000",
          autocomplete: "tel",
          width: "half",
        },
        {
          name: "email",
          label: "Email",
          field_type: "email",
          placeholder: "tu@email.com",
          autocomplete: "email",
          width: "half",
        },
      ],
      settings: {
        source_channel: "landing_form",
        capture_url_context: true,
        tags: ["landing", "lead_capture"],
      },
    },
  }),
  unique_mechanism: defineBlock({
    key: "unique_mechanism",
    name: "Unique Mechanism",
    description:
      "Explica el mecanismo diferencial con pasos, pares feature-benefit y soporte visual o video.",
    category: "education",
    schema: {
      type: "unique_mechanism",
      key: "string",
      headline: "string",
      mechanism_name: "string",
      how_it_works_steps: [
        {
          step_title: "string",
          step_text: "string",
        },
      ],
      feature_benefit_pairs: [
        {
          feature: "string",
          benefit: "string",
        },
      ],
      media_url: "product_box",
      demo_video_url: "https://www.youtube.com/watch?v=...",
    },
    example: {
      type: "unique_mechanism",
      key: "mechanism-main",
      headline: "La diferencia esta en su precision de detalle",
      mechanism_name: "sistema de corte t-blade de precision",
      how_it_works_steps: [
        {
          step_title: "Define",
          step_text: "Marca mejillas, cuello y patillas con visibilidad total.",
        },
        {
          step_title: "Empareja",
          step_text: "Reduce volumen sin dejar huecos ni zonas desiguales.",
        },
      ],
      feature_benefit_pairs: [
        {
          feature: "Cuchilla T-blade",
          benefit: "Permite lineas mas limpias y simetricas.",
        },
      ],
      media_url: "product_box",
    },
  }),
  urgency_timer: defineBlock({
    key: "urgency_timer",
    name: "Urgency Timer",
    description:
      "Cuenta regresiva declarativa para reforzar urgencia sin lógica custom por funnel.",
    category: "conversion",
    schema: {
      type: "urgency_timer",
      key: "string",
      eyebrow: "string",
      headline: "string",
      subheadline: "string",
      expires_at: "2026-12-31T23:59:59.000Z",
      duration_minutes: 30,
      expire_action: "hide | show_message | redirect",
      expire_message: "string",
      expire_redirect_url: "https://example.com/oferta-cerrada",
    },
    example: {
      type: "urgency_timer",
      key: "urgency-main",
      eyebrow: "ventana activa",
      headline: "Tu precio preferencial no estara disponible para siempre",
      subheadline: "Usa este bloque para reforzar el momentum del siguiente paso.",
      duration_minutes: 30,
      expire_action: "show_message",
      expire_message: "Esta ventana ya expiro. Revisa la siguiente opcion disponible.",
    },
  }),
  text: defineBlock({
    key: "text",
    name: "Text Section",
    description:
      "Bloque flexible para copy largo, bullets o variantes simples de valor.",
    category: "content",
    schema: {
      type: "text",
      key: "string",
      variant: "default | social_proof | feature_grid",
      title: "string",
      description: "string",
      items: [
        {
          eyebrow: "string",
          title: "string",
          description: "string",
        },
      ],
    },
    example: {
      type: "text",
      key: "text-main",
      title: "Por que esta experiencia convierte mejor",
      description:
        "Un bloque simple para explicar valor con una lectura mas ordenada.",
      items: [
        {
          eyebrow: "Claridad",
          title: "Mensaje directo",
          description: "La propuesta se entiende sin ruido tecnico.",
        },
        {
          eyebrow: "Continuidad",
          title: "CTA conectado",
          description: "El siguiente paso mantiene el contrato del runtime.",
        },
      ],
    },
  }),
  video: defineBlock({
    key: "video",
    name: "Video",
    description:
      "Video o VSL embebido con checklist de apoyo para sostener la narrativa.",
    category: "media",
    schema: {
      type: "video",
      key: "string",
      title: "string",
      caption: "string",
      embedUrl: "https://www.youtube.com/embed/...",
      items: ["string"],
    },
    example: {
      type: "video",
      key: "video-main",
      title: "Mira como funciona antes de dejar tus datos",
      caption: "Una pieza breve para mostrar el mecanismo y reducir objeciones.",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      items: [
        "Demuestra el valor rapidamente",
        "Introduce el siguiente paso con contexto",
        "Ayuda a mantener atencion en mobile",
      ],
    },
  }),
  cta: defineBlock({
    key: "cta",
    name: "CTA",
    description:
      "Llamado a la accion standalone para avanzar, cerrar o reiterar el siguiente movimiento.",
    category: "conversion",
    schema: {
      type: "cta",
      key: "string",
      variant: "primary | secondary | final_cta",
      title: "string",
      description: "string",
      label: "string",
      href: "#public-capture-form",
      action: "string",
      items: ["string"],
    },
    example: {
      type: "cta",
      key: "cta-main",
      variant: "primary",
      title: "Da el siguiente paso hoy",
      description: "Un CTA claro para mover al usuario sin ambiguedad.",
      label: "Quiero continuar",
      href: "#public-capture-form",
      action: "cta_primary",
      items: [
        "Mantiene tracking de click",
        "Respeta la navegacion actual",
        "Se puede reutilizar en cualquier step",
      ],
    },
  }),
  faq: defineBlock({
    key: "faq",
    name: "FAQ Accordion",
    description:
      "Preguntas frecuentes en formato accordion o bloque de objeciones.",
    category: "proof",
    schema: {
      type: "faq",
      key: "string",
      variant: "accordion | social_proof | objection_stack",
      headline: "string",
      eyebrow: "string",
      items: [
        {
          question: "string",
          answer: "string",
        },
      ],
    },
    example: {
      type: "faq",
      key: "faq-main",
      variant: "accordion",
      headline: "Preguntas frecuentes",
      items: [
        {
          question: "Cuanto tarda en llegar?",
          answer: "Depende de tu ciudad, pero normalmente sale el mismo dia.",
        },
        {
          question: "Puedo pagar contra entrega?",
          answer: "Si el canal de venta de tu pais lo permite, si.",
        },
      ],
    },
  }),
  faq_social_proof: defineBlock({
    key: "faq_social_proof",
    name: "FAQ + Social Proof",
    description:
      "Variante de FAQ orientada a objeciones y confianza dentro del mismo bloque.",
    category: "proof",
    schema: {
      type: "faq_social_proof",
      key: "string",
      variant: "social_proof | objection_stack",
      headline: "string",
      eyebrow: "string",
      items: [
        {
          question: "string",
          answer: "string",
        },
      ],
    },
    example: {
      type: "faq_social_proof",
      key: "faq-proof-main",
      variant: "objection_stack",
      headline: "Objeciones que resolvemos antes de que compres",
      eyebrow: "Confianza real",
      items: [
        {
          question: "Y si no me funciona?",
          answer: "Por eso existe la garantia y el soporte posterior.",
        },
        {
          question: "Necesito experiencia previa?",
          answer: "No. La experiencia fue pensada para uso simple en casa.",
        },
      ],
    },
  }),
  thank_you: defineBlock({
    key: "thank_you",
    name: "Thank You",
    description:
      "Bloque de confirmacion posterior a la captura para mantener continuidad y calmar al usuario.",
    category: "handoff",
    schema: {
      type: "thank_you",
      key: "string",
      eyebrow: "string",
      title: "string",
      description: "string",
    },
    example: {
      type: "thank_you",
      key: "thank-you-main",
      eyebrow: "confirmacion",
      title: "Gracias, ya recibimos tus datos",
      description:
        "El sistema registrara tu lead y te llevara al siguiente paso disponible.",
    },
  }),
  thank_you_reveal: defineBlock({
    key: "thank_you_reveal",
    name: "Thank You Reveal",
    description:
      "Confirmacion con reveal del sponsor o asesor asignado para sostener el handoff.",
    category: "handoff",
    schema: {
      type: "thank_you_reveal",
      key: "string",
      variant: "confirmation_reveal",
      headline: "string",
      subheadline: "string",
      reveal_headline: "string",
      reveal_subheadline: "string",
    },
    example: {
      type: "thank_you_reveal",
      key: "thank-you-reveal-main",
      variant: "confirmation_reveal",
      headline: "Gracias, ya estas dentro",
      subheadline: "Tu lead fue registrado y el siguiente paso ya esta listo.",
      reveal_headline: "Asesor asignado para esta sesion",
      reveal_subheadline:
        "Mostramos continuidad real usando el assignment resuelto por el runtime.",
    },
  }),
  conversion_page_config: defineBlock({
    key: "conversion_page_config",
    name: "Terminal de Activación (Handoff)",
    description:
      "Tarjeta centrada con avatar del asesor, contador dinámico y redirección a WhatsApp.",
    category: "handoff",
    schema: {
      type: "conversion_page_config",
      key: "string",
      content: {
        headline: "string",
        subheadline: "string",
        cta_text: "string",
        whatsapp_message: "string",
        redirect_delay: 5000,
        fallback_advisor: {
          name: "string",
          phone: "string",
          photo_url: "string",
          bio: "string",
        },
      },
    },
    example: {
      type: "conversion_page_config",
      key: "success-advisor-handoff",
      content: {
        headline: "¡Acceso Prioritario Confirmado!",
        subheadline:
          "Has sido vinculado con nuestro especialista senior. El sistema te redirigirá en segundos para iniciar tu evaluación.",
        cta_text: "RECLAMAR MI SESIÓN CON [NOMBRE]",
        whatsapp_message:
          "Hola [NOMBRE], acabo de solicitar mi evaluación de Immunotec desde el sitio web. Mi prioridad es alta. ¿Podemos empezar?",
        redirect_delay: 5000,
        fallback_advisor: {
          name: "Equipo Leadflow",
          phone: "",
          photo_url: "/assets/default-advisor.svg",
          bio: "Especialista en Protocolos de Recuperación",
        },
      },
    },
  }),
  sponsor_reveal_placeholder: defineBlock({
    key: "sponsor_reveal_placeholder",
    name: "Sponsor Reveal Placeholder",
    description:
      "Placeholder declarativo para mostrar continuidad cuando el sponsor se resuelve en runtime.",
    category: "handoff",
    schema: {
      type: "sponsor_reveal_placeholder",
      key: "string",
      title: "string",
      description: "string",
    },
    example: {
      type: "sponsor_reveal_placeholder",
      key: "sponsor-reveal-main",
      title: "Tu sponsor asignado aparecera aqui",
      description:
        "El runtime completa este espacio usando el assignment guardado en sesion.",
    },
  }),
  social_proof: defineBlock({
    key: "social_proof",
    name: "Social Proof",
    description:
      "Muestra metricas, testimonios, logos y checklist de confianza en un solo bloque.",
    category: "proof",
    schema: {
      type: "social_proof",
      key: "string",
      variant: "metrics_trust | testimonials_focus",
      headline: "string",
      subheadline: "string",
      metrics: [
        {
          label: "string",
          value: "string",
          description: "string",
        },
      ],
      testimonials: [
        {
          quote: "string",
          author: "string",
          role: "string",
          company: "string",
        },
      ],
      logos: [
        {
          src: "https://cdn.example.com/logo.webp",
          alt: "string",
        },
      ],
    },
    example: {
      type: "social_proof",
      key: "social-proof-main",
      variant: "metrics_trust",
      headline: "Prueba social que reduce la duda",
      subheadline: "Usa resultados, testimonios o señales de autoridad visibles.",
      metrics: [
        {
          label: "Clientes",
          value: "+2.500",
          description: "Casos atendidos con seguimiento activo.",
        },
        {
          label: "Satisfaccion",
          value: "4.9/5",
          description: "Promedio de valoracion posterior al handoff.",
        },
      ],
      testimonials: [
        {
          quote: "Fue facil entender la oferta y continuar por WhatsApp.",
          author: "Andrea M.",
          role: "Cliente",
        },
      ],
    },
  }),
  risk_reversal: defineBlock({
    key: "risk_reversal",
    name: "Risk Reversal",
    description:
      "Garantia, respaldo y reduccion de riesgo percibido cerca del cierre.",
    category: "conversion",
    schema: {
      type: "risk_reversal",
      key: "string",
      headline: "string",
      guarantee_body: "string",
      guarantee_duration_text: "string",
      guarantee_bullets: ["string"],
      section_cta_text: "string",
      section_cta_subtext: "string",
    },
    example: {
      type: "risk_reversal",
      key: "risk-main",
      headline: "Compra protegida y sin salto al vacio",
      guarantee_body:
        "Explica claramente que pasa si el usuario no obtiene el resultado esperado.",
      guarantee_duration_text: "Garantia activa",
      guarantee_bullets: [
        "Soporte para resolver dudas",
        "Condiciones claras y visibles",
        "Menos friccion al tomar la decision",
      ],
      section_cta_text: "Quiero continuar",
      section_cta_subtext: "Tomas accion hoy, sin riesgo extra.",
    },
  }),
  testimonials: defineBlock({
    key: "testimonials",
    name: "Testimonials",
    description:
      "Coleccion de testimonios narrativos o quotes cortos para credibilidad comercial.",
    category: "proof",
    schema: {
      type: "testimonials",
      key: "string",
      title: "string",
      description: "string",
      items: [
        {
          quote: "string",
          author: "string",
          role: "string",
          company: "string",
        },
      ],
    },
    example: {
      type: "testimonials",
      key: "testimonials-main",
      title: "Lo que dicen quienes ya tomaron accion",
      description: "Ideal para quotes breves antes del cierre.",
      items: [
        {
          quote: "La experiencia fue clara y el contacto llego rapido.",
          author: "Carlos R.",
          role: "Cliente",
        },
        {
          quote: "Entendi la oferta y decidi avanzar sin dudas.",
          author: "Maria L.",
          role: "Cliente",
        },
      ],
    },
  }),
  feature_grid: defineBlock({
    key: "feature_grid",
    name: "Feature Grid",
    description:
      "Grid de beneficios, diferenciales o modulos de valor con estructura simple.",
    category: "content",
    schema: {
      type: "feature_grid",
      key: "string",
      title: "string",
      description: "string",
      items: [
        {
          eyebrow: "string",
          title: "string",
          description: "string",
        },
      ],
    },
    example: {
      type: "feature_grid",
      key: "feature-grid-main",
      title: "Beneficios que el usuario entiende rapido",
      description: "Perfecto para explicar valor en una cuadricula simple.",
      items: [
        {
          eyebrow: "Precision",
          title: "Detalle profesional",
          description: "Lineas mas limpias en menos tiempo.",
        },
        {
          eyebrow: "Comodidad",
          title: "Uso en casa",
          description: "Sin depender de visitas constantes a barberia.",
        },
        {
          eyebrow: "Confianza",
          title: "CTA conectado",
          description: "La decision se toma sin perder continuidad.",
        },
      ],
    },
  }),
  media: defineBlock({
    key: "media",
    name: "Media Section",
    description:
      "Seccion visual para imagen o asset con copy de apoyo y lista de takeaways.",
    category: "media",
    schema: {
      type: "media",
      key: "string",
      title: "string",
      description: "string",
      src: "https://cdn.example.com/asset.webp",
      alt: "string",
      caption: "string",
      items: ["string"],
    },
    example: {
      type: "media",
      key: "media-main",
      title: "Ve el producto desde cerca",
      description: "Bloque visual para reforzar percepcion y contexto.",
      src: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80",
      alt: "Producto principal",
      caption: "Usa una imagen fuerte con copy corto y directo.",
      items: [
        "Mejora la percepcion del producto",
        "Da soporte visual al claim principal",
      ],
    },
  }),
  image: defineBlock({
    key: "image",
    name: "Image",
    description:
      "Bloque simple de imagen usando el mismo adapter de media para assets puntuales.",
    category: "media",
    schema: {
      type: "image",
      key: "string",
      title: "string",
      description: "string",
      src: "https://cdn.example.com/image.webp",
      alt: "string",
      caption: "string",
    },
    example: {
      type: "image",
      key: "image-main",
      title: "Visual principal del producto",
      description: "Ideal para insertar una imagen aislada con contexto breve.",
      src: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80",
      alt: "Imagen del producto",
      caption: "Un asset limpio que acompana la narrativa.",
    },
  }),
  offer_pricing: defineBlock({
    key: "offer_pricing",
    name: "Offer Pricing",
    description:
      "Oferta declarativa con stack de items, precio, nota y CTA de cierre.",
    category: "conversion",
    schema: {
      type: "offer_pricing",
      key: "string",
      variant: "offer_stack",
      title: "string",
      description: "string",
      price: "Bs.149",
      priceNote: "string",
      items: [
        {
          title: "string",
          description: "string",
        },
      ],
      label: "string",
      href: "#public-capture-form",
      action: "offer_cta",
    },
    example: {
      type: "offer_pricing",
      key: "offer-pricing-main",
      variant: "offer_stack",
      title: "Oferta activa por tiempo limitado",
      description: "Resume inclusiones, precio visible y siguiente accion.",
      price: "Bs.149",
      priceNote: "Pago seguro y envio nacional disponible.",
      items: [
        {
          title: "Rasuradora Dragon T9",
          description: "Equipo principal para perfilar y detallar.",
        },
        {
          title: "Accesorios basicos",
          description: "Componentes necesarios para uso inicial.",
        },
      ],
      label: "Quiero esta oferta",
      href: "#public-capture-form",
      action: "offer_cta",
    },
  }),
  grand_slam_offer: defineBlock({
    key: "grand_slam_offer",
    name: "Grand Slam Offer",
    description:
      "Oferta extendida con stack de valor, bonuses, price stack y CTA conectado al flujo de pedido.",
    category: "conversion",
    schema: {
      type: "grand_slam_offer",
      key: "string",
      headline: "string",
      offer_name: "string",
      description: "string",
      offer_intro: "string",
      what_is_included: [
        {
          item_name: "string",
          item_description: "string",
          item_value_text: "string",
        },
      ],
      bonus_items: [
        {
          item_name: "string",
          item_description: "string",
        },
      ],
      price_stack: {
        anchor_price_text: "string",
        final_price_text: "string",
        savings_text: "string",
      },
      primary_cta_text: "string",
      media_key: "product_box",
    },
    example: {
      type: "grand_slam_offer",
      key: "grand-slam-main",
      headline: "Llevate hoy tu kit completo Dragon T9",
      offer_name: "oferta dragon t9",
      description: "Presenta la decision como una compra facil de justificar.",
      offer_intro: "No vendemos solo el producto: vendemos una solucion clara.",
      what_is_included: [
        {
          item_name: "Rasuradora Dragon T9",
          item_description: "La herramienta principal para perfilar y detallar.",
          item_value_text: "Valor percibido Bs.150",
        },
        {
          item_name: "Guia rapida de uso",
          item_description: "Paso a paso para sacar mejor provecho desde el dia uno.",
          item_value_text: "Valor percibido Bs.30",
        },
      ],
      price_stack: {
        anchor_price_text: "Valor total percibido Bs.180",
        final_price_text: "Hoy Bs.149",
        savings_text: "Ahorras Bs.31",
      },
      primary_cta_text: "Quiero aprovechar esta oferta",
      media_key: "product_box",
    },
  }),
  whatsapp_handoff_cta: defineBlock({
    key: "whatsapp_handoff_cta",
    name: "WhatsApp Handoff CTA",
    description:
      "CTA final para continuar el handoff hacia WhatsApp usando el contexto real de la sesion.",
    category: "handoff",
    schema: {
      type: "whatsapp_handoff_cta",
      key: "string",
      headline: "string",
      subheadline: "string",
      button_text: "string",
      helper_text: "string",
      variant: "handoff_primary",
    },
    example: {
      type: "whatsapp_handoff_cta",
      key: "whatsapp-handoff-main",
      headline: "Continua ahora por WhatsApp",
      subheadline: "Tu asesor asignado recibira el contexto de esta sesion.",
      button_text: "Abrir WhatsApp",
      helper_text: "Si no abre de inmediato, este bloque mantiene el handoff visible.",
      variant: "handoff_primary",
    },
  }),
  step_by_step: defineBlock({
    key: "step_by_step",
    name: "Step by Step",
    description:
      "Secuencia declarativa de pasos para explicar proceso, onboarding o metodo.",
    category: "education",
    schema: {
      type: "step_by_step",
      key: "string",
      eyebrow: "string",
      headline: "string",
      description: "string",
      steps: [
        {
          step_title: "string",
          step_text: "string",
        },
      ],
    },
    example: {
      type: "step_by_step",
      key: "step-by-step-main",
      eyebrow: "asi funciona",
      headline: "Tres pasos para activar tu siguiente etapa",
      description: "Ideal para explicar el proceso sin cargar demasiado texto.",
      steps: [
        {
          step_title: "Descubre",
          step_text: "Entiende la propuesta y por que aplica a tu caso.",
        },
        {
          step_title: "Deja tus datos",
          step_text: "Capturamos tu informacion y mantenemos continuidad.",
        },
        {
          step_title: "Continua",
          step_text: "Te llevamos al handoff o a la siguiente pagina disponible.",
        },
      ],
    },
  }),
  paradigm_shift: defineBlock({
    key: "paradigm_shift",
    name: "Paradigm Shift",
    description:
      "Bloque narrativo continuo para girar de problema a nueva perspectiva sin usar tarjetas ni cajas.",
    category: "narrative",
    schema: {
      type: "paradigm_shift",
      variant: "string",
      problemHeadline: "string",
      problemText: "string",
      problemStatement: "string",
      transitionMarker: "string",
      solutionText: "string",
    },
    example: {
      type: "paradigm_shift",
      variant: "default",
      problemHeadline: "El problema no es que te falte disciplina.",
      problemText:
        "Sigues intentando resolver esto con una estrategia pensada para otra etapa de tu negocio.",
      transitionMarker: "El cambio real empieza aqui",
      solutionText:
        "Cuando corriges el paradigma, la ejecucion deja de sentirse pesada. Empiezas a tomar decisiones con una narrativa mas clara, una promesa mas fuerte y una conversion mucho mas natural.",
    },
  }),
};

export const defaultBuilderBlockDefinitions = [
  stickyConversionBarDefinition,
  builderBlockDefinitionsByKey.announcement,
  builderBlockDefinitionsByKey.hero,
  builderBlockDefinitionsByKey.hook_and_promise,
  builderBlockDefinitionsByKey.lead_capture_config,
  builderBlockDefinitionsByKey.lead_capture_form,
  builderBlockDefinitionsByKey.unique_mechanism,
  builderBlockDefinitionsByKey.urgency_timer,
  builderBlockDefinitionsByKey.text,
  builderBlockDefinitionsByKey.video,
  builderBlockDefinitionsByKey.cta,
  builderBlockDefinitionsByKey.faq,
  builderBlockDefinitionsByKey.faq_social_proof,
  builderBlockDefinitionsByKey.social_proof,
  builderBlockDefinitionsByKey.testimonials,
  builderBlockDefinitionsByKey.feature_grid,
  builderBlockDefinitionsByKey.media,
  builderBlockDefinitionsByKey.image,
  builderBlockDefinitionsByKey.offer_pricing,
  builderBlockDefinitionsByKey.grand_slam_offer,
  builderBlockDefinitionsByKey.risk_reversal,
  builderBlockDefinitionsByKey.step_by_step,
  builderBlockDefinitionsByKey.paradigm_shift,
  builderBlockDefinitionsByKey.thank_you,
  builderBlockDefinitionsByKey.thank_you_reveal,
  builderBlockDefinitionsByKey.conversion_page_config,
  builderBlockDefinitionsByKey.sponsor_reveal_placeholder,
  builderBlockDefinitionsByKey.whatsapp_handoff_cta,
];

export const getBuilderBlockDefinition = (key: string) =>
  builderBlockDefinitionsByKey[key] ?? null;

export const BlockRegistry: Record<string, FC<any>> = {
  announcement: PublicAnnouncementBlockBridge,
  hero: PublicStickyRuntimeBlockBridge,
  hook_and_promise: PublicHookAndPromiseBlockBridge,
  lead_capture_config: PublicLeadCaptureConfigBridge,
  lead_capture_form: PublicStickyRuntimeBlockBridge,
  unique_mechanism: PublicUniqueMechanismBlockBridge,
  urgency_timer: PublicStickyRuntimeBlockBridge,
  text: PublicStickyRuntimeBlockBridge,
  video: PublicStickyRuntimeBlockBridge,
  cta: PublicStickyRuntimeBlockBridge,
  faq: PublicStickyRuntimeBlockBridge,
  faq_social_proof: PublicStickyRuntimeBlockBridge,
  thank_you: PublicStickyRuntimeBlockBridge,
  thank_you_reveal: PublicStickyRuntimeBlockBridge,
  conversion_page_config: PublicStickyRuntimeBlockBridge,
  sponsor_reveal_placeholder: PublicStickyRuntimeBlockBridge,
  social_proof: PublicStickyRuntimeBlockBridge,
  risk_reversal: PublicStickyRuntimeBlockBridge,
  testimonials: PublicStickyRuntimeBlockBridge,
  feature_grid: PublicStickyRuntimeBlockBridge,
  media: PublicStickyRuntimeBlockBridge,
  image: PublicStickyRuntimeBlockBridge,
  offer_pricing: PublicStickyRuntimeBlockBridge,
  grand_slam_offer: PublicGrandSlamOfferBlockBridge,
  whatsapp_handoff_cta: PublicStickyRuntimeBlockBridge,
  step_by_step: PublicStepByStepBlockBridge,
  paradigm_shift: ParadigmShift,
  sticky_conversion_bar: PublicStickyRuntimeBlockBridge,
};
