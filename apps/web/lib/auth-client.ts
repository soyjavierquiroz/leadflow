"use client";

import { webPublicConfig } from "@/lib/public-env";

const authApiBaseUrl = `${webPublicConfig.urls.api}/v1`;

export const logoutWithSession = async (): Promise<void> => {
  const response = await fetch(`${authApiBaseUrl}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("No pudimos cerrar la sesión.");
  }
};
