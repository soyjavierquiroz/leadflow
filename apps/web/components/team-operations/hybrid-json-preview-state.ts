import type { JsonValue } from "@/lib/public-funnel-runtime.types";

export const HYBRID_JSON_PREVIEW_STORAGE_PREFIX = "draft_preview";

export type HybridJsonPreviewDraft = {
  blocks: string;
  media: Record<string, string>;
  theme: string;
  settingsJson: JsonValue;
};

type MediaRowLike = {
  key: string;
  value: string;
};

const isRecord = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const emptyHybridJsonPreviewDraft: HybridJsonPreviewDraft = {
  blocks: "[]",
  media: {},
  theme: "default",
  settingsJson: {},
};

const normalizeDraftContextSegment = (value: string) =>
  value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-") || "draft";

export const buildHybridJsonPreviewDraftKey = (
  publicationId: string,
  stepId: string,
) =>
  `${HYBRID_JSON_PREVIEW_STORAGE_PREFIX}_${normalizeDraftContextSegment(
    publicationId,
  )}_${normalizeDraftContextSegment(stepId)}`;

export const sanitizeMediaMap = (value: unknown) => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>(
    (accumulator, [key, entry]) => {
      if (typeof entry !== "string") {
        return accumulator;
      }

      const trimmedKey = key.trim();
      const trimmedValue = entry.trim();

      if (!trimmedKey || !trimmedValue) {
        return accumulator;
      }

      accumulator[trimmedKey] = trimmedValue;
      return accumulator;
    },
    {},
  );
};

export const buildMediaMap = (rows: MediaRowLike[]) =>
  rows.reduce<Record<string, string>>((accumulator, row) => {
    const key = row.key.trim();
    const value = row.value.trim();
    if (!key || !value) {
      return accumulator;
    }

    accumulator[key] = value;
    return accumulator;
  }, {});

export const writeHybridJsonPreviewDraft = (
  draftKey: string,
  draft: HybridJsonPreviewDraft,
) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(draftKey, JSON.stringify(draft));
};

export const readHybridJsonPreviewDraft = (
  draftKey: string,
): HybridJsonPreviewDraft => {
  if (typeof window === "undefined") {
    return emptyHybridJsonPreviewDraft;
  }

  const rawDraft = window.localStorage.getItem(draftKey);
  if (!rawDraft) {
    return emptyHybridJsonPreviewDraft;
  }

  try {
    const parsedDraft = JSON.parse(rawDraft) as unknown;
    if (!isRecord(parsedDraft)) {
      return emptyHybridJsonPreviewDraft;
    }

    return {
      blocks:
        typeof parsedDraft.blocks === "string"
          ? parsedDraft.blocks
          : emptyHybridJsonPreviewDraft.blocks,
      media: sanitizeMediaMap(parsedDraft.media),
      theme:
        typeof parsedDraft.theme === "string" && parsedDraft.theme.trim()
          ? parsedDraft.theme.trim()
          : emptyHybridJsonPreviewDraft.theme,
      settingsJson: isRecord(parsedDraft.settingsJson)
        ? parsedDraft.settingsJson
        : emptyHybridJsonPreviewDraft.settingsJson,
    };
  } catch {
    return emptyHybridJsonPreviewDraft;
  }
};
