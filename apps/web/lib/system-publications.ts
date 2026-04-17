import { unstable_noStore as noStore } from "next/cache";
import { apiFetchWithSession } from "@/lib/auth";
import type { SystemTenantRecord } from "@/lib/system-tenants";
import {
  buildResponseDebugContext,
  describePayloadShape,
  getErrorDebugDetails,
  logCriticalSsrError,
} from "@/lib/ssr-debug";

type LooseRecord = Record<string, unknown>;

export type SystemPublicationRecord = LooseRecord & {
  id: string;
  workspaceId: string;
  teamId: string;
  domainId: string;
  funnelId: string;
  funnelInstanceId: string;
  trackingProfileId?: string | null;
  handoffStrategyId?: string | null;
  metaPixelId?: string | null;
  tiktokPixelId?: string | null;
  metaCapiToken?: string | null;
  tiktokAccessToken?: string | null;
  path: string;
  pathPrefix: string;
  status: string;
  isActive: boolean;
  isPrimary: boolean;
  isRoutable: boolean;
  createdAt: string;
  updatedAt: string;
  workspace: LooseRecord & {
    id: string;
    name: string;
    slug: string;
  };
  team: LooseRecord & {
    id: string;
    name: string;
    code: string;
    status: string;
    isActive: boolean;
  };
  domain: LooseRecord & {
    id: string;
    host: string;
    normalizedHost: string;
    status: string;
  };
  funnel: LooseRecord & {
    id: string;
    legacyFunnelId: string | null;
    name: string;
    code: string;
    status: string;
    template: LooseRecord & {
      id: string;
      name: string;
      code: string;
    };
  };
};

export type SystemPublicationTeamOption = Pick<
  SystemTenantRecord,
  | "id"
  | "workspaceId"
  | "workspaceName"
  | "name"
  | "code"
  | "status"
  | "isActive"
>;

export type SystemPublicationDomainOption = LooseRecord & {
  id: string;
  workspaceId: string;
  teamId: string;
  host: string;
  status: string;
  onboardingStatus: string;
  verificationStatus: string;
};

export type SystemPublicationFunnelOption = LooseRecord & {
  id: string;
  workspaceId: string;
  teamId: string;
  templateId: string;
  legacyFunnelId: string | null;
  trackingProfileId?: string | null;
  handoffStrategyId?: string | null;
  theme?: string | null;
  name: string;
  code: string;
  status: string;
};

export const getSystemPublications = async () => {
  noStore();

  try {
    const response = await apiFetchWithSession("/system/publications");

    if (!response.ok) {
      const error = new Error(
        `No pudimos cargar los bindings globales (${response.status}).`,
      );
      logCriticalSsrError(error, {
        operation: "getSystemPublications",
        response: await buildResponseDebugContext(response),
      });
      throw error;
    }

    const payload = (await response.json()) as unknown;

    if (!Array.isArray(payload)) {
      const error = new Error(
        "El API devolvió un payload inválido para system/publications.",
      );
      logCriticalSsrError(error, {
        operation: "getSystemPublications",
        response: await buildResponseDebugContext(response),
        payloadShape: describePayloadShape(payload),
      });
      throw error;
    }

    return payload as SystemPublicationRecord[];
  } catch (error) {
    logCriticalSsrError(error, {
      operation: "getSystemPublications",
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};
