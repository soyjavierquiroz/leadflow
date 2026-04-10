import { Suspense } from "react";

import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import {
  jakawiPremiumClassNames,
  jakawiPremiumThemeStyle,
} from "@/styles/templates/jakawi-premium";

const stickyGalleryImage =
  "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=800&q=80";
const stickyGalleryImageAlt1 =
  "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80";
const stickyGalleryImageAlt2 =
  "https://images.unsplash.com/photo-1584308666744-24d5e4a83688?auto=format&fit=crop&w=800&q=80";
const stickyGalleryImageAlt3 =
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80";
const stickyGalleryImageAlt4 =
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80";
const systemFatigueImage =
  "https://images.unsplash.com/photo-1532187875605-1ef6c237f142?auto=format&fit=crop&w=800&q=80";

const immunotecFunnelData = [
  {
    text: "⚠️ !ATENCIÓN! SI NADA TE HA FUNCIONADO, ESTO ES DIFERENTE",
    type: "announcement",
    block_id: "top_urgency_bar",
  },
  {
    type: "hook_and_promise",
    content: {
      top_bar: "FINALMENTE SE HA REVELADO",
      headline:
        "Si ya intentaste todo y tu cuerpo no responde… esto es para ti.",
      hook_text:
        "La mayoría de personas en recuperación comete este error…",
      cta_footer:
        "Evaluación gratuita. Si no eres candidato, te lo diremos claramente.",
      cta_lead_in: "👉 En 15 minutos sabrás si puedes recuperarte.",
      subheadline:
        "No es falta de esfuerzo. Es que estás atacando el problema equivocado. Y lo peor… no saber si aún puedes recuperarte… o si ya es demasiado tarde.",
      urgency_box: {
        text: "Tu cuerpo no necesita más soluciones… necesita reactivar el sistema que le permite recuperarse.",
        mechanism:
          "Porque no se trata de añadir más tratamientos… sino de restaurar el proceso interno que permite que cualquier tratamiento funcione.",
      },
      proof_header: "Usado cuando otros tratamientos ya no funcionan",
      cta_button_text: "DESCUBRE QUÉ BLOQUEA TU RECUPERACIÓN",
    },
    block_id: "hero_final_spacing_v10",
    proof_points: [
      "✔ Basado en estándares farmacéuticos (PDR / CPS)",
      "✔ Personas que ya habían probado múltiples tratamientos sin éxito",
      "✔ +45 años de investigación clínica en casos críticos",
    ],
  },
  {
    type: "lead_capture_config",
    block_id: "modal_recovery_v11",
    modal_config: {
      title: "Estás a un paso...",
      fields: {
        name: {
          label: "Nombre",
          placeholder: "¿Cuál es tu nombre?",
        },
        phone: {
          label: "WhatsApp",
          error_msg: "Por favor, ingresa un número válido",
          placeholder: "¿Tu número de WhatsApp?",
        },
      },
      cta_button: {
        text: "CONTACTAR A UN ASESOR",
        subtext: "Seguridad, confianza y una solución...",
      },
      description: "Llena este formulario para contactárnos.",
      default_country: "BO",
    },
  },
  {
    type: "unique_mechanism",
    block_id: "problem_inmuno",
    headline: "EL AGOTAMIENTO DEL SISTEMA",
    media_key: "science_diagram",
    highlights: [
      {
        text: "La causa raíz de las crisis crónicas es el agotamiento de tus suministros celulares.",
        title: "Colapso de defensas",
      },
    ],
    description:
      "Tu cuerpo es una máquina increíble de autocuración, pero tiene un límite físico. Cuando el estrés oxidativo supera tus reservas de Glutatión, el sistema simplemente se apaga.",
  },
  {
    type: "grand_slam_offer",
    block_id: "offer_inmuno_cards",
    cta_text: "AGENDAR CONSULTA GRATUITA",
    headline: "NO TIENES QUE DECIDIR ESTO SOLO.",
    media_key: "specialist_consult",
    description:
      "No queremos que 'compres un producto'. Queremos que entiendas el protocolo. Por eso hemos eliminado el riesgo de la decisión.",
    price_sale_text: "PRECIO $0",
    what_is_included: [
      {
        name: "ANÁLISIS DE TU SITUACIÓN ACTUAL Y RECURSOS.",
        description: "VALOR INCLUIDO / PRECIO $0",
      },
      {
        name: "ACCESO A LOS ESTUDIOS ESPECÍFICOS PARA TU CASO.",
        description: "VALOR INCLUIDO / PRECIO $0",
      },
      {
        name: "HOJA DE RUTA CLARA PARA TU RECUPERACIÓN BIOLÓGICA.",
        description: "VALOR INCLUIDO / PRECIO $0",
      },
      {
        name: "TRANSPARENCIA TOTAL EN BIOTECNOLOGÍA.",
        description: "VALOR INCLUIDO / PRECIO $0",
      },
    ],
    price_anchor_text: "VALOR DE LA CONSULTORÍA ESPECIALIZADA",
  },
];

const immunotecMediaMap = {
  hero: stickyGalleryImage,
  gallery_1: stickyGalleryImageAlt1,
  gallery_2: stickyGalleryImageAlt2,
  gallery_3: stickyGalleryImageAlt3,
  gallery_4: stickyGalleryImageAlt4,
  product_box: stickyGalleryImage,
  specialist_consult: stickyGalleryImage,
  science_diagram: systemFatigueImage,
} satisfies Record<string, string>;

function SandboxContent() {
  return (
    <main
      className={`min-h-screen w-full ${jakawiPremiumClassNames.scope}`}
      style={jakawiPremiumThemeStyle}
    >
      <BlockRenderer
        blocks={immunotecFunnelData}
        mediaMap={immunotecMediaMap}
        template={{
          id: "jakawi-premium",
          code: "jakawi-premium",
          name: "Jakawi Premium",
        }}
      />
    </main>
  );
}

export default function SandboxPage() {
  return (
    <Suspense fallback={<div>Cargando Sandbox...</div>}>
      <SandboxContent />
    </Suspense>
  );
}
