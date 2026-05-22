import { apiFetchWithSession } from "@/lib/auth";

export type AiSettingsRouteContexts = {
  risk: string;
  offer: string;
  product: string;
  service: string;
  business: string;
};

export type KloserSettings = {
  strategy: {
    cadence_minutes: number[];
  };
  compliance_policy: {
    quiet_hours: {
      start: string;
      end: string;
    };
  };
  cta_policy: {
    type: string;
    base_url: string | null;
    requires_shortener: boolean;
  };
  message_policy: {
    forbidden_claims: string[];
  };
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
  kloser: KloserSettings;
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

const getAiSettingsSnapshot = async (
  path: string,
): Promise<AiSettingsSnapshot> => {
  const response = await apiFetchWithSession(path);
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload as AiSettingsSnapshot;
};

export const getMyAiSettingsSnapshot = async (): Promise<AiSettingsSnapshot> =>
  getAiSettingsSnapshot("/ai-config/me");

export const getTeamAiSettingsSnapshot = async (): Promise<AiSettingsSnapshot> =>
  getAiSettingsSnapshot("/ai-config/team");

export const getManagementAiSettingsSnapshot =
  async (): Promise<AiSettingsSnapshot> => {
    const [personalSettings, teamSettings] = await Promise.all([
      getMyAiSettingsSnapshot(),
      getTeamAiSettingsSnapshot(),
    ]);

    return {
      ...personalSettings,
      basePrompt: teamSettings.basePrompt || personalSettings.basePrompt,
      kloser: teamSettings.kloser,
      resolution: {
        ...personalSettings.resolution,
        tenantConfigId:
          teamSettings.configId ?? teamSettings.resolution.tenantConfigId,
      },
    };
  };
