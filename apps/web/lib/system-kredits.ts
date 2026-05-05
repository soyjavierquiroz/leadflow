import { unstable_noStore as noStore } from "next/cache";
import { apiFetchWithSession } from "@/lib/auth";
import {
  buildResponseDebugContext,
  describePayloadShape,
  getErrorDebugDetails,
  logCriticalSsrError,
} from "@/lib/ssr-debug";
import type {
  SystemKreditDirectoryRow,
  SystemKreditInjectionResponse,
} from "@/lib/system-kredits.types";

export type {
  SystemKreditDirectoryRow,
  SystemKreditInjectionRequest,
  SystemKreditInjectionResponse,
} from "@/lib/system-kredits.types";

const buildInvalidPayloadError = (context: string) =>
  new Error(`El API devolvió un payload inválido para ${context}.`);

const parseJsonPayload = async (response: Response, context: string) => {
  try {
    return (await response.json()) as unknown;
  } catch (error) {
    logCriticalSsrError(error, {
      operation: context,
      response: await buildResponseDebugContext(response),
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};

const ensureArrayPayload = async (response: Response, context: string) => {
  const payload = await parseJsonPayload(response, context);

  if (!Array.isArray(payload)) {
    const error = buildInvalidPayloadError(context);
    logCriticalSsrError(error, {
      operation: context,
      response: await buildResponseDebugContext(response),
      payloadShape: describePayloadShape(payload),
    });
    throw error;
  }

  return payload;
};

const ensureObjectPayload = async (response: Response, context: string) => {
  const payload = await parseJsonPayload(response, context);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = buildInvalidPayloadError(context);
    logCriticalSsrError(error, {
      operation: context,
      response: await buildResponseDebugContext(response),
      payloadShape: describePayloadShape(payload),
    });
    throw error;
  }

  return payload;
};

const assertOkResponse = async (
  response: Response,
  message: string,
  context: string,
) => {
  if (response.ok) {
    return;
  }

  const error = new Error(message);
  logCriticalSsrError(error, {
    operation: context,
    response: await buildResponseDebugContext(response),
  });
  throw error;
};

export const getSystemKreditDirectory = async () => {
  noStore();

  try {
    const response = await apiFetchWithSession("/system/kredits/directory");

    await assertOkResponse(
      response,
      `No pudimos cargar el directorio de Kredits (${response.status}).`,
      "getSystemKreditDirectory",
    );

    return (await ensureArrayPayload(
      response,
      "system/kredits/directory",
    )) as SystemKreditDirectoryRow[];
  } catch (error) {
    logCriticalSsrError(error, {
      operation: "getSystemKreditDirectory",
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};

export const readSystemKreditInjectionResponse = async (response: Response) => {
  return (await ensureObjectPayload(
    response,
    "system/kredits/injections",
  )) as SystemKreditInjectionResponse;
};
