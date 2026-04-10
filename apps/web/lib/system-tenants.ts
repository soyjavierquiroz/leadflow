import { unstable_noStore as noStore } from "next/cache";
import { apiFetchWithSession } from "@/lib/auth";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type SystemTenantRecord = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  managerUserId: string | null;
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

export type ProvisionTenantResponse = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: string;
    timezone: string;
    defaultCurrency: string;
    primaryLocale: string;
    primaryDomain: string | null;
  };
  team: {
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
  adminUser: {
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
  sponsor: {
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

export type CreateSystemTenantResponse = {
  success: true;
  tenantId: string;
  workspaceId: string;
  adminUserId: string;
};

export type SystemFunnelTemplateRecord = {
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
  createdAt: string;
  updatedAt: string;
};

export type SystemTemplateRecord = {
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
  createdAt: string;
  updatedAt: string;
};

export type SystemTemplateDeploymentResponse = {
  funnel: SystemTenantFunnelRecord;
  template: SystemTemplateRecord;
  team: {
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
  workspace: {
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

export type SystemTenantFunnelRecord = {
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
  createdAt: string;
  updatedAt: string;
};

export type SystemTenantFunnelStepRecord = {
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
  steps: SystemTenantFunnelStepRecord[];
};

export type SystemTenantFunnelStepMutationResponse = {
  funnel: SystemTenantFunnelRecord;
  step: SystemTenantFunnelStepRecord;
};

export type SystemTenantDomainRecord = {
  id: string;
  workspaceId: string;
  teamId: string;
  linkedFunnelId: string | null;
  host: string;
  normalizedHost: string;
  status: string;
  onboardingStatus: string;
  verificationStatus: string;
  createdAt: string;
  updatedAt: string;
};

const encodePathSegment = (value: string) => encodeURIComponent(value);

export const getSystemTenants = async () => {
  noStore();

  const response = await apiFetchWithSession("/system/tenants");

  if (!response.ok) {
    throw new Error(
      `No pudimos cargar los tenants del sistema (${response.status}).`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error("El API devolvió un payload inválido para system/tenants.");
  }

  return payload as SystemTenantRecord[];
};

export const getSystemTenant = async (teamId: string) => {
  noStore();

  const response = await apiFetchWithSession(
    `/system/tenants/${encodePathSegment(teamId)}`,
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `No pudimos cargar el tenant solicitado (${response.status}).`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("El API devolvió un payload inválido para el tenant.");
  }

  return payload as SystemTenantDetailRecord;
};

export const getSystemTenantFunnels = async (teamId: string) => {
  noStore();

  const response = await apiFetchWithSession(
    `/system/tenants/${encodePathSegment(teamId)}/funnels`,
  );

  if (!response.ok) {
    throw new Error(
      `No pudimos cargar los funnels del tenant (${response.status}).`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error(
      "El API devolvió un payload inválido para system/tenants/:id/funnels.",
    );
  }

  return payload as SystemTenantFunnelRecord[];
};

export const getSystemTenantFunnel = async (teamId: string, funnelId: string) => {
  noStore();

  const response = await apiFetchWithSession(
    `/system/tenants/${encodePathSegment(teamId)}/funnels/${encodePathSegment(funnelId)}`,
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `No pudimos cargar el funnel solicitado del tenant (${response.status}).`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("El API devolvió un payload inválido para el funnel del tenant.");
  }

  return payload as SystemTenantFunnelDetailRecord;
};

export const getSystemTenantDomains = async (teamId: string) => {
  noStore();

  const response = await apiFetchWithSession(
    `/system/tenants/${encodePathSegment(teamId)}/domains`,
  );

  if (!response.ok) {
    throw new Error(
      `No pudimos cargar los dominios del tenant (${response.status}).`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error(
      "El API devolvió un payload inválido para system/tenants/:id/domains.",
    );
  }

  return payload as SystemTenantDomainRecord[];
};

export const getSystemFunnelTemplates = async () => {
  noStore();

  const response = await apiFetchWithSession("/system/funnels/templates");

  if (!response.ok) {
    throw new Error(
      `No pudimos cargar los templates globales (${response.status}).`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error(
      "El API devolvió un payload inválido para system/funnels/templates.",
    );
  }

  return payload as SystemFunnelTemplateRecord[];
};

export const getWorkspaceFunnelTemplates = async (workspaceId: string) => {
  noStore();

  const response = await apiFetchWithSession(
    `/funnel-templates?workspaceId=${encodeURIComponent(workspaceId)}`,
  );

  if (!response.ok) {
    throw new Error(
      `No pudimos cargar los templates del workspace (${response.status}).`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error(
      "El API devolvió un payload inválido para funnel-templates del workspace.",
    );
  }

  return payload as SystemTemplateRecord[];
};

export const getSystemTemplates = async () => {
  noStore();

  const response = await apiFetchWithSession("/system/templates");

  if (!response.ok) {
    throw new Error(
      `No pudimos cargar el catálogo global de templates (${response.status}).`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error(
      "El API devolvió un payload inválido para system/templates.",
    );
  }

  return payload as SystemTemplateRecord[];
};

export const getSystemTemplate = async (templateId: string) => {
  noStore();

  const response = await apiFetchWithSession(
    `/system/templates/${encodePathSegment(templateId)}`,
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `No pudimos cargar el template solicitado (${response.status}).`,
    );
  }

  const payload = (await response.json()) as unknown;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("El API devolvió un payload inválido para el template.");
  }

  return payload as SystemTemplateRecord;
};
