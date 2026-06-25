import { apiFetchWithSession } from "@/lib/auth";
import {
  buildAdvisorCrmInboxPath,
  getAdvisorCrmErrorMessage,
  type AdvisorCrmInboxResponse,
  type AdvisorCrmInboxSnapshotParams,
} from "@/lib/member-crm";

export const getAdvisorCrmInboxSnapshot = async (
  params: AdvisorCrmInboxSnapshotParams = {},
): Promise<AdvisorCrmInboxResponse> => {
  const response = await apiFetchWithSession(buildAdvisorCrmInboxPath(params), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(
      getAdvisorCrmErrorMessage(
        payload,
        "No pudimos cargar la bandeja CRM del asesor.",
      ),
    );
  }

  return payload as AdvisorCrmInboxResponse;
};
