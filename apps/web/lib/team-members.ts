import { apiFetchWithSession } from "@/lib/auth";

export type TeamMembersSeatSummary = {
  teamId: string;
  teamName: string;
  maxSeats: number;
  activeSeats: number;
  availableSeats: number;
};

export type TeamMemberRecord = {
  id: string;
  userId: string;
  sponsorId: string | null;
  fullName: string;
  displayName: string | null;
  email: string;
  phone: string | null;
  role: "SUPER_ADMIN" | "TEAM_ADMIN" | "MEMBER";
  userStatus: string;
  sponsorStatus: string | null;
  availabilityStatus: "available" | "paused" | "offline" | null;
  isActive: boolean;
  memberPortalEnabled: boolean;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeamMembersSnapshot = {
  team: TeamMembersSeatSummary;
  members: TeamMemberRecord[];
};

type ErrorPayload = {
  message?: string;
  error?: string;
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

export const getTeamMembersSnapshot =
  async (): Promise<TeamMembersSnapshot> => {
    const response = await apiFetchWithSession("/team/members");
    const payload = (await response.json().catch(() => null)) as
      | TeamMembersSnapshot
      | ErrorPayload
      | null;

    if (!response.ok || !payload || Array.isArray(payload)) {
      throw new Error(
        getErrorMessage(payload, "No pudimos cargar la gestion de miembros."),
      );
    }

    return payload as TeamMembersSnapshot;
  };
