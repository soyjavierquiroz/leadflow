import { unstable_noStore as noStore } from "next/cache";
import { apiFetchWithSession } from "@/lib/auth";

export type SystemFunnelArsenalTemplateStatus =
  | "draft"
  | "active"
  | "archived";

export type SystemFunnelArsenalTemplate = {
  id?: string;
  templateKey: string;
  blueprintKey: string;
  vertical: string;
  label: string;
  description: string;
  goal: string;
  recommendedFor: string;
  cta: string;
  pathSuggestion: string;
  difficulty: "basic" | "intermediate" | "advanced" | string;
  status: SystemFunnelArsenalTemplateStatus;
  blocksPresetKey?: string | null;
  funnelTemplateId?: string | null;
  sourceFunnelId?: string | null;
  sourceFunnelInstanceId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const getErrorMessage = (payload: unknown) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ?? "No pudimos cargar el Arsenal de embudos.";

export const getSystemFunnelArsenalTemplates = async (): Promise<
  SystemFunnelArsenalTemplate[]
> => {
  noStore();

  const response = await apiFetchWithSession("/system/funnel-arsenal");
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return Array.isArray(payload) ? (payload as SystemFunnelArsenalTemplate[]) : [];
};
