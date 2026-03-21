"use client";

import { webPublicConfig } from "@/lib/public-env";

type ErrorPayload = {
  message?: string;
  error?: string;
};

export type MemberMessagingConnection = {
  id: string;
  workspaceId: string;
  teamId: string;
  sponsorId: string;
  provider: "EVOLUTION";
  status:
    | "disconnected"
    | "provisioning"
    | "qr_ready"
    | "connecting"
    | "connected"
    | "error";
  instanceId: string | null;
  externalInstanceId: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  qrCodeData: string | null;
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  automationWebhookUrl: string | null;
  automationEnabled: boolean;
  metadata: unknown;
  lastSyncedAt: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemberMessagingSnapshot = {
  connection: MemberMessagingConnection | null;
  provider: {
    provider: "EVOLUTION";
    configured: boolean;
    internalConfigured: boolean;
    publicFallbackConfigured: boolean;
    routingMode: "internal" | "public" | "unconfigured";
    instancePrefix: string;
    automationBaseConfigured: boolean;
    fallbackWaMeEnabled: boolean;
    webhookEvent: string;
    note: string | null;
  };
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
