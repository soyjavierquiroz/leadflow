"use client";

import { webPublicConfig } from "@/lib/public-env";

export type LoginApiResponse = {
  redirectPath: string;
};

const authApiBaseUrl = `${webPublicConfig.urls.api}/v1`;

export const LOGIN_REQUEST_TIMEOUT_MS = 10_000;

export const isLoginApiResponse = (
  value: unknown,
): value is LoginApiResponse =>
  typeof value === "object" &&
  value !== null &&
  "redirectPath" in value &&
  typeof value.redirectPath === "string" &&
  value.redirectPath.startsWith("/");

export const getLoginErrorMessage = (payload: unknown) =>
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

export const resolveLoginTarget = (redirectPath: string) => {
  if (redirectPath.startsWith("/admin") || redirectPath.startsWith("/team")) {
    return new URL(redirectPath, webPublicConfig.urls.admin).toString();
  }

  if (redirectPath.startsWith("/member")) {
    return new URL(redirectPath, webPublicConfig.urls.members).toString();
  }

  return new URL(redirectPath, webPublicConfig.urls.site).toString();
};

export const logoutWithSession = async (): Promise<void> => {
  const response = await fetch(`${authApiBaseUrl}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("No pudimos cerrar la sesión.");
  }
};
