import type { FunnelBlock, JsonValue } from "./types";

export const isRecord = (value: JsonValue | undefined): value is FunnelBlock =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const normalizeBlockType = (value: string) => {
  switch (value) {
    case "form_placeholder":
      return "lead_capture_form";
    case "final_cta":
      return "cta";
    case "marquee":
      return "announcement";
    default:
      return value;
  }
};

export const parseBlocksArray = (value: JsonValue): FunnelBlock[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<FunnelBlock[]>((accumulator, item) => {
    if (isRecord(item) && typeof item.type === "string") {
      accumulator.push(item);
    }

    return accumulator;
  }, []);
};

export const asString = (value: JsonValue | undefined) =>
  typeof value === "string" ? value.trim() : "";

export const normalizeActionTokens = (value: JsonValue | undefined) =>
  asString(value)
    .split(/[|,\s]+/g)
    .map((token) => token.trim())
    .filter(Boolean);

export const blockHasAction = (block: FunnelBlock, action: string): boolean => {
  if (normalizeActionTokens(block.action).includes(action)) {
    return true;
  }

  const cta = isRecord(block.cta) ? block.cta : null;
  if (normalizeActionTokens(cta?.action).includes(action)) {
    return true;
  }

  const ctaButton = isRecord(block.cta_button) ? block.cta_button : null;
  if (normalizeActionTokens(ctaButton?.action).includes(action)) {
    return true;
  }

  return false;
};

export const collectBlockOutcomes = (block: FunnelBlock) => {
  const containers = [
    block,
    isRecord(block.cta) ? block.cta : null,
    isRecord(block.cta_button) ? block.cta_button : null,
    isRecord(block.primary_cta) ? block.primary_cta : null,
    isRecord(block.secondary_cta) ? block.secondary_cta : null,
    isRecord(block.button) ? block.button : null,
    isRecord(block.settings) ? block.settings : null,
  ].filter((value): value is FunnelBlock => Boolean(value));

  return containers
    .flatMap((container) => [
      container.outcome,
      container.flow_outcome,
      container.flowOutcome,
    ])
    .map(asString)
    .map((value) => value.toLowerCase())
    .filter(Boolean);
};

export const hasLeadCaptureConfig = (blocks: FunnelBlock[]) =>
  blocks.some((block) => normalizeBlockType(block.type) === "lead_capture_config");

export const normalizePathTarget = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed, "https://runtime.local");
    const path = url.pathname.replace(/\/+$/g, "");
    return path || "/";
  } catch {
    const path = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return normalized.replace(/\/+$/g, "") || "/";
  }
};

export const collectBlockTargets = (block: FunnelBlock) => {
  const directTargets = [
    block.href,
    block.url,
    block.target,
    block.redirect_url,
    block.redirectUrl,
    block.primary_href,
    block.primaryHref,
    block.secondary_href,
    block.secondaryHref,
    block.primaryCtaHref,
    block.secondaryCtaHref,
  ];
  const cta = isRecord(block.cta) ? block.cta : null;
  const ctaButton = isRecord(block.cta_button) ? block.cta_button : null;
  const primaryCta = isRecord(block.primary_cta) ? block.primary_cta : null;
  const secondaryCta = isRecord(block.secondary_cta) ? block.secondary_cta : null;

  return [
    ...directTargets,
    cta?.href,
    cta?.url,
    cta?.target,
    ctaButton?.href,
    ctaButton?.url,
    ctaButton?.target,
    primaryCta?.href,
    primaryCta?.url,
    primaryCta?.target,
    secondaryCta?.href,
    secondaryCta?.url,
    secondaryCta?.target,
  ]
    .map(asString)
    .filter(Boolean);
};
