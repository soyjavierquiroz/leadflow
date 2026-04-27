import { apiFetchWithSession } from "@/lib/auth";

export type MemberProfileSponsor = {
  id: string;
  workspaceId: string;
  teamId: string;
  displayName: string;
  publicSlug: string | null;
  status: string;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  availabilityStatus: "available" | "paused" | "offline";
  routingWeight: number;
  memberPortalEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const getErrorMessage = (payload: unknown) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ?? "No pudimos cargar tu perfil operativo.";

export const getMemberProfileSnapshot =
  async (): Promise<MemberProfileSponsor> => {
    const response = await apiFetchWithSession("/sponsors/me");
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(getErrorMessage(payload));
    }

    return payload as MemberProfileSponsor;
  };
