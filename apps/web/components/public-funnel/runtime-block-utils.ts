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

export const asStringArray = (value: JsonValue | undefined) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string");
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
