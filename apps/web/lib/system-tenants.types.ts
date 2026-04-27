export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

type LooseRecord = Record<string, unknown>;

export type SystemTenantRecord = LooseRecord & {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  managerUserId: string | null;
  managerEmail: string | null;
  lastAssignedUserId?: string | null;
  name: string;
  code: string;
  status: string;
  isActive: boolean;
  subscriptionExpiresAt: string | null;
  maxSeats: number;
  occupiedSeats: number;
  activeSponsorsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProvisionTenantResponse = LooseRecord & {
  workspace: LooseRecord & {
    id: string;
    name: string;
    slug: string;
    status: string;
    timezone: string;
    defaultCurrency: string;
    primaryLocale: string;
    primaryDomain: string | null;
  };
  team: LooseRecord & {
    id: string;
    workspaceId: string;
    name: string;
    code: string;
    status: string;
    isActive: boolean;
    subscriptionExpiresAt: string | null;
    description: string | null;
    managerUserId: string | null;
    maxSeats: number;
    createdAt: string;
    updatedAt: string;
  };
  adminUser: LooseRecord & {
    id: string;
    workspaceId: string | null;
    teamId: string | null;
    sponsorId: string | null;
    fullName: string;
    email: string;
    role: "SUPER_ADMIN" | "TEAM_ADMIN" | "MEMBER";
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  sponsor: LooseRecord & {
    id: string;
    workspaceId: string;
    teamId: string;
    displayName: string;
    status: string;
    isActive: boolean;
    email: string | null;
    phone: string | null;
    availabilityStatus: string;
    routingWeight: number;
    memberPortalEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  };
  temporaryPassword: string | null;
  seatUsage: {
    maxSeats: number;
    activeSeats: number;
    availableSeats: number;
  };
};

export type CreateSystemTenantResponse = LooseRecord & {
  success: true;
  tenantId: string;
  workspaceId: string;
  adminUserId: string;
};

export type SystemFunnelTemplateRecord = LooseRecord & {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  code: string;
  thumbnailUrl: string | null;
  config: JsonValue;
  status: "draft" | "active" | "archived";
  isTemplate: boolean;
  stages: string[];
  entrySources: string[];
  defaultTeamId: string | null;
  defaultRotationPoolId: string | null;
  trackingProfileId?: string | null;
  handoffStrategyId?: string | null;
  theme?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SystemTemplateRecord = LooseRecord & {
  id: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  code: string;
  status: "draft" | "active" | "archived";
  version: number;
  funnelType: string;
  blocks: JsonValue;
  blocksJson: JsonValue;
  mediaMap: JsonValue;
  settingsJson: JsonValue;
  allowedOverridesJson: JsonValue;
  defaultHandoffStrategyId: string | null;
  trackingProfileId?: string | null;
  handoffStrategyId?: string | null;
  theme?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SystemTemplateDeploymentResponse = LooseRecord & {
  funnel: SystemTenantFunnelRecord;
  template: SystemTemplateRecord;
  team: LooseRecord & {
    id: string;
    workspaceId: string;
    name: string;
    code: string;
  };
};

export type SystemTenantDetailRecord = SystemTenantRecord & {
  description: string | null;
  managerUserId: string | null;
  availableSeats: number;
  funnelCount: number;
  domainCount: number;
  workspace: LooseRecord & {
    id: string;
    name: string;
    slug: string;
    status: string;
    timezone: string;
    defaultCurrency: string;
    primaryLocale: string;
    primaryDomain: string | null;
  };
};

export type SystemTenantFunnelRecord = LooseRecord & {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  code: string;
  thumbnailUrl: string | null;
  config: JsonValue;
  status: string;
  isTemplate: boolean;
  stages: string[];
  entrySources: string[];
  defaultTeamId: string | null;
  defaultRotationPoolId: string | null;
  trackingProfileId?: string | null;
  handoffStrategyId?: string | null;
  theme?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SystemTenantFunnelStepRecord = LooseRecord & {
  id: string;
  funnelInstanceId: string;
  slug: string;
  stepType: string;
  position: number;
  isEntryStep: boolean;
  isConversionStep: boolean;
  blocksJson: JsonValue;
  mediaMap: JsonValue;
  settingsJson: JsonValue;
  createdAt: string;
  updatedAt: string;
};

export type SystemTenantFunnelDetailRecord = SystemTenantFunnelRecord & {
  funnelInstanceId: string | null;
  settingsJson: JsonValue;
  steps: SystemTenantFunnelStepRecord[];
};

export type SystemTenantFunnelStepMutationResponse = LooseRecord & {
  funnel: SystemTenantFunnelRecord;
  step: SystemTenantFunnelStepRecord;
};

export type SystemTenantDomainRecord = LooseRecord & {
  id: string;
  workspaceId: string;
  teamId: string;
  linkedFunnelId: string | null;
  host: string;
  normalizedHost: string;
  status: string;
  onboardingStatus: string;
  verificationStatus: string;
  isPrimary: boolean;
  cloudflareHostnameStatus?: string | null;
  cloudflareSslStatus?: string | null;
  cloudflareErrorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SystemTenantDomainVerificationResponse = LooseRecord & {
  domain: SystemTenantDomainRecord;
  status: "verified" | "pending" | "failed";
  errorDetail: string | null;
};

export type SystemTenantDomainDeleteResponse = LooseRecord & {
  id: string;
  host: string;
  deleted: true;
};
