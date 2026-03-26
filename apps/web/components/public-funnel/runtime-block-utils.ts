import type {
  JsonValue,
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";

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

export const asBlockArray = (value: JsonValue | undefined) => {
  if (!value || typeof value !== "object" || !("blocks" in value)) {
    return [] as RuntimeBlock[];
  }

  const blocks = (value as { blocks?: JsonValue }).blocks;
  if (!Array.isArray(blocks)) {
    return [] as RuntimeBlock[];
  }

  return blocks.reduce<RuntimeBlock[]>((accumulator, block) => {
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
};

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
