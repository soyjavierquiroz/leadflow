import { unstable_noStore as noStore } from "next/cache";
import { apiFetchWithSession } from "@/lib/auth";

export type SystemTenantRecord = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
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

export type SystemFunnelTemplateRecord = {
  id: string;
  workspaceId: string;
  name: string;
  code: string;
  isTemplate: boolean;
  defaultTeamId: string | null;
  createdAt: string;
  updatedAt: string;
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
  code: string;
  thumbnailUrl: string | null;
  status: string;
  isTemplate: boolean;
  stages: string[];
  entrySources: string[];
  defaultTeamId: string | null;
  defaultRotationPoolId: string | null;
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
