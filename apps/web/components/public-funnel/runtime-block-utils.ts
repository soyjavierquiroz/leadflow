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
  ].filter(Boolean);

  for (const key of candidateKeys) {
    const media = resolveMediaDictionaryEntry(dictionary, key, fallbackAlt);
    if (media) {
      return media;
    }
  }

  return null;
};

const normalizeHowItWorksItems = (value: JsonValue | undefined) => {
  return mapObjectArray(value, (item) => {
    const title = asString(item.title, asString(item.step));
    const description = asString(item.description, asString(item.body));
    const eyebrow = asString(item.eyebrow, asString(item.label));

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
  const title = asString(rawBlock.title, asString(rawBlock.headline));
  const description = asString(
    rawBlock.description,
    asString(rawBlock.subheadline),
  );
  const media = resolveMediaFromDictionary(rawBlock, dictionary, title || rawType);

  const baseBlock: RuntimeBlock = {
    ...rawBlock,
    type: normalizedType,
    key: asString(rawBlock.key, `${normalizedType}-${index}`),
  };

  switch (rawType) {
    case "hero_block":
      baseBlock.eyebrow = asString(rawBlock.eyebrow, asString(rawBlock.badge));
      baseBlock.title = title;
      baseBlock.description = description;
      if (media) {
        baseBlock.media = media;
      }
      break;
    case "video_block":
      baseBlock.title = title;
      baseBlock.caption = description;
      baseBlock.embedUrl =
        asString(rawBlock.embedUrl) || media?.src || asString(rawBlock.url);
      break;
    case "offer_stack":
      baseBlock.title = title || "Oferta";
      baseBlock.description = description;
      baseBlock.price = asString(rawBlock.price, asString(rawBlock.primary_price));
      baseBlock.price_note = asString(
        rawBlock.price_note,
        asString(rawBlock.note),
      );
      baseBlock.items =
        rawBlock.items ?? rawBlock.stack_items ?? rawBlock.offers ?? undefined;
      break;
    case "features_and_benefits":
      baseBlock.title = title || "Beneficios";
      baseBlock.description = description;
      baseBlock.items = rawBlock.items ?? rawBlock.features ?? rawBlock.benefits;
      break;
    case "how_it_works":
      baseBlock.title = title || "Cómo funciona";
      baseBlock.description = description;
      baseBlock.items = normalizeHowItWorksItems(
        rawBlock.items ?? rawBlock.steps ?? rawBlock.sequence,
      ) as unknown as JsonValue;
      break;
    case "risk_reversal":
      baseBlock.title = title || "Reduce el riesgo";
      baseBlock.description = description;
      baseBlock.items = rawBlock.items ?? rawBlock.guarantees ?? rawBlock.points;
      baseBlock.variant = asString(rawBlock.variant, "risk_reversal");
      break;
    case "final_cta":
      baseBlock.title = title || "Siguiente paso";
      baseBlock.description = description;
      baseBlock.label = asString(
        rawBlock.button_text,
        asString(rawBlock.label, "Continuar"),
      );
      baseBlock.href = asString(rawBlock.href);
      baseBlock.variant = asString(rawBlock.variant, "final_cta");
      break;
    case "faq_accordion":
      baseBlock.title = title || "Preguntas frecuentes";
      baseBlock.items = rawBlock.items ?? rawBlock.questions ?? undefined;
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
    const question = asString(item.question);
    const answer = asString(item.answer);

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
    const title = asString(item.title, asString(item.label));
    const description = asString(item.description, asString(item.body));
    const eyebrow = asString(item.eyebrow);

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
    const label = asString(item.label, asString(item.title));
    const value = asString(item.value);
    const description = asString(item.description, asString(item.body));

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
    const quote = asString(item.quote, asString(item.body));
    const author = asString(item.author, asString(item.name));
    const role = asString(item.role);
    const company = asString(item.company);

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
    const title = asString(item.title, asString(item.label));
    const description = asString(item.description, asString(item.body));

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
  const record = asRecord(value as JsonValue | undefined);
  if (!record) {
    return null;
  }

  const src = asString(
    record.imageUrl ?? record.src ?? record.url ?? record.embedUrl,
  );

  if (!src) {
    return null;
  }

  return {
    src,
    alt: asString(record.alt, fallbackAlt),
    caption: asString(record.caption) || undefined,
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
    const value = asString(record[key]);
    if (value) {
      return {
        src: value,
        alt: fallbackAlt,
      } satisfies RuntimeMediaItem;
    }
  }

  return null;
};

export const resolveCtaHref = (
  block: RuntimeBlock,
  runtime: PublicFunnelRuntimePayload,
) => {
  const directHref = asString(block.href);
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
