"use client";

import { webPublicConfig } from "@/lib/public-env";

type ErrorPayload = {
  message?: string;
  error?: string;
};

export class MemberOperationRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MemberOperationRequestError";
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type MemberSponsorDashboardStatus =
  | "PROVISIONED"
  | "REGISTERED"
  | "READY";

export type MemberMessagingConnectionStatus =
  | "provisioning"
  | "qr_ready"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type MemberSponsorDashboard = {
  status: MemberSponsorDashboardStatus;
  qrCode: string | null;
  sponsorName: string;
  sponsorPhone: string | null;
  isConnected: boolean;
  connectionStatus: MemberMessagingConnectionStatus | null;
  qrExpiresAt: string | null;
  qrExpired: boolean;
  blacklistSsoAvailable: boolean;
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

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const errorPayload = payload as ErrorPayload;
    const message =
      (typeof errorPayload.message === "string"
        ? errorPayload.message
        : null) ??
      (typeof errorPayload.error === "string" ? errorPayload.error : null) ??
      "No pudimos completar la operación.";

    throw new MemberOperationRequestError(message, response.status);
  }

  return payload as T;
};
