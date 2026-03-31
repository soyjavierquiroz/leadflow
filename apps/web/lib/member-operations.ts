"use client";

import { webPublicConfig } from "@/lib/public-env";

type ErrorPayload = {
  message?: string;
  error?: string;
};

export type MemberSponsorDashboardStatus =
  | "PROVISIONED"
  | "REGISTERED"
  | "READY";

export type MemberSponsorDashboard = {
  status: MemberSponsorDashboardStatus;
  qrCode: string | null;
  sponsorName: string;
  isConnected: boolean;
};

export const memberOperationRequest = async <T>(
  path: string,
  init: RequestInit,
): Promise<T> => {
  const response = await fetch(`${webPublicConfig.urls.api}/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const errorPayload = payload as ErrorPayload;
    const message =
      (typeof errorPayload.message === "string"
        ? errorPayload.message
        : null) ??
      (typeof errorPayload.error === "string" ? errorPayload.error : null) ??
      "No pudimos completar la operación.";

    throw new Error(message);
  }

  return payload as T;
};
