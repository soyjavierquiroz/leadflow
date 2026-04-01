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
