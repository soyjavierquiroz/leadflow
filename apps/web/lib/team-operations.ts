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
  let response: Response;

  try {
    response = await fetch(`${webPublicConfig.urls.api}/v1${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
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
