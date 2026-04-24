import { apiFetchWithSession } from "@/lib/auth";

export type AiSettingsRouteContexts = {
  risk: string;
  offer: string;
  product: string;
  service: string;
  business: string;
};

export type AiSettingsSnapshot = {
  configId: string | null;
  tenantId: string;
  memberId: string;
  tenantName: string;
  memberName: string;
  basePrompt: string;
  routeContexts: AiSettingsRouteContexts;
  ctaPolicy: {
    defaultCta: string | null;
  };
  resolution: {
    strategy: "member_override" | "tenant_default" | "empty";
    tenantConfigId: string | null;
    memberConfigId: string | null;
  };
  availablePlaceholders: string[];
  updatedAt: string | null;
};

const getErrorMessage = (payload: unknown) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ?? "No pudimos cargar la configuración de IA.";

export const getMyAiSettingsSnapshot = async (): Promise<AiSettingsSnapshot> => {
  const response = await apiFetchWithSession("/ai-config/me");
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload as AiSettingsSnapshot;
};
