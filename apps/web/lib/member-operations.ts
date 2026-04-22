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

export type EvolutionConnectResponse = {
  instanceName: string;
  tenantId: string;
  ownerKey: string;
  connectionState: string;
  base64: string | null;
  pairingCode: string | null;
  attempts: number | null;
  raw: Record<string, unknown> | null;
};

export type EvolutionStatusResponse = {
  instanceName: string;
  exists: boolean;
  state: string;
  connected: boolean;
  raw: Record<string, unknown> | null;
};

export const memberOperationRequest = async <T>(
  path: string,
  init: RequestInit,
): Promise<T> => {
  const headers = new Headers(init.headers ?? {});
  const hasBody = init.body !== undefined && init.body !== null;
  const isFormDataRequest =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  if (hasBody && !isFormDataRequest && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${webPublicConfig.urls.api}/v1${path}`, {
    ...init,
    credentials: "include",
    headers,
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
