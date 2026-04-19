import type { SystemTenantRecord } from "@/lib/system-tenants.types";

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
