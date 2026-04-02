import { unstable_noStore as noStore } from "next/cache";
import { apiFetchWithSession } from "@/lib/auth";
import type { SystemTenantRecord } from "@/lib/system-tenants";

export type SystemPublicationRecord = {
  id: string;
  workspaceId: string;
  teamId: string;
  domainId: string;
  funnelId: string;
  funnelInstanceId: string;
  path: string;
  pathPrefix: string;
  status: string;
  isActive: boolean;
  isPrimary: boolean;
  isRoutable: boolean;
  createdAt: string;
  updatedAt: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  team: {
    id: string;
    name: string;
    code: string;
    status: string;
    isActive: boolean;
  };
  domain: {
    id: string;
    host: string;
    normalizedHost: string;
    status: string;
  };
  funnel: {
    id: string;
    legacyFunnelId: string | null;
    name: string;
    code: string;
    status: string;
    template: {
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

export type SystemPublicationDomainOption = {
  id: string;
  workspaceId: string;
  teamId: string;
  host: string;
  status: string;
  onboardingStatus: string;
  verificationStatus: string;
};

export type SystemPublicationFunnelOption = {
  id: string;
  workspaceId: string;
  teamId: string;
  templateId: string;
  legacyFunnelId: string | null;
  name: string;
  code: string;
  status: string;
};

export const getSystemPublications = async () => {
  noStore();

  const response = await apiFetchWithSession("/system/publications");

  if (!response.ok) {
    throw new Error(
      `No pudimos cargar los bindings globales (${response.status}).`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error(
      "El API devolvió un payload inválido para system/publications.",
    );
  }

  return payload as SystemPublicationRecord[];
};
