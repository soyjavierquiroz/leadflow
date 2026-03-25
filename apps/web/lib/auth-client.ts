"use client";

import type { AppUserRole } from "@/lib/auth";
import { webPublicConfig } from "@/lib/public-env";

type LoginErrorResponse = {
  message?: string;
  error?: string;
};

export type LoginApiResponse = {
  user: {
    fullName: string;
    role: AppUserRole;
  };
  redirectPath: string;
};

const authApiBaseUrl = `${webPublicConfig.urls.api}/v1`;

const isLoginApiResponse = (
  value: LoginApiResponse | LoginErrorResponse,
): value is LoginApiResponse =>
  typeof value === "object" &&
  value !== null &&
  "redirectPath" in value &&
  typeof value.redirectPath === "string";

export const resolveAppUrlForPath = (path: string) => {
  if (path.startsWith("/member")) {
    return `${webPublicConfig.urls.members}${path}`;
  }

  if (path.startsWith("/admin") || path.startsWith("/team")) {
    return `${webPublicConfig.urls.admin}${path}`;
  }

  return `${webPublicConfig.urls.site}${path}`;
};

export const loginWithCredentials = async (input: {
  email: string;
  password: string;
}): Promise<LoginApiResponse> => {
  const response = await fetch(`${authApiBaseUrl}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
    }),
  });

  const payload = (await response.json()) as
    | LoginApiResponse
    | LoginErrorResponse;

  if (!response.ok) {
    const message =
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
      "No pudimos iniciar sesión.";

    throw new Error(message);
  }

  if (!isLoginApiResponse(payload)) {
    throw new Error("El API devolvió una respuesta de login inválida.");
  }

  return payload;
};
