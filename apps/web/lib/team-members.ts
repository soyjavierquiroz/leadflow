import { apiFetchWithSession } from "@/lib/auth";
import type { TeamMembersSnapshot } from "@/lib/team-members.schema";

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
