"use client";

import { webPublicConfig } from "@/lib/public-env";

export type LeadCaptureSubmissionResponse = {
  success?: boolean;
  visitor: {
    id: string;
    anonymousId: string;
  };
  lead: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    companyName: string | null;
    status: string;
  };
  assignment: {
    id: string;
    status: string;
    reason: string;
    assignedAt: string;
    sponsor: {
      id: string;
      displayName: string;
      email: string | null;
      phone: string | null;
      avatarUrl: string | null;
    };
  } | null;
  nextStep: {
    id: string;
    slug: string;
    path: string;
    stepType: string;
  } | null;
  handoff: {
    mode: "thank_you_then_whatsapp" | "immediate_whatsapp" | null;
    channel: "whatsapp" | null;
    buttonLabel: string | null;
    autoRedirect: boolean;
    autoRedirectDelayMs: number | null;
    sponsor: {
      id: string;
      displayName: string;
      email: string | null;
      phone: string | null;
      avatarUrl: string | null;
    } | null;
    whatsappPhone: string | null;
    whatsappMessage: string | null;
    whatsappUrl: string | null;
  };
  advisor?: {
    name: string;
    phone: string | null;
    photoUrl: string | null;
    bio: string | null;
    whatsappUrl: string | null;
  } | null;
  assigned_advisor?: {
    name: string;
    phone: string | null;
    photo_url: string | null;
    bio: string | null;
  } | null;
};

type StoredSubmissionContext = {
  publicationId: string;
  visitorId: string;
  anonymousId: string;
  leadId: string;
  assignment: LeadCaptureSubmissionResponse["assignment"];
  nextStep: LeadCaptureSubmissionResponse["nextStep"];
  handoff: LeadCaptureSubmissionResponse["handoff"];
  advisor: LeadCaptureSubmissionResponse["advisor"];
  capturedAt: string;
};

const buildAnonymousIdKey = (publicationId: string) =>
  `leadflow:publication:${publicationId}:anonymous-id`;

const buildSubmissionContextKey = (publicationId: string) =>
  `leadflow:publication:${publicationId}:submission-context`;

const isBrowser = () => typeof window !== "undefined";

export const getOrCreateAnonymousId = (publicationId: string) => {
  if (!isBrowser()) {
    return `server-${publicationId}`;
  }

  const storageKey = buildAnonymousIdKey(publicationId);
  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const anonymousId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `anon-${publicationId}-${Date.now()}`;

  window.localStorage.setItem(storageKey, anonymousId);
  return anonymousId;
};

export const persistSubmissionContext = (
  publicationId: string,
  payload: LeadCaptureSubmissionResponse,
) => {
  if (!isBrowser()) {
    return;
  }

  const context: StoredSubmissionContext = {
    publicationId,
    visitorId: payload.visitor.id,
    anonymousId: payload.visitor.anonymousId,
    leadId: payload.lead.id,
    assignment: payload.assignment,
    nextStep: payload.nextStep,
    handoff: payload.handoff,
    advisor:
      payload.advisor ??
      (payload.assigned_advisor
        ? {
            name: payload.assigned_advisor.name,
            phone: payload.assigned_advisor.phone,
            photoUrl: payload.assigned_advisor.photo_url,
            bio: payload.assigned_advisor.bio,
            whatsappUrl: payload.handoff.whatsappUrl,
          }
        : null),
    capturedAt: new Date().toISOString(),
  };

  window.sessionStorage.setItem(
    buildSubmissionContextKey(publicationId),
    JSON.stringify(context),
  );
};

export const readSubmissionContext = (publicationId: string) => {
  if (!isBrowser()) {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(
    buildSubmissionContextKey(publicationId),
  );
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredSubmissionContext;
  } catch {
    window.sessionStorage.removeItem(buildSubmissionContextKey(publicationId));
    return null;
  }
};

const parseErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as {
      message?: string | { message?: string } | { error?: string };
      error?: string;
    };

    if (typeof payload.message === "string") {
      return payload.message;
    }

    if (
      payload.message &&
      typeof payload.message === "object" &&
      "message" in payload.message &&
      typeof payload.message.message === "string"
    ) {
      return payload.message.message;
    }

    if (typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    return `La solicitud fallo con estado ${response.status}.`;
  }

  return `La solicitud fallo con estado ${response.status}.`;
};

export const submitPublicLeadCapture = async (payload: {
  publicationId: string;
  currentStepId: string;
  anonymousId: string;
  submissionEventId?: string | null;
  sourceUrl?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  utmMedium?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  ttclid?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  fieldValues?: Record<string, string | null>;
  tags?: string[];
  sourceChannel?: string | null;
}) => {
  const response = await fetch(
    `${webPublicConfig.urls.api}/v1/public/funnel-runtime/submissions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        sourceChannel: payload.sourceChannel ?? "form",
        tags: ["runtime-v1", ...(payload.tags ?? [])],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as LeadCaptureSubmissionResponse;
};
