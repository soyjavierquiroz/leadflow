import { unstable_noStore as noStore } from "next/cache";
import { apiFetchWithSession } from "@/lib/auth";

export type LibraryAssetVersionStatus = "draft" | "published" | "archived";

export type LeadflowLibrarySnapshot = {
  collections: Array<{
    id: string;
    slug: string;
    title: string;
    description?: string | null;
    assetType?: string | null;
    status: string;
    sortOrder: number;
    assets: Array<{
      id: string;
      slug: string;
      title: string;
      description?: string | null;
      assetType: string;
      ownerType: string;
      visibility: string;
      status: string;
      tags: Array<{
        id: string;
        slug: string;
        label: string;
      }>;
      publishedVersionId?: string | null;
      versions: Array<{
        id: string;
        version: string;
        status: LibraryAssetVersionStatus;
        publishedAt?: string | null;
        changeLog?: string | null;
        legacyFunnelArsenalTemplateCount: number;
        funnelVersion?: {
          id: string;
          sourceFunnelInstanceId?: string | null;
          sourceFunnelId?: string | null;
          stepsCount?: number | null;
          framework?: string | null;
          difficulty?: string | null;
          estimatedMinutes?: number | null;
          flowSummary?: unknown;
        } | null;
        media: Array<{
          id: string;
          mediaType: string;
          url: string;
          altText?: string | null;
          sortOrder: number;
        }>;
        compatibility: Array<{
          id: string;
          vertical?: string | null;
          industry?: string | null;
          businessModel?: string | null;
          blueprint?: string | null;
          country?: string | null;
          language?: string | null;
          accountType?: string | null;
          market?: string | null;
        }>;
      }>;
    }>;
  }>;
};

const getErrorMessage = (payload: unknown) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ?? "No pudimos cargar LeadFlow Library.";

export const getLeadflowLibrarySnapshot =
  async (): Promise<LeadflowLibrarySnapshot> => {
    noStore();

    const response = await apiFetchWithSession("/system/library");
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(getErrorMessage(payload));
    }

    return typeof payload === "object" &&
      payload !== null &&
      "collections" in payload &&
      Array.isArray(payload.collections)
      ? (payload as LeadflowLibrarySnapshot)
      : { collections: [] };
  };
