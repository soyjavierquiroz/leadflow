import { apiFetchWithSession } from "@/lib/auth";
import { normalizePublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime-safety";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";

export type FunnelArsenalDifficulty = "basic" | "intermediate" | "advanced";

export type FunnelArsenalTemplate = {
  templateKey: string;
  assetSlug?: string | null;
  blueprintKey: string;
  vertical?: string | null;
  industry?: string | null;
  subindustry?: string | null;
  businessModel?: string | null;
  funnelType?: string | null;
  funnelFormat?: string | null;
  framework?: string | null;
  objective?: string | null;
  stepsCount?: number | null;
  language?: string | null;
  country?: string | null;
  market?: string | null;
  level?: string | null;
  estimatedTimeMinutes?: number | null;
  tags?: string[];
  coverUrl?: string | null;
  thumbnailUrl?: string | null;
  screenshots?: unknown;
  videoPreviewUrl?: string | null;
  label: string;
  description: string;
  headline?: string | null;
  goal: string;
  recommendedFor: string;
  cta: string;
  pathSuggestion: string;
  difficulty: FunnelArsenalDifficulty;
  status?: "draft" | "active" | "archived";
  version?: string;
  authorName?: string | null;
  publishedAt?: string | null;
  problemSolved?: string | null;
  idealFor?: string | null;
  flowSummary?: unknown;
  compatibleBlueprints?: string[];
  assets?: unknown;
  media?: unknown;
  history?: unknown;
  cloneCount?: number;
  activeInstallations?: number;
  lastActivatedAt?: string | null;
  favoriteCount?: number;
  hasMasterFunnel?: boolean;
  blocksPresetKey?: string;
  enabled: boolean;
  source?: "master_clone" | "fallback";
  warning?: string;
  funnelInstanceId?: string;
  publicationId?: string;
  publicUrl?: string;
  pathPrefix?: string;
};

export type FunnelArsenalSnapshot = {
  blueprintKey: string | null;
  requiresCommercialProfile: boolean;
  templates: FunnelArsenalTemplate[];
};

const getFunnelArsenalErrorMessage = (payload: unknown) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ?? "No pudimos cargar tu arsenal de embudos.";

export class FunnelMarketplaceRequestError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "FunnelMarketplaceRequestError";
    this.status = status;
    this.code = code;
  }
}

const getPayloadCode = (payload: unknown) =>
  typeof payload === "object" &&
  payload !== null &&
  "code" in payload &&
  typeof payload.code === "string"
    ? payload.code
    : null;

export const getFunnelArsenalSnapshot =
  async (): Promise<FunnelArsenalSnapshot> => {
    const response = await apiFetchWithSession("/funnel-arsenal/me");
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(getFunnelArsenalErrorMessage(payload));
    }

    return payload as FunnelArsenalSnapshot;
  };

export const getFunnelMarketplaceAsset = async (
  assetSlug: string,
): Promise<FunnelArsenalTemplate> => {
  const response = await apiFetchWithSession(
    `/funnel-arsenal/me/${encodeURIComponent(assetSlug)}`,
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new FunnelMarketplaceRequestError(
      getFunnelArsenalErrorMessage(payload),
      response.status,
      getPayloadCode(payload),
    );
  }

  return payload as FunnelArsenalTemplate;
};

export const getFunnelMarketplacePreview = async (
  assetSlug: string,
  stepSlug?: string,
): Promise<PublicFunnelRuntimePayload> => {
  const params = new URLSearchParams();
  if (stepSlug) {
    params.set("step", stepSlug);
  }

  const response = await apiFetchWithSession(
    `/funnel-arsenal/me/${encodeURIComponent(assetSlug)}/preview${
      params.size > 0 ? `?${params.toString()}` : ""
    }`,
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new FunnelMarketplaceRequestError(
      getFunnelArsenalErrorMessage(payload),
      response.status,
      getPayloadCode(payload),
    );
  }

  return normalizePublicFunnelRuntimePayload(payload, {
    host: "marketplace-preview.local",
  });
};
