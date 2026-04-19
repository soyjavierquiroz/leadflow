import { unstable_noStore as noStore } from "next/cache";
import { apiFetchWithSession } from "@/lib/auth";
import type {
  SystemPublicationDomainOption,
  SystemPublicationFunnelOption,
  SystemPublicationRecord,
  SystemPublicationTeamOption,
} from "@/lib/system-publications.types";
import {
  buildResponseDebugContext,
  describePayloadShape,
  getErrorDebugDetails,
  logCriticalSsrError,
} from "@/lib/ssr-debug";
export type {
  SystemPublicationDomainOption,
  SystemPublicationFunnelOption,
  SystemPublicationRecord,
  SystemPublicationTeamOption,
} from "@/lib/system-publications.types";

export const getSystemPublications = async () => {
  noStore();

  try {
    const response = await apiFetchWithSession("/system/publications");

    if (!response.ok) {
      const error = new Error(
        `No pudimos cargar los bindings globales (${response.status}).`,
      );
      logCriticalSsrError(error, {
        operation: "getSystemPublications",
        response: await buildResponseDebugContext(response),
      });
      throw error;
    }

    const payload = (await response.json()) as unknown;

    if (!Array.isArray(payload)) {
      const error = new Error(
        "El API devolvió un payload inválido para system/publications.",
      );
      logCriticalSsrError(error, {
        operation: "getSystemPublications",
        response: await buildResponseDebugContext(response),
        payloadShape: describePayloadShape(payload),
      });
      throw error;
    }

    return payload as SystemPublicationRecord[];
  } catch (error) {
    logCriticalSsrError(error, {
      operation: "getSystemPublications",
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};
