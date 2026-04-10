"use client";

import { webPublicConfig } from "@/lib/public-env";

type ErrorPayload = {
  message?: string;
  error?: string;
};

export const teamOperationRequest = async <T>(
  path: string,
  init: RequestInit,
): Promise<T> => {
  return authenticatedOperationRequest<T>(path, init);
};

export const authenticatedOperationRequest = async <T>(
  path: string,
  init: RequestInit,
): Promise<T> => {
  let response: Response;
  const headers = new Headers(init.headers ?? {});
  const hasBody = init.body !== undefined && init.body !== null;
  const isFormDataRequest =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  if (hasBody && !isFormDataRequest && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    response = await fetch(`${webPublicConfig.urls.api}/v1${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `No pudimos conectar con el API del team (${error.message}).`
        : "No pudimos conectar con el API del team.",
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const errorPayload = payload as ErrorPayload;
    const message =
      (typeof errorPayload.message === "string"
        ? errorPayload.message
        : null) ??
      (typeof errorPayload.error === "string"
        ? errorPayload.error
        : null) ??
      "No pudimos completar la operación.";

    throw new Error(message);
  }

  return payload as T;
};
