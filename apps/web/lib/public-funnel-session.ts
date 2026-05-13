"use client";

import { useEffect, useState } from "react";
import { webPublicConfig } from "@/lib/public-env";
import type { PublicRuntimeEntryContext } from "@/lib/public-funnel-runtime.types";

export type LeadCaptureSubmissionResponse = {
  httpStatus?: number;
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
  lastAssignment: LeadCaptureSubmissionResponse["assignment"];
  nextStep: LeadCaptureSubmissionResponse["nextStep"];
  handoff: LeadCaptureSubmissionResponse["handoff"];
  advisor: LeadCaptureSubmissionResponse["advisor"];
  capturedAt: string;
};

type StoredEntryContext = PublicRuntimeEntryContext & {
  capturedAt: string;
};

const buildAnonymousIdKey = (publicationId: string) =>
  `leadflow:publication:${publicationId}:anonymous-id`;

const buildSubmissionContextKey = (publicationId: string) =>
  `leadflow:publication:${publicationId}:submission-context`;

const buildEntryContextKey = (publicationId: string) =>
  `leadflow:publication:${publicationId}:entry-context`;

const submissionContextChangedEvent = "leadflow:submission-context-changed";
const hydrationStatusChangedEvent = "leadflow:submission-hydration-changed";
const publicationStorageKeyPattern =
  /^leadflow:publication:(.+):(anonymous-id|submission-context|entry-context)$/;

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asNullableString = (value: unknown) =>
  typeof value === "string" ? value : null;

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const normalizeCampaignPathname = (value: string) => {
  const trimmed = value.trim() || "/";
  const withoutQuery = trimmed.split("?")[0] ?? "/";
  const withoutHash = withoutQuery.split("#")[0] ?? "/";
  const normalized = withoutHash.replace(/\/+/g, "/").replace(/\/$/, "");

  if (!normalized || normalized === ".") {
    return "/";
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
};

const hasCampaignEvidenceInUrl = (pathname: string, search: string) => {
  const normalizedPathname = normalizeCampaignPathname(pathname);
  const searchParams = new URLSearchParams(search);
  const utmSource = searchParams.get("utm_source")?.trim().toLowerCase() ?? null;

  return Boolean(
    normalizedPathname.startsWith("/promo/") ||
      normalizedPathname.startsWith("/p/") ||
      searchParams.get("fbclid")?.trim() ||
      searchParams.get("ttclid")?.trim() ||
      searchParams.get("gclid")?.trim() ||
      utmSource === "ads",
  );
};

const browserHasCampaignEvidence = () => {
  if (!isBrowser()) {
    return false;
  }

  return hasCampaignEvidenceInUrl(
    window.location.pathname,
    window.location.search,
  );
};

const clearHydrationCache = (publicationId: string) => {
  hydrationStateByPublication.delete(publicationId);
  hydrationPromiseByPublication.delete(publicationId);
  emitHydrationStateChanged(publicationId);
};

const clearPublicationStorageByKey = (storageKey: string) => {
  if (!isBrowser()) {
    return;
  }

  const matchedStorageKey = publicationStorageKeyPattern.exec(storageKey);
  if (!matchedStorageKey) {
    return;
  }

  const [, publicationId, keyType] = matchedStorageKey;
  if (keyType === "anonymous-id") {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.sessionStorage.removeItem(storageKey);
  if (keyType === "submission-context") {
    emitSubmissionContextChanged(publicationId);
  }
};

const clearPublicationSessionState = (
  publicationId: string,
  options?: {
    clearAnonymousId?: boolean;
  },
) => {
  if (!isBrowser()) {
    return;
  }

  clearPublicationStorageByKey(buildSubmissionContextKey(publicationId));
  clearPublicationStorageByKey(buildEntryContextKey(publicationId));

  if (options?.clearAnonymousId) {
    clearPublicationStorageByKey(buildAnonymousIdKey(publicationId));
  }

  clearHydrationCache(publicationId);
};

const reloadCurrentUrlWithoutCtx = () => {
  if (!isBrowser()) {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("ctx");
  window.location.replace(url.toString());
};

const readRuntimeSubmissionContext = (
  publicationId: string,
  runtime: unknown,
): StoredSubmissionContext | null => {
  const record = isRecord(runtime) ? runtime : null;
  if (!record) {
    return null;
  }

  const publicationRecord = isRecord(record.publication) ? record.publication : null;
  const assignmentRecord = isRecord(record.assignment) ? record.assignment : null;
  const handoffRecord = isRecord(record.handoff) ? record.handoff : null;
  const advisorRecord = isRecord(record.advisor) ? record.advisor : null;
  const publicationRuntimeId = asNullableString(publicationRecord?.id);

  if (
    publicationRuntimeId &&
    publicationRuntimeId.trim() &&
    publicationRuntimeId !== publicationId
  ) {
    return null;
  }

  if (!assignmentRecord && !advisorRecord && !handoffRecord) {
    return null;
  }

  const sponsorRecord = isRecord(assignmentRecord?.sponsor)
    ? assignmentRecord.sponsor
    : isRecord(handoffRecord?.sponsor)
      ? handoffRecord.sponsor
      : null;
  const leadId =
    asNullableString(record.leadId) ??
    asNullableString(assignmentRecord?.id) ??
    `runtime-${publicationId}`;

  return {
    publicationId,
    visitorId: null,
    anonymousId: null,
    leadId,
    assignment: assignmentRecord && sponsorRecord
      ? {
          id: asString(assignmentRecord.id, `${publicationId}-assignment`),
          status: asString(assignmentRecord.status, "assigned"),
          reason: asString(assignmentRecord.reason, "runtime"),
          assignedAt: asString(
            assignmentRecord.assignedAt,
            new Date().toISOString(),
          ),
          sponsor: {
            id: asString(sponsorRecord.id, "runtime-sponsor"),
            displayName: asString(sponsorRecord.displayName, "Asesor"),
            email: asNullableString(sponsorRecord.email),
            phone: asNullableString(sponsorRecord.phone),
            avatarUrl: asNullableString(sponsorRecord.avatarUrl),
          },
        }
      : null,
    lastAssignment: assignmentRecord && sponsorRecord
      ? {
          id: asString(assignmentRecord.id, `${publicationId}-assignment`),
          status: asString(assignmentRecord.status, "assigned"),
          reason: asString(assignmentRecord.reason, "runtime"),
          assignedAt: asString(
            assignmentRecord.assignedAt,
            new Date().toISOString(),
          ),
          sponsor: {
            id: asString(sponsorRecord.id, "runtime-sponsor"),
            displayName: asString(sponsorRecord.displayName, "Asesor"),
            email: asNullableString(sponsorRecord.email),
            phone: asNullableString(sponsorRecord.phone),
            avatarUrl: asNullableString(sponsorRecord.avatarUrl),
          },
        }
      : null,
    nextStep: null,
    handoff: {
      mode:
        handoffRecord?.mode === "thank_you_then_whatsapp" ||
        handoffRecord?.mode === "immediate_whatsapp"
          ? handoffRecord.mode
          : null,
      channel: handoffRecord?.channel === "whatsapp" ? "whatsapp" : null,
      buttonLabel: asNullableString(handoffRecord?.buttonLabel),
      autoRedirect: Boolean(handoffRecord?.autoRedirect),
      autoRedirectDelayMs:
        typeof handoffRecord?.autoRedirectDelayMs === "number"
          ? handoffRecord.autoRedirectDelayMs
          : null,
      sponsor: sponsorRecord
        ? {
            id: asString(sponsorRecord.id, "runtime-sponsor"),
            displayName: asString(sponsorRecord.displayName, "Asesor"),
            email: asNullableString(sponsorRecord.email),
            phone: asNullableString(sponsorRecord.phone),
            avatarUrl: asNullableString(sponsorRecord.avatarUrl),
          }
        : null,
      whatsappPhone: asNullableString(handoffRecord?.whatsappPhone),
      whatsappMessage: asNullableString(handoffRecord?.whatsappMessage),
      whatsappUrl: asNullableString(handoffRecord?.whatsappUrl),
    },
    advisor: advisorRecord
      ? {
          name: asString(advisorRecord.name, "Asesor"),
          role: asNullableString(advisorRecord.role),
          phone: asNullableString(advisorRecord.phone),
          photoUrl: asNullableString(advisorRecord.photoUrl),
          bio: asNullableString(advisorRecord.bio),
          whatsappUrl: asNullableString(advisorRecord.whatsappUrl),
        }
      : null,
    capturedAt: new Date().toISOString(),
  };
};

const resolveSubmissionContextSnapshot = (
  publicationId: string,
  runtime?: unknown,
) => {
  const storedContext = readSubmissionContext(publicationId);
  if (storedContext?.assignment?.sponsor) {
    return storedContext;
  }

  return readRuntimeSubmissionContext(publicationId, runtime) ?? storedContext;
};

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

  const assignedSponsor = payload.assignment?.sponsor ?? null;
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
    lastAssignment: payload.assignment,
    nextStep: payload.nextStep,
    handoff: {
      ...payload.handoff,
      sponsor: assignedSponsor ?? payload.handoff.sponsor,
    },
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

export const clearSubmissionContext = (publicationId: string) => {
  if (!isBrowser()) {
    return;
  }

  const storageKey = buildSubmissionContextKey(publicationId);
  if (!window.sessionStorage.getItem(storageKey)) {
    return;
  }

  clearPublicationStorageByKey(storageKey);
};

export const persistEntryContext = (
  publicationId: string,
  entryContext: PublicRuntimeEntryContext | null | undefined,
) => {
  if (!isBrowser() || !entryContext) {
    return;
  }

  const existing = readEntryContext(publicationId);
  if (
    existing?.attributionType === "promo" ||
    existing?.attributionType === "ref"
  ) {
    return;
  }

  const storedEntryContext: StoredEntryContext = {
    ...entryContext,
    capturedAt: new Date().toISOString(),
  };

  window.sessionStorage.setItem(
    buildEntryContextKey(publicationId),
    JSON.stringify(storedEntryContext),
  );
};

export const clearEntryContext = (publicationId: string) => {
  if (!isBrowser()) {
    return;
  }

  const storageKey = buildEntryContextKey(publicationId);
  if (!window.sessionStorage.getItem(storageKey)) {
    return;
  }

  clearPublicationStorageByKey(storageKey);
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
    const parsed = JSON.parse(rawValue) as StoredSubmissionContext;
    if (
      parsed.publicationId?.trim() &&
      parsed.publicationId.trim() !== publicationId
    ) {
      clearPublicationSessionState(publicationId);
      return null;
    }

    const assignment = parsed.assignment ?? null;
    const lastAssignment = parsed.lastAssignment ?? assignment ?? null;
    const assignedSponsor =
      assignment?.sponsor ?? lastAssignment?.sponsor ?? null;

    return {
      ...parsed,
      lastAssignment,
      handoff: {
        ...parsed.handoff,
        sponsor: assignedSponsor ?? parsed.handoff.sponsor,
      },
    };
  } catch {
    window.sessionStorage.removeItem(buildSubmissionContextKey(publicationId));
    return null;
  }
};

export const readEntryContext = (publicationId: string) => {
  if (!isBrowser()) {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(buildEntryContextKey(publicationId));
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredEntryContext;
  } catch {
    window.sessionStorage.removeItem(buildEntryContextKey(publicationId));
    return null;
  }
};

const toPublicEntryContext = (
  entryContext: StoredEntryContext | PublicRuntimeEntryContext | null | undefined,
): PublicRuntimeEntryContext | undefined => {
  if (!entryContext) {
    return undefined;
  }

  return {
    entryMode: entryContext.entryMode,
    trafficLayer: entryContext.trafficLayer,
    forcedSponsorId: entryContext.forcedSponsorId,
    adWheelId: entryContext.adWheelId,
    browserPixelsEnabled: entryContext.browserPixelsEnabled,
    attributionType: entryContext.attributionType ?? "organic",
    attributionSlug: entryContext.attributionSlug ?? null,
    runtimePathPrefix: entryContext.runtimePathPrefix ?? null,
    referralQueryParam: null,
  };
};

const resolveEffectiveEntryContext = (
  publicationId: string,
  currentEntryContext?: PublicRuntimeEntryContext | null,
) => {
  const hasCampaignEvidence = browserHasCampaignEvidence();
  const storedEntryContext = hasCampaignEvidence
    ? readEntryContext(publicationId)
    : null;

  if (
    storedEntryContext?.forcedSponsorId ||
    storedEntryContext?.trafficLayer === "PAID_WHEEL" ||
    storedEntryContext?.trafficLayer === "PAID_ADS"
  ) {
    return toPublicEntryContext(storedEntryContext);
  }

  if (
    currentEntryContext?.forcedSponsorId ||
    currentEntryContext?.trafficLayer === "PAID_WHEEL" ||
    currentEntryContext?.trafficLayer === "PAID_ADS"
  ) {
    return toPublicEntryContext(currentEntryContext);
  }

  return (
    toPublicEntryContext(storedEntryContext) ??
    toPublicEntryContext(currentEntryContext)
  );
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
        throw await createApiError(response);
      }

      const payload = (await response.json()) as {
        publicationId: string;
        targetStepPath: string;
        submissionContext: StoredSubmissionContext;
      };
      const resolvedPublicationId = payload.publicationId || publicationId;
      if (resolvedPublicationId !== publicationId) {
        clearPublicationSessionState(publicationId, {
          clearAnonymousId: true,
        });
        reloadCurrentUrlWithoutCtx();
        return null;
      }

      const submissionContext = {
        ...payload.submissionContext,
        lastAssignment:
          payload.submissionContext.lastAssignment ??
          payload.submissionContext.assignment ??
          null,
      };

      if (submissionContext.anonymousId) {
        window.localStorage.setItem(
          buildAnonymousIdKey(resolvedPublicationId),
          submissionContext.anonymousId,
        );
      }

      window.sessionStorage.setItem(
        buildSubmissionContextKey(resolvedPublicationId),
        JSON.stringify(submissionContext),
      );

      stripCtxTokenFromUrl();
      emitSubmissionContextChanged(resolvedPublicationId);
      setHydrationState(resolvedPublicationId, {
        status: "ready",
        ctxToken,
        error: null,
      });

      return submissionContext;
    })
    .catch((error: unknown) => {
      if (shouldResetPublicationSessionAfterHydrationError(error)) {
        clearPublicationSessionState(publicationId, {
          clearAnonymousId: true,
        });
        reloadCurrentUrlWithoutCtx();
        return null;
      }

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

export const useSubmissionContext = (
  publicationId: string,
  runtime?: unknown,
) => {
  const [context, setContext] = useState<StoredSubmissionContext | null>(() => {
    return resolveSubmissionContextSnapshot(publicationId, runtime);
  });

  useEffect(() => {
    setContext(resolveSubmissionContextSnapshot(publicationId, runtime));

    if (!isBrowser()) {
      return;
    }

    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ publicationId?: string }>).detail;
      if (detail?.publicationId && detail.publicationId !== publicationId) {
        return;
      }

      setContext(resolveSubmissionContextSnapshot(publicationId, runtime));
    };

    window.addEventListener(submissionContextChangedEvent, handleChange);
    return () =>
      window.removeEventListener(submissionContextChangedEvent, handleChange);
  }, [publicationId, runtime]);

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
  return (await parseApiError(response)).message;
};

const parseApiError = async (response: Response) => {
  try {
    const payload = (await response.json()) as {
      code?: string;
      message?: string | { message?: string } | { error?: string };
      error?: string;
    };

    if (typeof payload.message === "string") {
      return {
        code: payload.code ?? null,
        message: payload.message,
      };
    }

    if (
      payload.message &&
      typeof payload.message === "object" &&
      "message" in payload.message &&
      typeof payload.message.message === "string"
    ) {
      return {
        code: payload.code ?? null,
        message: payload.message.message,
      };
    }

    if (typeof payload.error === "string") {
      return {
        code: payload.code ?? null,
        message: payload.error,
      };
    }
  } catch {
    return {
      code: null,
      message: `La solicitud fallo con estado ${response.status}.`,
    };
  }

  return {
    code: null,
    message: `La solicitud fallo con estado ${response.status}.`,
  };
};

const createApiError = async (response: Response) => {
  const parsedError = await parseApiError(response);
  const error = new Error(parsedError.message) as Error & {
    code?: string | null;
    status?: number;
  };

  error.code = parsedError.code;
  error.status = response.status;
  return error;
};

const shouldResetPublicationSessionAfterHydrationError = (error: unknown) => {
  const code =
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : null;

  if (
    code === "IDENTITY_CONTEXT_LEAD_NOT_FOUND" ||
    code === "IDENTITY_CONTEXT_PUBLICATION_MISMATCH" ||
    code === "PUBLICATION_NOT_FOUND"
  ) {
    return true;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("could not be rehydrated") ||
    message.includes("does not match the current publication") ||
    message.includes("publication") && message.includes("not active")
  );
};

export const submitPublicLeadCapture = async (
  payload: LeadCaptureSubmissionPayload,
) => {
  const entryContext = resolveEffectiveEntryContext(
    payload.publicationId,
    payload.entryContext,
  );
  const response = await fetch(
    `${webPublicConfig.urls.api}/v1/public/funnel-runtime/submissions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        entryContext,
        entryMode: entryContext?.entryMode ?? "paid_ads",
        forcedSponsorId: entryContext?.forcedSponsorId ?? null,
        sourceChannel: payload.sourceChannel ?? "form",
        tags: ["runtime-v1", ...(payload.tags ?? [])],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return {
    ...((await response.json()) as LeadCaptureSubmissionResponse),
    httpStatus: response.status,
  };
};

export const submitRuntimeLeadCapture = async (params: {
  hostname: string;
  path: string;
  payload: LeadCaptureSubmissionPayload;
}) => {
  const { hostname, path, payload } = params;
  const entryContext = resolveEffectiveEntryContext(
    payload.publicationId,
    payload.entryContext,
  );
  const response = await fetch(`${webPublicConfig.urls.api}/v1/public/runtime/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      hostname,
      path,
      entryContext,
      entryMode: entryContext?.entryMode ?? "paid_ads",
      forcedSponsorId: entryContext?.forcedSponsorId ?? null,
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

  return {
    ...((await response.json()) as LeadCaptureSubmissionResponse),
    httpStatus: response.status,
  };
};
