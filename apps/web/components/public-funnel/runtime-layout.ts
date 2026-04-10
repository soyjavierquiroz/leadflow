import {
  normalizeRuntimeBlockType,
} from "@/components/public-funnel/runtime-block-utils";
import type { JsonValue, RuntimeBlock } from "@/lib/public-funnel-runtime.types";

export type PublicStepLayoutMode = "single_column" | "split_media_focus";

const asRecord = (
  value: JsonValue | undefined,
): Record<string, JsonValue> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, JsonValue>;
};

const normalizeLayoutToken = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  return value.trim().toLowerCase();
};

const resolveExplicitLayoutToken = (settingsJson?: JsonValue) => {
  const settings = asRecord(settingsJson);
  const presentation = asRecord(settings?.presentation);
  const ui = asRecord(settings?.ui);

  return (
    normalizeLayoutToken(settings?.layout) ??
    normalizeLayoutToken(settings?.layoutMode) ??
    normalizeLayoutToken(settings?.layout_mode) ??
    normalizeLayoutToken(settings?.surfaceLayout) ??
    normalizeLayoutToken(settings?.surface_layout) ??
    normalizeLayoutToken(presentation?.layout) ??
    normalizeLayoutToken(ui?.layout)
  );
};

const normalizeLayoutValue = (value: unknown): PublicStepLayoutMode | null => {
  const normalized = normalizeLayoutToken(value);

  if (!normalized) {
    return null;
  }

  if (
    normalized === "single_column" ||
    normalized === "single-column" ||
    normalized === "centered" ||
    normalized === "center" ||
    normalized === "success" ||
    normalized === "thank_you" ||
    normalized === "thank-you"
  ) {
    return "single_column";
  }

  if (
    normalized === "split_media_focus" ||
    normalized === "split-media-focus" ||
    normalized === "sticky_media" ||
    normalized === "sticky-media" ||
    normalized === "split"
  ) {
    return "split_media_focus";
  }

  return null;
};

export const isCenteredPublicStepLayout = ({
  settingsJson,
}: {
  settingsJson?: JsonValue;
}) => {
  const explicitLayout = resolveExplicitLayoutToken(settingsJson);

  return explicitLayout === "centered" || explicitLayout === "center";
};

export const resolvePublicStepLayout = ({
  blocks,
  settingsJson,
}: {
  blocks: RuntimeBlock[];
  settingsJson?: JsonValue;
}): PublicStepLayoutMode => {
  const explicitLayout = normalizeLayoutValue(
    resolveExplicitLayoutToken(settingsJson),
  );

  if (explicitLayout) {
    return explicitLayout;
  }

  const hasCenteredConversionBlock = blocks.some(
    (block) => normalizeRuntimeBlockType(block.type) === "conversion_page_config",
  );

  return hasCenteredConversionBlock ? "single_column" : "split_media_focus";
};
