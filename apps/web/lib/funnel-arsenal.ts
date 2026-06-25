import { apiFetchWithSession } from "@/lib/auth";

export type FunnelArsenalDifficulty = "basic" | "intermediate" | "advanced";

export type FunnelArsenalTemplate = {
  templateKey: string;
  blueprintKey: string;
  label: string;
  description: string;
  goal: string;
  recommendedFor: string;
  cta: string;
  pathSuggestion: string;
  difficulty: FunnelArsenalDifficulty;
  blocksPresetKey?: string;
  enabled: boolean;
  publicationId?: string;
  publicUrl?: string;
};

export type FunnelArsenalSnapshot = {
  blueprintKey: string;
  templates: FunnelArsenalTemplate[];
};

const getFunnelArsenalErrorMessage = (payload: unknown) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ?? "No pudimos cargar tu arsenal de embudos.";

export const getFunnelArsenalSnapshot =
  async (): Promise<FunnelArsenalSnapshot> => {
    const response = await apiFetchWithSession("/funnel-arsenal/me");
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(getFunnelArsenalErrorMessage(payload));
    }

    return payload as FunnelArsenalSnapshot;
  };
