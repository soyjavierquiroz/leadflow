"use client";

import { webPublicConfig } from "@/lib/public-env";

type ErrorPayload = {
  message?: string;
  error?: string;
};

export type LeadConversationSignal = {
  id: string;
  workspaceId: string;
  teamId: string;
  sponsorId: string | null;
  leadId: string | null;
  assignmentId: string | null;
  messagingConnectionId: string | null;
  automationDispatchId: string | null;
  source: "n8n" | "evolution";
  signalType:
    | "conversation_started"
    | "message_inbound"
    | "message_outbound"
    | "lead_contacted"
    | "lead_qualified"
    | "lead_follow_up"
    | "lead_won"
    | "lead_lost";
  processingStatus: "received" | "applied" | "ignored" | "failed";
  externalEventId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  leadStatusAfter:
    | "captured"
    | "qualified"
    | "assigned"
    | "nurturing"
    | "won"
    | "lost"
    | null;
  assignmentStatusAfter:
    | "pending"
    | "assigned"
    | "accepted"
    | "reassigned"
    | "closed"
    | null;
  occurredAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const conversationSignalRequest = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${webPublicConfig.urls.api}/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
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
      "No pudimos cargar las señales entrantes.";

    throw new Error(message);
  }

  return payload as T;
};

export const listLeadConversationSignals = async (
  leadId: string,
  limit = 8,
) => {
  const params = new URLSearchParams({
    leadId,
    limit: String(limit),
  });

  return conversationSignalRequest<LeadConversationSignal[]>(
    `/incoming-webhooks/messaging/signals?${params.toString()}`,
  );
};
