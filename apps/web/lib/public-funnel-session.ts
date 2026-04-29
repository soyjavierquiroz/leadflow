"use client";

import { useEffect, useState } from "react";
import { webPublicConfig } from "@/lib/public-env";
import type { PublicRuntimeEntryContext } from "@/lib/public-funnel-runtime.types";

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
    role?: string | null;
    phone: string | null;
    photoUrl: string | null;
    bio: string | null;
    whatsappUrl: string | null;
  } | null;
  assigned_advisor?: {
    name: string;
    role?: string | null;
    phone: string | null;
    photo_url: string | null;
    bio: string | null;
  } | null;
};

export type LeadCaptureSubmissionPayload = {
  publicationId: string;
  currentStepId: string;
  anonymousId: string;
  entryContext?: PublicRuntimeEntryContext;
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
};

type LeadSnapshot = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  status: string;
};

export type StoredSubmissionContext = {
  publicationId: string;
  visitorId: string | null;
  anonymousId: string | null;
  leadId: string;
  leadSnapshot?: LeadSnapshot;
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

const submissionContextChangedEvent = "leadflow:submission-context-changed";
const hydrationStatusChangedEvent = "leadflow:submission-hydration-changed";

const isBrowser = () => typeof window !== "undefined";

type SubmissionHydrationStatus = "idle" | "loading" | "ready" | "error";

type SubmissionHydrationState = {
  status: SubmissionHydrationStatus;
  ctxToken: string | null;
  error: string | null;
};

const hydrationStateByPublication = new Map<string, SubmissionHydrationState>();
const hydrationPromiseByPublication = new Map<
  string,
  Promise<StoredSubmissionContext | null>
>();

const emitSubmissionContextChanged = (publicationId: string) => {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(submissionContextChangedEvent, {
      detail: { publicationId },
    }),
  );
};

const emitHydrationStateChanged = (publicationId: string) => {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(hydrationStatusChangedEvent, {
      detail: { publicationId },
    }),
  );
};

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
    leadSnapshot: {
      id: payload.lead.id,
      fullName: payload.lead.fullName,
      email: payload.lead.email,
      phone: payload.lead.phone,
      companyName: payload.lead.companyName,
      status: payload.lead.status,
    },
    assignment: payload.assignment,
    nextStep: payload.nextStep,
    handoff: payload.handoff,
    advisor:
      payload.advisor ??
      (payload.assigned_advisor
        ? {
            name: payload.assigned_advisor.name,
            role: payload.assigned_advisor.role ?? null,
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
  emitSubmissionContextChanged(publicationId);
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

const readHydrationState = (publicationId: string): SubmissionHydrationState => {
  return (
    hydrationStateByPublication.get(publicationId) ?? {
      status: "idle",
      ctxToken: null,
      error: null,
    }
  );
};

const setHydrationState = (
  publicationId: string,
  nextState: SubmissionHydrationState,
) => {
  hydrationStateByPublication.set(publicationId, nextState);
  emitHydrationStateChanged(publicationId);
};

const readCtxTokenFromUrl = () => {
  if (!isBrowser()) {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const token = params.get("ctx")?.trim() || null;
  return token || null;
};

const stripCtxTokenFromUrl = () => {
  if (!isBrowser()) {
    return;
  }

  const url = new URL(window.location.href);
  if (!url.searchParams.has("ctx")) {
    return;
  }

  url.searchParams.delete("ctx");
  window.history.replaceState({}, "", url.toString());
};

export const ensureHydratedSubmissionContext = async (publicationId: string) => {
  if (!isBrowser()) {
    return null;
  }

  const ctxToken = readCtxTokenFromUrl();
  if (!ctxToken) {
    setHydrationState(publicationId, {
      status: "ready",
      ctxToken: null,
      error: null,
    });
    return readSubmissionContext(publicationId);
  }

  const currentState = readHydrationState(publicationId);
  if (
    currentState.status === "ready" &&
    currentState.ctxToken === ctxToken
  ) {
    return readSubmissionContext(publicationId);
  }

  const existingPromise = hydrationPromiseByPublication.get(publicationId);
  if (existingPromise && currentState.ctxToken === ctxToken) {
    return existingPromise;
  }

  setHydrationState(publicationId, {
    status: "loading",
    ctxToken,
    error: null,
  });

  const hydrationPromise = fetch(
    `${webPublicConfig.urls.api}/v1/public/funnel-runtime/hydrate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ctx: ctxToken }),
    },
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const payload = (await response.json()) as {
        publicationId: string;
        targetStepPath: string;
        submissionContext: StoredSubmissionContext;
      };
      const resolvedPublicationId = payload.publicationId || publicationId;

      if (payload.submissionContext.anonymousId) {
        window.localStorage.setItem(
          buildAnonymousIdKey(resolvedPublicationId),
          payload.submissionContext.anonymousId,
        );
      }

      window.sessionStorage.setItem(
        buildSubmissionContextKey(resolvedPublicationId),
        JSON.stringify(payload.submissionContext),
      );

      stripCtxTokenFromUrl();
      emitSubmissionContextChanged(resolvedPublicationId);
      setHydrationState(resolvedPublicationId, {
        status: "ready",
        ctxToken,
        error: null,
      });

      return payload.submissionContext;
    })
    .catch((error: unknown) => {
      setHydrationState(publicationId, {
        status: "error",
        ctxToken,
        error:
          error instanceof Error
            ? error.message
            : "No pudimos rehidratar el contexto del lead.",
      });
      throw error;
    })
    .finally(() => {
      hydrationPromiseByPublication.delete(publicationId);
    });

  hydrationPromiseByPublication.set(publicationId, hydrationPromise);
  return hydrationPromise;
};

export const useSubmissionContext = (publicationId: string) => {
  const [context, setContext] = useState<StoredSubmissionContext | null>(() =>
    readSubmissionContext(publicationId),
  );

  useEffect(() => {
    setContext(readSubmissionContext(publicationId));

    if (!isBrowser()) {
      return;
    }

    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ publicationId?: string }>).detail;
      if (detail?.publicationId && detail.publicationId !== publicationId) {
        return;
      }

      setContext(readSubmissionContext(publicationId));
    };

    window.addEventListener(submissionContextChangedEvent, handleChange);
    return () =>
      window.removeEventListener(submissionContextChangedEvent, handleChange);
  }, [publicationId]);

  return context;
};

export const useSubmissionHydration = (publicationId: string) => {
  const [state, setState] = useState<SubmissionHydrationState>(() =>
    readHydrationState(publicationId),
  );

  useEffect(() => {
    setState(readHydrationState(publicationId));
    void ensureHydratedSubmissionContext(publicationId).catch(() => undefined);

    if (!isBrowser()) {
      return;
    }

    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ publicationId?: string }>).detail;
      if (detail?.publicationId && detail.publicationId !== publicationId) {
        return;
      }

      setState(readHydrationState(publicationId));
    };

    window.addEventListener(hydrationStatusChangedEvent, handleChange);
    return () =>
      window.removeEventListener(hydrationStatusChangedEvent, handleChange);
  }, [publicationId]);

  return state;
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

export const submitPublicLeadCapture = async (
  payload: LeadCaptureSubmissionPayload,
) => {
  const response = await fetch(
    `${webPublicConfig.urls.api}/v1/public/funnel-runtime/submissions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        entryContext: payload.entryContext,
        entryMode: payload.entryContext?.entryMode ?? "paid_ads",
        forcedSponsorId: payload.entryContext?.forcedSponsorId ?? null,
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

export const submitRuntimeLeadCapture = async (params: {
  hostname: string;
  path: string;
  payload: LeadCaptureSubmissionPayload;
}) => {
  const { hostname, path, payload } = params;
  const response = await fetch(`${webPublicConfig.urls.api}/v1/public/runtime/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      hostname,
      path,
      entryContext: payload.entryContext,
      entryMode: payload.entryContext?.entryMode ?? "paid_ads",
      forcedSponsorId: payload.entryContext?.forcedSponsorId ?? null,
      anonymousId: payload.anonymousId,
      submissionEventId: payload.submissionEventId,
      sourceChannel: payload.sourceChannel ?? "form",
      sourceUrl: payload.sourceUrl,
      utmSource: payload.utmSource ?? null,
      utmCampaign: payload.utmCampaign ?? null,
      utmMedium: payload.utmMedium ?? null,
      utmContent: payload.utmContent ?? null,
      utmTerm: payload.utmTerm ?? null,
      fbclid: payload.fbclid ?? null,
      gclid: payload.gclid ?? null,
      ttclid: payload.ttclid ?? null,
      fullName: payload.fullName?.trim() || null,
      email: payload.email?.trim() || null,
      phone: payload.phone?.trim() || null,
      companyName: payload.companyName?.trim() || null,
      fieldValues: payload.fieldValues ?? {},
      tags: payload.tags ?? ["runtime-public-submit"],
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as LeadCaptureSubmissionResponse;
};
