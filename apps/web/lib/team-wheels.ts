import type { TeamAdWheelRecord } from "@/lib/ad-wheels";
import { apiFetchWithSession } from "@/lib/auth";

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

export const getTeamAdWheels = async (): Promise<TeamAdWheelRecord[]> => {
  const response = await apiFetchWithSession("/team/wheels");
  const payload = (await response.json().catch(() => null)) as
    | TeamAdWheelRecord[]
    | ErrorPayload
    | null;

  if (!response.ok || !payload || !Array.isArray(payload)) {
    throw new Error(
      getErrorMessage(
        payload,
        "No pudimos cargar las ruedas publicitarias del team.",
      ),
    );
  }

  return payload;
};
