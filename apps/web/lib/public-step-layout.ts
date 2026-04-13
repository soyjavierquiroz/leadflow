import type { JsonValue } from "@/lib/public-funnel-runtime.types";

const asRecord = (value: unknown): Record<string, JsonValue> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : null;

export const stepLayoutOverrideValues = [
  "inherit",
  "full-page",
  "blank",
] as const;

export type StepLayoutOverrideValue =
  (typeof stepLayoutOverrideValues)[number];

const normalizeStepLayoutOverride = (
  value: unknown,
): StepLayoutOverrideValue | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "inherit") {
    return "inherit";
  }

  if (
    normalized === "full-page" ||
    normalized === "full_page" ||
    normalized === "fullpage" ||
    normalized === "centered" ||
    normalized === "full page"
  ) {
    return "full-page";
  }

  if (normalized === "blank") {
    return "blank";
  }

  return null;
};

export const readStepLayoutOverride = (
  settingsJson: unknown,
): StepLayoutOverrideValue => {
  const settings = asRecord(settingsJson);
  const explicitOverride = normalizeStepLayoutOverride(settings?.layoutOverride);

  return explicitOverride ?? "inherit";
};

export const mergeStepLayoutOverride = (
  settingsJson: unknown,
  override: StepLayoutOverrideValue,
): JsonValue => {
  const settings = asRecord(settingsJson) ?? {};

  if (override === "inherit") {
    if (!Object.prototype.hasOwnProperty.call(settings, "layoutOverride")) {
      return settings;
    }

    const { layoutOverride: _removedLayoutOverride, ...rest } = settings;
    return rest;
  }

  return {
    ...settings,
    layoutOverride: override,
  };
};
