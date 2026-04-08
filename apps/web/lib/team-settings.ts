import { apiFetchWithSession } from "@/lib/auth";

export type TeamSettingsSnapshot = {
  teamId: string;
  workspaceId: string;
  agencyName: string;
  teamCode: string;
  logoUrl: string | null;
  baseDomain: string | null;
  updatedAt: string;
};

const getErrorMessage = (payload: unknown) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ?? "No pudimos cargar la configuración del equipo.";

export const getTeamSettingsSnapshot =
  async (): Promise<TeamSettingsSnapshot> => {
    const response = await apiFetchWithSession("/team/settings");
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(getErrorMessage(payload));
    }

    return payload as TeamSettingsSnapshot;
  };
