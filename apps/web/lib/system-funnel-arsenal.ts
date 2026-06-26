import { unstable_noStore as noStore } from "next/cache";
import { apiFetchWithSession } from "@/lib/auth";
import { normalizePublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime-safety";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";

export type SystemFunnelArsenalTemplateStatus = "draft" | "active" | "archived";

export type SystemFunnelArsenalTemplate = {
  id?: string;
  templateKey: string;
  assetSlug?: string | null;
  blueprintKey: string;
  vertical: string;
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
  difficulty: "basic" | "intermediate" | "advanced" | string;
  status: SystemFunnelArsenalTemplateStatus;
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
  blocksPresetKey?: string | null;
  funnelTemplateId?: string | null;
  sourceFunnelId?: string | null;
  sourceFunnelInstanceId?: string | null;
  libraryAssetVersionId?: string | null;
  sourceFunnelInstanceLabel?: string | null;
  builderUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SystemFunnelMarketplaceMasterFunnelResponse = {
  sourceFunnelInstanceId: string;
  sourceFunnelId: string;
  builderUrl: string;
  workspaceId: string;
  teamId: string;
};

const getErrorMessage = (payload: unknown) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ?? "No pudimos cargar el Arsenal de embudos.";

export class SystemFunnelMarketplaceRequestError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "SystemFunnelMarketplaceRequestError";
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

export const getSystemFunnelArsenalTemplates = async (): Promise<
  SystemFunnelArsenalTemplate[]
> => {
  noStore();

  const response = await apiFetchWithSession("/system/funnel-arsenal");
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new SystemFunnelMarketplaceRequestError(
      getErrorMessage(payload),
      response.status,
      getPayloadCode(payload),
    );
  }

  return Array.isArray(payload)
    ? (payload as SystemFunnelArsenalTemplate[])
    : [];
};

export const getSystemFunnelMarketplaceAsset = async (
  assetSlug: string,
): Promise<SystemFunnelArsenalTemplate> => {
  noStore();

  const response = await apiFetchWithSession(
    `/system/funnel-arsenal/${encodeURIComponent(assetSlug)}`,
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new SystemFunnelMarketplaceRequestError(
      getErrorMessage(payload),
      response.status,
      getPayloadCode(payload),
    );
  }

  return payload as SystemFunnelArsenalTemplate;
};

export const getSystemFunnelMarketplacePreview = async (
  assetSlug: string,
  stepSlug?: string,
): Promise<PublicFunnelRuntimePayload> => {
  noStore();

  const path = new URLSearchParams();
  if (stepSlug) {
    path.set("step", stepSlug);
  }

  const response = await apiFetchWithSession(
    `/system/funnel-arsenal/${encodeURIComponent(assetSlug)}/preview${
      path.size > 0 ? `?${path.toString()}` : ""
    }`,
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return normalizePublicFunnelRuntimePayload(payload, {
    host: "marketplace-preview.local",
  });
};
