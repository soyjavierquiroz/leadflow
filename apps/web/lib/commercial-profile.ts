import { apiFetchWithSession } from "@/lib/auth";

export type CommercialProfileSalesMotion =
  | "whatsapp"
  | "whatsapp_calls"
  | "in_person"
  | "mixed";

export type CommercialProfile = {
  id: string;
  workspaceId: string;
  teamId: string;
  sponsorId: string | null;
  vertical: string;
  industry: string;
  businessModel: string;
  legacyNiche: string | null;
  presetVersion: string;
  blueprintKey: string;
  blueprintVersion: string;
  businessName: string;
  mainProduct: string | null;
  averagePrice: string | null;
  salesMotion: CommercialProfileSalesMotion | string | null;
  country: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommercialProfileSnapshot = {
  profile: CommercialProfile | null;
  isComplete: boolean;
};

export type UpdateCommercialProfilePayload = {
  businessName?: string;
  mainProduct?: string | null;
  averagePrice?: string | null;
  salesMotion?: CommercialProfileSalesMotion | null;
  country?: string | null;
  phone?: string | null;
  niche?: string | null;
  vertical?: string | null;
  industry?: string | null;
  businessModel?: string | null;
};

const getCommercialProfileErrorMessage = (payload: unknown) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ?? "No pudimos cargar tu perfil comercial.";

export const getCommercialProfileSnapshot =
  async (): Promise<CommercialProfileSnapshot> => {
    const response = await apiFetchWithSession("/commercial-profile/me");
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(getCommercialProfileErrorMessage(payload));
    }

    return payload as CommercialProfileSnapshot;
  };
