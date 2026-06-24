"use client";

import { useEffect } from "react";
import { shouldEnableBrowserPixels } from "@/lib/browser-pixel-policy";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";
import {
  leadCaptureConversionEventName,
  toPartialEventId,
} from "@/lib/public-runtime-conversion-event";
import {
  persistSubmissionEventId,
  readSubmissionEventId,
} from "@/lib/public-funnel-session";

type ConfirmationConversionTrackerProps = {
  runtime: PublicFunnelRuntimePayload;
};

const retryDelayMs = 250;
const maxAttempts = 12;

const generateFallbackEventId = () => {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto &&
    typeof crypto.randomUUID === "function"
  ) {
    return `complete-registration-${crypto.randomUUID()}`;
  }

  return `complete-registration-${Date.now()}`;
};

const getQueryEventId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);

  return (
    params.get("event_id")?.trim() ||
    params.get("submissionEventId")?.trim() ||
    null
  );
};

const buildConversionFiredKey = (publicationId: string, eventId: string) =>
  `leadflow:conversion-fired:${publicationId}:${eventId}:${leadCaptureConversionEventName}`;

const hasFiredConversion = (storageKey: string) => {
  try {
    return Boolean(
      window.sessionStorage.getItem(storageKey) ||
        window.localStorage.getItem(storageKey),
    );
  } catch {
    return false;
  }
};

const markConversionFired = (storageKey: string) => {
  try {
    window.sessionStorage.setItem(storageKey, "1");
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // Storage can be unavailable in strict browser modes; the event should still fire.
  }
};

export function ConfirmationConversionTracker({
  runtime,
}: ConfirmationConversionTrackerProps) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const publicationId = runtime.publication.id;
    const hasMetaPixel = Boolean(runtime.publication.metaPixelId);
    const hasTikTokPixel = Boolean(runtime.publication.tiktokPixelId);

    if (
      (!hasMetaPixel && !hasTikTokPixel) ||
      !shouldEnableBrowserPixels(
        runtime.entryContext.trafficLayer,
        {
          metaPixelId: runtime.publication.metaPixelId,
          tiktokPixelId: runtime.publication.tiktokPixelId,
        },
        runtime.entryContext.browserPixelsEnabled,
      )
    ) {
      return;
    }

    const submissionEventId =
      getQueryEventId() ||
      readSubmissionEventId(publicationId) ||
      generateFallbackEventId();
    persistSubmissionEventId(publicationId, submissionEventId);

    const conversionFiredKey = buildConversionFiredKey(
      publicationId,
      submissionEventId,
    );

    if (hasFiredConversion(conversionFiredKey)) {
      return;
    }

    let attempts = 0;
    let metaFired = !hasMetaPixel;
    let tiktokFired = !hasTikTokPixel;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const maybeMarkComplete = () => {
      if (!metaFired || !tiktokFired) {
        return false;
      }

      markConversionFired(conversionFiredKey);
      console.info("CompleteRegistration fired", {
        publicationId,
        eventId: toPartialEventId(submissionEventId),
      });
      return true;
    };

    const tryFire = () => {
      attempts += 1;

      if (!metaFired && typeof window.fbq === "function") {
        window.fbq(
          "track",
          leadCaptureConversionEventName,
          {},
          { eventID: submissionEventId },
        );
        metaFired = true;
      }

      const ttqTrack = window.ttq?.track;
      if (!tiktokFired && typeof ttqTrack === "function") {
        ttqTrack(leadCaptureConversionEventName, {
          event_id: submissionEventId,
        });
        tiktokFired = true;
      }

      if (maybeMarkComplete() || attempts >= maxAttempts) {
        if (retryTimer) {
          clearInterval(retryTimer);
          retryTimer = null;
        }
      }
    };

    tryFire();

    if (!metaFired || !tiktokFired) {
      retryTimer = setInterval(tryFire, retryDelayMs);
    }

    return () => {
      if (retryTimer) {
        clearInterval(retryTimer);
      }
    };
  }, [runtime]);

  return null;
}
