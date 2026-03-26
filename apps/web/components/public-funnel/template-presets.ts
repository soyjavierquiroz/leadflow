import type { JsonValue, RuntimeBlock } from "@/lib/public-funnel-runtime.types";

const asRecord = (
  value: JsonValue | undefined,
): Record<string, JsonValue> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, JsonValue>;
};

const asString = (value: JsonValue | undefined, fallback = "") => {
  return typeof value === "string" ? value : fallback;
};

const normalizeRuntimeBlockType = (value: string) => {
  switch (value) {
    case "form_placeholder":
      return "lead_capture_form";
    case "features":
      return "feature_grid";
    case "offer":
    case "pricing":
      return "offer_pricing";
    case "testimonial":
    case "testimonials":
      return "testimonials";
    default:
      return value;
  }
};

export type TemplatePresetDefinition = {
  id: string;
  title: string;
  description: string;
  suggestedComposition: string[];
  blockVariants: Record<string, string>;
  blockDefaults: Record<string, Record<string, JsonValue>>;
};

export const templatePresets: Record<string, TemplatePresetDefinition> = {
  landing_capture_v1: {
    id: "landing_capture_v1",
    title: "Landing Capture v1",
    description:
      "Preset base para landings de captación con hero fuerte, prueba, formulario y oferta.",
    suggestedComposition: [
      "hero",
      "hook_and_promise",
      "social_proof",
      "feature_grid",
      "lead_capture_form",
      "offer_pricing",
      "faq",
    ],
    blockVariants: {
      hero: "leadflow_signal",
      hook_and_promise: "signal",
      social_proof: "metrics_trust",
      lead_capture_form: "conversion_card",
      offer_pricing: "offer_stack",
      faq: "accordion",
    },
    blockDefaults: {
      hero: {
        primaryCtaLabel: "Quiero dejar mis datos",
      },
      lead_capture_form: {
        success_mode: "next_step",
      },
    },
  },
  opportunity_vsl_v1: {
    id: "opportunity_vsl_v1",
    title: "Opportunity VSL v1",
    description:
      "Preset orientado a oportunidad/VSL con hero, video, prueba y captura más compacta.",
    suggestedComposition: [
      "hero",
      "video",
      "social_proof",
      "lead_capture_form",
      "offer_pricing",
      "faq",
    ],
    blockVariants: {
      hero: "opportunity",
      video: "vsl_focus",
      social_proof: "testimonials_focus",
      lead_capture_form: "compact_capture",
      offer_pricing: "offer_stack",
    },
    blockDefaults: {},
  },
  thank_you_reveal_v1: {
    id: "thank_you_reveal_v1",
    title: "Thank You Reveal v1",
    description:
      "Preset de cierre con confirmación, reveal y CTA de WhatsApp/handoff visible.",
    suggestedComposition: [
      "thank_you_reveal",
      "whatsapp_handoff_cta",
      "cta",
    ],
    blockVariants: {
      thank_you_reveal: "confirmation_reveal",
      whatsapp_handoff_cta: "handoff_primary",
    },
    blockDefaults: {},
  },
};

export const resolveTemplatePreset = (presetId?: string | null) => {
  if (!presetId) {
    return null;
  }

  return templatePresets[presetId] ?? null;
};

const resolveUiConfigVariantMap = (uiConfigValue: JsonValue | undefined) => {
  const record = asRecord(uiConfigValue);
  const variants = asRecord(
    record?.block_variants ?? record?.blockVariants ?? undefined,
  );

  if (!variants) {
    return {} as Record<string, string>;
  }

  return Object.entries(variants).reduce<Record<string, string>>(
    (accumulator, [key, value]) => {
      if (typeof value === "string" && value.trim()) {
        accumulator[key] = value.trim();
      }

      return accumulator;
    },
    {},
  );
};

export const applyTemplatePresetToBlock = (
  block: RuntimeBlock,
  uiConfigValue: JsonValue | undefined,
  presetId?: string | null,
) => {
  const preset = resolveTemplatePreset(presetId);
  const normalizedType = normalizeRuntimeBlockType(block.type);
  const uiVariantMap = resolveUiConfigVariantMap(uiConfigValue);
  const explicitVariant = asString(block.variant);
  const variantFromUi =
    uiVariantMap[block.type] ??
    uiVariantMap[normalizedType] ??
    uiVariantMap[asString(block.key)];
  const presetVariant = preset?.blockVariants[normalizedType];
  const defaults = preset?.blockDefaults[normalizedType] ?? {};

  const nextBlock: RuntimeBlock = {
    ...defaults,
    ...block,
    type: normalizedType,
  };

  const resolvedVariant = explicitVariant || variantFromUi || presetVariant;
  if (resolvedVariant) {
    nextBlock.variant = resolvedVariant;
  }

  return nextBlock;
};
