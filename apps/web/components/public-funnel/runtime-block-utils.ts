import type {
  JsonValue,
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";
import { applyTemplatePresetToBlock } from "@/components/public-funnel/template-presets";

export type RuntimeFaqItem = {
  question: string;
  answer: string;
};

export type RuntimeFeatureItem = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export type RuntimeMetricItem = {
  label: string;
  value: string;
  description?: string;
};

export type RuntimeTestimonialItem = {
  quote: string;
  author: string;
  role?: string;
  company?: string;
};

export type RuntimeOfferItem = {
  title: string;
  description?: string;
};

export type RuntimeMediaItem = {
  src: string;
  alt: string;
  caption?: string;
};

export type RuntimeLeadCaptureFieldOption = {
  label: string;
  value: string;
};

export type RuntimeLeadCaptureFieldType =
  | "text"
  | "tel"
  | "email"
  | "textarea"
  | "select"
  | "hidden";

export type RuntimeLeadCaptureFieldWidth = "full" | "half" | "third";

export type RuntimeLeadCaptureField = {
  name: string;
  label: string;
  type: RuntimeLeadCaptureFieldType;
  required: boolean;
  placeholder?: string;
  autocomplete?: string;
  width: RuntimeLeadCaptureFieldWidth;
  options: RuntimeLeadCaptureFieldOption[];
  hidden: boolean;
  defaultValue?: string;
};

export type RuntimeLeadCaptureFormBlock = {
  variant?: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  buttonText: string;
  helperText: string;
  privacyNote: string;
  successMode: "next_step" | "inline_message";
  fields: RuntimeLeadCaptureField[];
  settings: {
    captureUrlContext: boolean;
    sourceChannel: string;
    tags: string[];
    successMessage?: string;
  };
};

export type RuntimeBlocksCompatibilityMode =
  | "leadflow_native"
  | "leadflow_compatible";

export type RuntimeBlocksParseResult = {
  blocks: RuntimeBlock[];
  compatibility: {
    mode: RuntimeBlocksCompatibilityMode;
    templateId: string | null;
    presetId: string | null;
    mediaDictionaryKeys: string[];
  };
};

export const asRecord = (
  value: JsonValue | undefined,
): Record<string, JsonValue> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, JsonValue>;
};

export const asString = (value: JsonValue | undefined, fallback = "") => {
  return typeof value === "string" ? value : fallback;
};

export const asNumber = (value: JsonValue | undefined, fallback = 0) => {
  return typeof value === "number" ? value : fallback;
};

export const asBoolean = (value: JsonValue | undefined, fallback = false) => {
  return typeof value === "boolean" ? value : fallback;
};

export const asStringArray = (value: JsonValue | undefined) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const pickValue = (
  record: Record<string, JsonValue>,
  keys: string[],
): JsonValue | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
};

const pickString = (
  record: Record<string, JsonValue>,
  keys: string[],
  fallback = "",
) => {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }

  return fallback;
};

const pickArrayValue = (
  record: Record<string, JsonValue>,
  keys: string[],
): JsonValue | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return undefined;
};

const pickRecord = (
  record: Record<string, JsonValue>,
  keys: string[],
): Record<string, JsonValue> | null => {
  for (const key of keys) {
    const value = asRecord(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const normalizeTextItems = (value: JsonValue | undefined) => {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }

  return mapObjectArray(value, (item) => {
    const text = pickString(item, [
      "title",
      "label",
      "text",
      "body",
      "value",
      "name",
      "question",
    ]);

    return text || null;
  });
};

const resolveCompatibleCtaConfig = (
  record: Record<string, JsonValue>,
  options?: {
    containerKeys?: string[];
    hrefKeys?: string[];
    labelKeys?: string[];
    actionKeys?: string[];
  },
) => {
  const containers = [
    record,
    ...((options?.containerKeys ?? [])
      .map((key) => asRecord(record[key]))
      .filter((value): value is Record<string, JsonValue> => Boolean(value))),
  ];

  const hrefKeys = options?.hrefKeys ?? [];
  const labelKeys = options?.labelKeys ?? [];
  const actionKeys = options?.actionKeys ?? [];

  for (const candidate of containers) {
    const href = pickString(candidate, [
      ...hrefKeys,
      "href",
      "url",
      "path",
      "target",
      "link",
    ]);
    const label = pickString(candidate, [
      ...labelKeys,
      "label",
      "text",
      "title",
      "button_text",
      "buttonText",
      "caption",
    ]);
    const action = pickString(candidate, [...actionKeys, "action", "event"]);

    if (href || label || action) {
      return {
        href: href || undefined,
        label: label || undefined,
        action: action || undefined,
      };
    }
  }

  return null;
};

export const normalizeRuntimeBlockType = (value: string) => {
  switch (value) {
    case "form_placeholder":
      return "lead_capture_form";
    case "hero_block":
      return "hero";
    case "video_block":
      return "video";
    case "faq_accordion":
      return "faq";
    case "features":
      return "feature_grid";
    case "features_and_benefits":
    case "how_it_works":
      return "feature_grid";
    case "offer":
    case "pricing":
    case "offer_stack":
      return "offer_pricing";
    case "final_cta":
      return "cta";
    case "risk_reversal":
      return "social_proof";
    case "testimonial":
    case "testimonials":
      return "testimonials";
    default:
      return value;
  }
};

const resolveTemplateId = (value: JsonValue | undefined) => {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  return (
    asString(record.preset) ||
    asString(record.code) ||
    asString(record.id) ||
    null
  );
};

const resolveMediaDictionaryRecord = (value: JsonValue | undefined) => {
  return asRecord(value) ?? {};
};

const resolveMediaDictionaryEntry = (
  dictionary: Record<string, JsonValue>,
  key: string,
  fallbackAlt: string,
) => {
  const value = dictionary[key];
  if (typeof value === "string" && value.trim()) {
    return {
      src: value,
      alt: fallbackAlt,
    } satisfies RuntimeMediaItem;
  }

  return asMediaItem(value, fallbackAlt);
};

const resolveInlineMedia = (
  blockRecord: Record<string, JsonValue>,
  fallbackAlt: string,
) => {
  const candidates = [
    pickValue(blockRecord, [
      "media",
      "image",
      "asset",
      "hero_media",
      "heroMedia",
      "video",
      "poster",
      "thumbnail",
    ]),
    pickRecord(blockRecord, ["media"])?.asset,
  ];

  for (const candidate of candidates) {
    const media = asMediaItem(candidate, fallbackAlt);
    if (media) {
      return media;
    }
  }

  return null;
};

const resolveMediaFromDictionary = (
  blockRecord: Record<string, JsonValue>,
  dictionary: Record<string, JsonValue>,
  fallbackAlt: string,
) => {
  const candidateKeys = [
    asString(blockRecord.media_key),
    asString(blockRecord.mediaKey),
    asString(blockRecord.image_key),
    asString(blockRecord.imageKey),
    asString(blockRecord.video_key),
    asString(blockRecord.videoKey),
    asString(blockRecord.asset_key),
    asString(blockRecord.assetKey),
    asString(blockRecord.media_dictionary_key),
    asString(blockRecord.mediaDictionaryKey),
  ].filter(Boolean);

  for (const key of candidateKeys) {
    const media = resolveMediaDictionaryEntry(dictionary, key, fallbackAlt);
    if (media) {
      return media;
    }
  }

  return resolveInlineMedia(blockRecord, fallbackAlt);
};

const normalizeHowItWorksItems = (value: JsonValue | undefined) => {
  return mapObjectArray(value, (item) => {
    const title = pickString(item, ["title", "step", "label", "headline", "name"]);
    const description = pickString(item, [
      "description",
      "body",
      "copy",
      "text",
      "details",
    ]);
    const eyebrow = pickString(item, ["eyebrow", "label", "tag"]);

    if (!title) {
      return null;
    }

    return {
      eyebrow: eyebrow || undefined,
      title,
      description: description || undefined,
    };
  });
};

const normalizeCompatibleExternalBlock = (
  rawBlock: Record<string, JsonValue>,
  dictionary: Record<string, JsonValue>,
  uiConfigValue: JsonValue | undefined,
  presetId: string | null,
  index: number,
) => {
  const rawType = asString(rawBlock.type);
  const normalizedType = normalizeRuntimeBlockType(rawType);
  const title = pickString(rawBlock, [
    "title",
    "headline",
    "hook",
    "heading",
    "name",
  ]);
  const description = pickString(rawBlock, [
    "description",
    "subheadline",
    "subtitle",
    "promise",
    "body",
    "copy",
    "text",
  ]);
  const media = resolveMediaFromDictionary(rawBlock, dictionary, title || rawType);

  const baseBlock: RuntimeBlock = {
    ...rawBlock,
    type: normalizedType,
    key: asString(rawBlock.key, `${normalizedType}-${index}`),
  };

  switch (rawType) {
    case "hero_block":
      baseBlock.eyebrow = pickString(rawBlock, [
        "eyebrow",
        "badge",
        "kicker",
        "tag",
      ]);
      baseBlock.title = title;
      baseBlock.description = description;
      baseBlock.accent = pickString(rawBlock, [
        "accent",
        "supporting_label",
        "supportingLabel",
      ]);
      baseBlock.metrics =
        pickArrayValue(rawBlock, ["metrics", "stats", "kpis", "numbers"]) ??
        undefined;
      baseBlock.proofItems =
        normalizeTextItems(
          pickArrayValue(rawBlock, [
            "proofItems",
            "proof_strip",
            "proofStrip",
            "bullets",
            "benefits",
            "supporting_points",
            "supportingPoints",
          ]),
        ) as unknown as JsonValue;
      const heroPrimaryCta = resolveCompatibleCtaConfig(rawBlock, {
        containerKeys: [
          "primary_cta",
          "primaryCta",
          "cta_primary",
          "primary_button",
          "primaryButton",
          "cta",
        ],
        hrefKeys: ["primary_href", "primaryHref"],
        labelKeys: ["primary_label", "primaryLabel"],
        actionKeys: ["primary_action", "primaryAction"],
      });
      const heroSecondaryCta = resolveCompatibleCtaConfig(rawBlock, {
        containerKeys: [
          "secondary_cta",
          "secondaryCta",
          "cta_secondary",
          "secondary_button",
          "secondaryButton",
        ],
        hrefKeys: ["secondary_href", "secondaryHref"],
        labelKeys: ["secondary_label", "secondaryLabel"],
        actionKeys: ["secondary_action", "secondaryAction"],
      });
      if (heroPrimaryCta?.href) {
        baseBlock.primaryCtaHref = heroPrimaryCta.href;
      }
      if (heroPrimaryCta?.label) {
        baseBlock.primaryCtaLabel = heroPrimaryCta.label;
      }
      if (heroSecondaryCta?.href) {
        baseBlock.secondaryCtaHref = heroSecondaryCta.href;
      }
      if (heroSecondaryCta?.label) {
        baseBlock.secondaryCtaLabel = heroSecondaryCta.label;
      }
      if (media) {
        baseBlock.media = media;
      }
      break;
    case "hook_and_promise":
      baseBlock.eyebrow = pickString(rawBlock, [
        "eyebrow",
        "badge",
        "kicker",
        "tag",
      ]);
      baseBlock.hook = pickString(rawBlock, [
        "hook",
        "title",
        "headline",
        "heading",
      ]);
      baseBlock.promise = pickString(rawBlock, [
        "promise",
        "description",
        "subheadline",
        "body",
        "copy",
      ]);
      baseBlock.items =
        normalizeTextItems(
          pickArrayValue(rawBlock, [
            "items",
            "bullets",
            "points",
            "benefits",
            "supporting_points",
          ]),
        ) as unknown as JsonValue;
      const hookCta = resolveCompatibleCtaConfig(rawBlock, {
        containerKeys: ["primary_cta", "primaryCta", "cta", "button"],
      });
      if (hookCta?.href) {
        baseBlock.href = hookCta.href;
      }
      if (hookCta?.label) {
        baseBlock.label = hookCta.label;
      }
      if (hookCta?.action) {
        baseBlock.action = hookCta.action;
      }
      break;
    case "social_proof":
      baseBlock.title = title || "Prueba social";
      baseBlock.description = description;
      baseBlock.metrics =
        pickArrayValue(rawBlock, ["metrics", "stats", "kpis", "results"]) ??
        undefined;
      baseBlock.testimonials =
        pickArrayValue(rawBlock, [
          "testimonials",
          "reviews",
          "quotes",
          "stories",
          "customers",
        ]) ?? undefined;
      baseBlock.items =
        pickArrayValue(rawBlock, [
          "items",
          "proof_items",
          "proofItems",
          "trust_points",
        ]) ?? undefined;
      break;
    case "urgency_timer":
      baseBlock.eyebrow = pickString(rawBlock, ["eyebrow", "badge", "tag"]);
      baseBlock.headline = pickString(rawBlock, [
        "headline",
        "title",
        "heading",
      ]);
      baseBlock.subheadline = pickString(rawBlock, [
        "subheadline",
        "description",
        "body",
      ]);
      baseBlock.expires_at = pickString(rawBlock, [
        "expires_at",
        "expiresAt",
        "deadline",
        "deadline_at",
        "deadlineAt",
        "end_at",
        "endAt",
        "ends_at",
        "endsAt",
      ]);
      baseBlock.duration_minutes =
        pickValue(rawBlock, [
          "duration_minutes",
          "durationMinutes",
          "duration_min",
          "durationMin",
          "duration",
        ]) ?? undefined;
      break;
    case "video_block":
      baseBlock.title = title;
      baseBlock.caption = pickString(rawBlock, [
        "caption",
        "description",
        "subheadline",
        "body",
      ]);
      baseBlock.embedUrl =
        pickString(rawBlock, [
          "embedUrl",
          "embed_url",
          "video_url",
          "videoUrl",
          "youtube_url",
          "youtubeUrl",
          "vimeo_url",
          "vimeoUrl",
          "url",
        ]) ||
        pickString(asRecord(rawBlock.video) ?? {}, [
          "embedUrl",
          "embed_url",
          "url",
          "src",
        ]) ||
        media?.src ||
        asString(rawBlock.url);
      baseBlock.items =
        normalizeTextItems(
          pickArrayValue(rawBlock, [
            "items",
            "bullets",
            "highlights",
            "takeaways",
          ]),
        ) as unknown as JsonValue;
      break;
    case "offer_stack":
      baseBlock.title = title || "Oferta";
      baseBlock.description = description;
      const priceBox = pickRecord(rawBlock, ["price_box", "priceBox"]);
      baseBlock.price =
        pickString(rawBlock, ["price", "primary_price", "primaryPrice"]) ||
        pickString(priceBox ?? {}, ["amount", "value", "price"]);
      baseBlock.price_note =
        pickString(rawBlock, ["price_note", "priceNote", "note", "subnote"]) ||
        pickString(priceBox ?? {}, ["note", "description", "caption"]);
      baseBlock.label =
        pickString(rawBlock, ["label", "button_text", "buttonText"]) || undefined;
      const offerCta = resolveCompatibleCtaConfig(rawBlock, {
        containerKeys: ["primary_cta", "primaryCta", "cta", "button"],
      });
      if (offerCta?.href) {
        baseBlock.href = offerCta.href;
      }
      if (offerCta?.label) {
        baseBlock.label = offerCta.label;
      }
      if (offerCta?.action) {
        baseBlock.action = offerCta.action;
      }
      baseBlock.items =
        pickArrayValue(rawBlock, [
          "items",
          "stack_items",
          "stackItems",
          "offer_items",
          "offerItems",
          "offers",
          "included",
          "inclusions",
        ]) ?? undefined;
      break;
    case "features_and_benefits":
      baseBlock.title = title || "Beneficios";
      baseBlock.description = description;
      baseBlock.items =
        pickArrayValue(rawBlock, [
          "items",
          "features",
          "benefits",
          "cards",
          "bullets",
        ]) ?? undefined;
      break;
    case "how_it_works":
      baseBlock.title = title || "Cómo funciona";
      baseBlock.description = description;
      baseBlock.items = normalizeHowItWorksItems(
        pickArrayValue(rawBlock, ["items", "steps", "sequence", "cards"]),
      ) as unknown as JsonValue;
      break;
    case "risk_reversal":
      baseBlock.title = title || "Reduce el riesgo";
      baseBlock.description = description;
      baseBlock.items =
        pickArrayValue(rawBlock, [
          "items",
          "guarantees",
          "guarantee_items",
          "guaranteeItems",
          "points",
          "bullets",
        ]) ?? undefined;
      baseBlock.variant = asString(rawBlock.variant, "risk_reversal");
      break;
    case "final_cta":
      baseBlock.title = title || "Siguiente paso";
      baseBlock.description = description;
      const finalCta = resolveCompatibleCtaConfig(rawBlock, {
        containerKeys: ["primary_cta", "primaryCta", "cta", "button"],
        labelKeys: ["button_text", "buttonText"],
      });
      baseBlock.label = finalCta?.label || pickString(rawBlock, ["label"], "Continuar");
      baseBlock.href = finalCta?.href || pickString(rawBlock, ["href", "url"]);
      baseBlock.action = finalCta?.action || undefined;
      baseBlock.items =
        normalizeTextItems(
          pickArrayValue(rawBlock, ["items", "bullets", "points", "benefits"]),
        ) as unknown as JsonValue;
      baseBlock.variant = asString(rawBlock.variant, "final_cta");
      break;
    case "faq_accordion":
      baseBlock.title = title || "Preguntas frecuentes";
      baseBlock.items =
        pickArrayValue(rawBlock, [
          "items",
          "questions",
          "faq_items",
          "faqItems",
          "faqs",
        ]) ?? undefined;
      baseBlock.variant = asString(rawBlock.variant, "accordion");
      break;
    default:
      if (media) {
        if (normalizedType === "video") {
          baseBlock.embedUrl =
            asString(rawBlock.embedUrl) || media.src || asString(rawBlock.url);
        } else {
          baseBlock.media = media;
        }
      }
      if (title && !baseBlock.title) {
        baseBlock.title = title;
      }
      if (description && !baseBlock.description) {
        baseBlock.description = description;
      }
      break;
  }

  return applyTemplatePresetToBlock(baseBlock, uiConfigValue, presetId);
};

export const parseRuntimeBlocks = (value: JsonValue | undefined) => {
  if (!value || typeof value !== "object" || !("blocks" in value)) {
    const compatibleRecord = asRecord(value);

    if (!compatibleRecord) {
      return {
        blocks: [] as RuntimeBlock[],
        compatibility: {
          mode: "leadflow_native" as const,
          templateId: null,
          presetId: null,
          mediaDictionaryKeys: [],
        },
      } satisfies RuntimeBlocksParseResult;
    }

    const templateId = resolveTemplateId(compatibleRecord.template);
    const uiConfig = compatibleRecord.ui_config;
    const presetId =
      asString(asRecord(uiConfig)?.preset, templateId ?? undefined) || templateId;
    const mediaDictionary = resolveMediaDictionaryRecord(
      compatibleRecord.media_dictionary,
    );
    const blocks: RuntimeBlock[] = [];
    const heroBlock = asRecord(compatibleRecord.hero_block);

    if (heroBlock) {
      blocks.push(
        normalizeCompatibleExternalBlock(
          {
            ...heroBlock,
            type: heroBlock.type ?? "hero_block",
          },
          mediaDictionary,
          uiConfig,
          presetId,
          0,
        ),
      );
    }

    const layoutBlocks = Array.isArray(compatibleRecord.layout_blocks)
      ? compatibleRecord.layout_blocks
      : [];
    const blockOffset = blocks.length;

    layoutBlocks.forEach((item, index) => {
      const record = asRecord(item);
      if (!record) {
        return;
      }

      blocks.push(
        normalizeCompatibleExternalBlock(
          record,
          mediaDictionary,
          uiConfig,
          presetId,
          blockOffset + index,
        ),
      );
    });

    return {
      blocks,
      compatibility: {
        mode: "leadflow_compatible",
        templateId,
        presetId,
        mediaDictionaryKeys: Object.keys(mediaDictionary),
      },
    } satisfies RuntimeBlocksParseResult;
  }

  const blocks = (value as { blocks?: JsonValue }).blocks;
  if (!Array.isArray(blocks)) {
    return {
      blocks: [] as RuntimeBlock[],
      compatibility: {
        mode: "leadflow_native",
        templateId: null,
        presetId: null,
        mediaDictionaryKeys: [],
      },
    } satisfies RuntimeBlocksParseResult;
  }

  const normalizedBlocks = blocks.reduce<RuntimeBlock[]>((accumulator, block) => {
    if (
      block &&
      typeof block === "object" &&
      !Array.isArray(block) &&
      typeof (block as { type?: unknown }).type === "string"
    ) {
      accumulator.push(block as RuntimeBlock);
    }

    return accumulator;
  }, []);
  const nativeRecord = asRecord(value);
  const templateId = resolveTemplateId(nativeRecord?.template);
  const uiConfig = nativeRecord?.ui_config;
  const presetId =
    asString(asRecord(uiConfig)?.preset, templateId ?? undefined) || templateId;

  return {
    blocks: normalizedBlocks.map((block) =>
      applyTemplatePresetToBlock(block, uiConfig, presetId),
    ),
    compatibility: {
      mode: "leadflow_native",
      templateId,
      presetId,
      mediaDictionaryKeys: Object.keys(
        resolveMediaDictionaryRecord(nativeRecord?.media_dictionary),
      ),
    },
  } satisfies RuntimeBlocksParseResult;
};

export const asBlockArray = (value: JsonValue | undefined) =>
  parseRuntimeBlocks(value).blocks;

const mapObjectArray = <T>(
  value: JsonValue | undefined,
  mapItem: (item: Record<string, JsonValue>) => T | null,
) => {
  if (!Array.isArray(value)) {
    return [] as T[];
  }

  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      return mapItem(record);
    })
    .filter((item): item is T => Boolean(item));
};

export const asFaqItems = (value: JsonValue | undefined) => {
  return mapObjectArray(value, (item) => {
    const question = pickString(item, [
      "question",
      "q",
      "title",
      "headline",
      "label",
    ]);
    const answer = pickString(item, [
      "answer",
      "a",
      "body",
      "content",
      "description",
      "copy",
      "text",
    ]);

    if (!question || !answer) {
      return null;
    }

    return { question, answer } satisfies RuntimeFaqItem;
  });
};

export const asFeatureItems = (value: JsonValue | undefined) => {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.map((item) => ({
      eyebrow: undefined,
      title: item,
      description: undefined,
    }));
  }

  return mapObjectArray(value, (item) => {
    const title = pickString(item, ["title", "label", "headline", "name"]);
    const description = pickString(item, [
      "description",
      "body",
      "copy",
      "text",
      "details",
    ]);
    const eyebrow = pickString(item, ["eyebrow", "tag", "kicker"]);

    if (!title) {
      return null;
    }

    return {
      eyebrow: eyebrow || undefined,
      title,
      description: description || undefined,
    } satisfies RuntimeFeatureItem;
  });
};

export const asMetricItems = (value: JsonValue | undefined) => {
  return mapObjectArray(value, (item) => {
    const label = pickString(item, ["label", "title", "name", "headline"]);
    const value = pickString(item, ["value", "stat", "number", "result"]);
    const description = pickString(item, [
      "description",
      "body",
      "copy",
      "text",
    ]);

    if (!label || !value) {
      return null;
    }

    return {
      label,
      value,
      description: description || undefined,
    } satisfies RuntimeMetricItem;
  });
};

export const asTestimonialItems = (value: JsonValue | undefined) => {
  return mapObjectArray(value, (item) => {
    const quote = pickString(item, [
      "quote",
      "body",
      "text",
      "review",
      "testimonial",
      "content",
    ]);
    const author = pickString(item, [
      "author",
      "name",
      "customer_name",
      "customerName",
      "client",
      "person",
    ]);
    const role = pickString(item, ["role", "title", "position"]);
    const company = pickString(item, ["company", "organization", "business"]);

    if (!quote || !author) {
      return null;
    }

    return {
      quote,
      author,
      role: role || undefined,
      company: company || undefined,
    } satisfies RuntimeTestimonialItem;
  });
};

export const asOfferItems = (value: JsonValue | undefined) => {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.map((item) => ({
      title: item,
      description: undefined,
    }));
  }

  return mapObjectArray(value, (item) => {
    const title = pickString(item, ["title", "label", "name", "headline"]);
    const description = pickString(item, [
      "description",
      "body",
      "copy",
      "text",
      "details",
    ]);

    if (!title) {
      return null;
    }

    return {
      title,
      description: description || undefined,
    } satisfies RuntimeOfferItem;
  });
};

export const resolveKnownLeadFieldName = (value: string) => {
  const normalized = value.trim().toLowerCase();

  if (
    [
      "full_name",
      "fullname",
      "full-name",
      "nombre",
      "nombre_completo",
      "name",
      "contact_name",
    ].includes(normalized)
  ) {
    return "fullName";
  }

  if (
    [
      "phone",
      "telefono",
      "teléfono",
      "tel",
      "whatsapp",
      "celular",
      "mobile",
    ].includes(normalized)
  ) {
    return "phone";
  }

  if (["email", "correo", "correo_electronico"].includes(normalized)) {
    return "email";
  }

  if (
    [
      "company",
      "companyname",
      "company_name",
      "compania",
      "compañia",
      "empresa",
      "negocio",
      "organization",
    ].includes(normalized)
  ) {
    return "companyName";
  }

  return value;
};

const detectLeadFieldNameFromLabel = (label: string) => {
  const normalized = label.trim().toLowerCase();

  if (
    normalized.includes("nombre") ||
    normalized.includes("name") ||
    normalized.includes("contacto")
  ) {
    return "fullName";
  }

  if (
    normalized.includes("whatsapp") ||
    normalized.includes("telefono") ||
    normalized.includes("teléfono") ||
    normalized.includes("phone") ||
    normalized.includes("celular")
  ) {
    return "phone";
  }

  if (normalized.includes("email") || normalized.includes("correo")) {
    return "email";
  }

  if (
    normalized.includes("empresa") ||
    normalized.includes("company") ||
    normalized.includes("negocio")
  ) {
    return "companyName";
  }

  return label.trim() || "field";
};

const normalizeLeadFieldType = (
  value: string,
): RuntimeLeadCaptureFieldType => {
  switch (value) {
    case "tel":
    case "email":
    case "textarea":
    case "select":
    case "hidden":
      return value;
    default:
      return "text";
  }
};

const normalizeLeadFieldWidth = (
  value: string,
): RuntimeLeadCaptureFieldWidth => {
  switch (value) {
    case "third":
      return "third";
    case "half":
      return "half";
    default:
      return "full";
  }
};

const asLeadFieldOptions = (value: JsonValue | undefined) => {
  return mapObjectArray(value, (item) => {
    const label = asString(item.label, asString(item.value));
    const optionValue = asString(item.value, asString(item.label));

    if (!label || !optionValue) {
      return null;
    }

    return {
      label,
      value: optionValue,
    } satisfies RuntimeLeadCaptureFieldOption;
  });
};

const defaultLeadCaptureFields = (): RuntimeLeadCaptureField[] => [
  {
    name: "fullName",
    label: "Nombre completo",
    type: "text",
    required: true,
    placeholder: "Tu nombre completo",
    autocomplete: "name",
    width: "full",
    options: [],
    hidden: false,
  },
  {
    name: "phone",
    label: "WhatsApp",
    type: "tel",
    required: false,
    placeholder: "Tu WhatsApp",
    autocomplete: "tel",
    width: "half",
    options: [],
    hidden: false,
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    required: false,
    placeholder: "tu@email.com",
    autocomplete: "email",
    width: "half",
    options: [],
    hidden: false,
  },
];

export const normalizeLeadCaptureFormBlock = (
  block: RuntimeBlock,
): RuntimeLeadCaptureFormBlock => {
  const settings = asRecord(block.settings);
  const recordFields = mapObjectArray(block.fields, (item) => {
    const rawName = asString(item.name, detectLeadFieldNameFromLabel(asString(item.label)));
    const label = asString(item.label, rawName);
    const type = normalizeLeadFieldType(
      asString(item.type, asBoolean(item.hidden) ? "hidden" : "text"),
    );

    if (!rawName) {
      return null;
    }

    return {
      name: resolveKnownLeadFieldName(rawName),
      label,
      type,
      required: asBoolean(item.required),
      placeholder: asString(item.placeholder) || undefined,
      autocomplete: asString(item.autocomplete) || undefined,
      width: normalizeLeadFieldWidth(asString(item.width, "full")),
      options: asLeadFieldOptions(item.options),
      hidden: asBoolean(item.hidden) || type === "hidden",
      defaultValue:
        asString(item.default_value, asString(item.defaultValue)) || undefined,
    } satisfies RuntimeLeadCaptureField;
  });
  const legacyFields = asStringArray(block.fields).map((label, index) => {
    const name = resolveKnownLeadFieldName(detectLeadFieldNameFromLabel(label));
    const type =
      name === "email" ? "email" : name === "phone" ? "tel" : "text";

    return {
      name,
      label,
      type,
      required: index === 0,
      placeholder: label,
      autocomplete:
        name === "fullName"
          ? "name"
          : name === "phone"
            ? "tel"
            : name === "email"
              ? "email"
              : "organization",
      width: index === 0 ? "full" : "half",
      options: [],
      hidden: false,
      defaultValue: undefined,
    } satisfies RuntimeLeadCaptureField;
  });

  return {
    variant: asString(block.variant) || undefined,
    eyebrow: asString(block.eyebrow, "Paso de conversión"),
    headline: asString(block.headline, asString(block.title, "Captura de lead")),
    subheadline: asString(
      block.subheadline,
      asString(
        block.description,
        "Déjanos tus datos y el runtime estándar de Leadflow se encarga de la captura, assignment y continuidad.",
      ),
    ),
    buttonText: asString(
      block.button_text,
      asString(block.buttonText, "Quiero continuar"),
    ),
    helperText: asString(
      block.helper_text,
      asString(
        block.helperText,
        "Capturamos el lead, resolvemos assignment y avanzamos al siguiente step cuando corresponda.",
      ),
    ),
    privacyNote: asString(
      block.privacy_note,
      asString(
        block.privacyNote,
        "Usamos tus datos para continuar la conversación comercial dentro del flujo estándar de Leadflow.",
      ),
    ),
    successMode:
      asString(block.success_mode, asString(block.successMode)) ===
      "inline_message"
        ? "inline_message"
        : "next_step",
    fields:
      recordFields.length > 0
        ? recordFields
        : legacyFields.length > 0
          ? legacyFields
          : defaultLeadCaptureFields(),
    settings: {
      captureUrlContext:
        settings?.capture_url_context === undefined &&
        settings?.captureUrlContext === undefined
          ? true
          : asBoolean(
              settings?.capture_url_context,
              asBoolean(settings?.captureUrlContext, true),
            ),
      sourceChannel: asString(
        settings?.source_channel,
        asString(settings?.sourceChannel, "form"),
      ),
      tags: asStringArray(settings?.tags),
      successMessage: asString(
        settings?.success_message,
        asString(settings?.successMessage),
      ) || undefined,
    },
  };
};

export const asMediaItem = (
  value: JsonValue | RuntimeBlock | undefined,
  fallbackAlt: string,
): RuntimeMediaItem | null => {
  if (typeof value === "string" && value.trim()) {
    return {
      src: value,
      alt: fallbackAlt,
    };
  }

  const record = asRecord(value as JsonValue | undefined);
  if (!record) {
    return null;
  }

  const nestedMedia =
    asMediaItem(record.image, fallbackAlt) ??
    asMediaItem(record.asset, fallbackAlt) ??
    asMediaItem(record.file, fallbackAlt) ??
    asMediaItem(record.video, fallbackAlt);
  if (nestedMedia) {
    return nestedMedia;
  }

  const src = pickString(record, [
    "imageUrl",
    "image_url",
    "src",
    "url",
    "embedUrl",
    "embed_url",
    "videoUrl",
    "video_url",
  ]);

  if (!src) {
    return null;
  }

  return {
    src,
    alt: pickString(record, ["alt", "label", "title"], fallbackAlt),
    caption: pickString(record, ["caption", "description"]) || undefined,
  };
};

export const extractImageFromMap = (
  mapValue: JsonValue | undefined,
  preferredKeys: string[],
  fallbackAlt: string,
) => {
  const record = asRecord(mapValue);
  if (!record) {
    return null;
  }

  for (const key of preferredKeys) {
    const media = asMediaItem(record[key], fallbackAlt);
    if (media) {
      return media;
    }
  }

  return null;
};

export const resolveCtaHref = (
  block: RuntimeBlock,
  runtime: PublicFunnelRuntimePayload,
) => {
  const directHref =
    asString(block.href) ||
    asString(block.url) ||
    asString(block.path) ||
    asString(asRecord(block.cta)?.href);
  if (directHref) {
    return directHref;
  }

  const action = asString(block.action);
  if (action === "next_step") {
    return runtime.nextStep?.path ?? runtime.currentStep.path;
  }

  if (action === "entry_step") {
    return (
      runtime.steps.find((step) => step.isEntryStep)?.path ??
      runtime.currentStep.path
    );
  }

  return runtime.currentStep.path;
};

export const toStepLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
