import type { SponsorRecord } from "@/lib/app-shell/types";
import { apiFetchWithSession } from "@/lib/auth";

export type TeamLeadSupervisionStatus =
  | "orphaned"
  | "stagnant"
  | "active"
  | "closed";
export type TeamLeadTrafficLayer = "DIRECT" | "PAID_WHEEL" | "ORGANIC";

export type TeamLeadInboxItem = {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  sourceChannel: string;
  leadStatus:
    | "captured"
    | "qualified"
    | "assigned"
    | "nurturing"
    | "won"
    | "lost";
  assignmentStatus:
    | "pending"
    | "assigned"
    | "accepted"
    | "reassigned"
    | "closed"
    | null;
  supervisionStatus: TeamLeadSupervisionStatus;
  currentAssignmentId: string | null;
  assignedAt: string | null;
  lastActivity: string;
  updatedAt: string;
  funnelName: string | null;
  publicationPath: string | null;
  domainHost: string | null;
  trafficLayer: TeamLeadTrafficLayer;
  originAdWheelId: string | null;
  originAdWheelName: string | null;
  sponsor: {
    id: string;
    displayName: string;
    availabilityStatus: "available" | "paused" | "offline";
    status: string;
  } | null;
};

export type TeamLeadAvailableSponsor = Pick<
  SponsorRecord,
  "id" | "displayName" | "email" | "phone" | "status" | "isActive"
> & {
  availabilityStatus: "available" | "paused" | "offline";
  isAvailable: boolean;
};

export type TeamLeadReassignResponse = {
  lead: TeamLeadInboxItem;
  automationTriggered: boolean;
};

export type TeamLeadInboxSnapshot = {
  items: TeamLeadInboxItem[];
  availableSponsors: TeamLeadAvailableSponsor[];
};

const getErrorMessage = (payload: unknown, fallback: string) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ??
  (typeof payload === "object" &&
  payload !== null &&
  "error" in payload &&
  typeof payload.error === "string"
    ? payload.error
    : null) ??
  fallback;

export const getTeamLeadInboxSnapshot =
  async (): Promise<TeamLeadInboxSnapshot> => {
    const [leadsResponse, sponsorsResponse] = await Promise.all([
      apiFetchWithSession("/team/leads"),
      apiFetchWithSession("/sponsors"),
    ]);

    const [leadsPayload, sponsorsPayload] = await Promise.all([
      leadsResponse.json().catch(() => null),
      sponsorsResponse.json().catch(() => null),
    ]);

    if (!leadsResponse.ok) {
      throw new Error(
        getErrorMessage(
          leadsPayload,
          "No pudimos cargar la bandeja global del team.",
        ),
      );
    }

    if (!sponsorsResponse.ok) {
      throw new Error(
        getErrorMessage(
          sponsorsPayload,
          "No pudimos cargar los sponsors disponibles del team.",
        ),
      );
    }

    const sponsors = (sponsorsPayload as SponsorRecord[]).map((sponsor) => ({
      id: sponsor.id,
      displayName: sponsor.displayName,
      email: sponsor.email,
      phone: sponsor.phone,
      isActive: sponsor.isActive,
      availabilityStatus:
        sponsor.availabilityStatus as TeamLeadAvailableSponsor["availabilityStatus"],
      status: sponsor.status,
      isAvailable:
        sponsor.isActive &&
        sponsor.status === "active" &&
        sponsor.availabilityStatus === "available",
    }));

    return {
      items: leadsPayload as TeamLeadInboxItem[],
      availableSponsors: sponsors.filter((item) => item.isAvailable),
    };
  };
