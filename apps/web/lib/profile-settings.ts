import { apiFetchWithSession } from "@/lib/auth";

export type MyProfileSnapshot = {
  id: string;
  fullName: string;
  email: string;
  role: "SUPER_ADMIN" | "TEAM_ADMIN" | "MEMBER";
  phone: string | null;
  sponsorDisplayName: string | null;
  sponsorPublicSlug: string | null;
  avatarUrl: string | null;
  updatedAt: string;
};

const getErrorMessage = (payload: unknown) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ?? "No pudimos cargar tu perfil.";

export const getMyProfileSnapshot = async (): Promise<MyProfileSnapshot> => {
  const response = await apiFetchWithSession("/auth/me/profile");
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload as MyProfileSnapshot;
};
