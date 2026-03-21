"use client";

import { webPublicConfig } from "@/lib/public-env";
import { getOrCreateAnonymousId } from "@/lib/public-funnel-session";

type TrackRuntimeEventInput = {
  eventId?: string;
  eventName: string;
  publicationId: string;
  stepId?: string | null;
  visitorId?: string | null;
  leadId?: string | null;
  assignmentId?: string | null;
  anonymousId?: string | null;
  currentPath?: string | null;
  referrer?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  ctaAction?: string | null;
  metadata?: Record<string, unknown>;
};

const runtimeSessionStorageKey = "leadflow:runtime:session-id";
const runtimeEventMarkerPrefix = "leadflow:runtime:event-marker:";

const isBrowser = () => typeof window !== "undefined";

export const createRuntimeEventId = (eventName: string) => {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${eventName}-${crypto.randomUUID()}`;
  }

  return `${eventName}-${Date.now()}`;
};

export const getOrCreateRuntimeSessionId = () => {
  if (!isBrowser()) {
    return "server-runtime-session";
  }

  const existing = window.sessionStorage.getItem(runtimeSessionStorageKey);
  if (existing) {
    return existing;
  }

  const sessionId = createRuntimeEventId("runtime-session");
  window.sessionStorage.setItem(runtimeSessionStorageKey, sessionId);
  return sessionId;
};

const getEventMarkerKey = (marker: string) =>
  `${runtimeEventMarkerPrefix}${marker}`;

export const hasTrackedRuntimeEvent = (marker: string) => {
  if (!isBrowser()) {
    return false;
  }

  return window.sessionStorage.getItem(getEventMarkerKey(marker)) === "1";
};

export const markRuntimeEventTracked = (marker: string) => {
  if (!isBrowser()) {
    return;
  }

  window.sessionStorage.setItem(getEventMarkerKey(marker), "1");
};

export const emitPublicRuntimeEvent = async (input: TrackRuntimeEventInput) => {
  const anonymousId =
    input.anonymousId ?? getOrCreateAnonymousId(input.publicationId);

  try {
    await fetch(`${webPublicConfig.urls.api}/v1/public/funnel-runtime/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify({
        ...input,
        eventId: input.eventId ?? createRuntimeEventId(input.eventName),
        anonymousId,
        referrer:
          input.referrer ??
          (typeof document !== "undefined" ? document.referrer || null : null),
      }),
    });
  } catch {
    return;
  }
};
