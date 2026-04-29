"use client";

import { useEffect } from "react";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";
import {
  ensureHydratedSubmissionContext,
  getOrCreateAnonymousId,
  readSubmissionContext,
} from "@/lib/public-funnel-session";
import {
  emitPublicRuntimeEvent,
  getOrCreateRuntimeSessionId,
  hasTrackedRuntimeEvent,
  markRuntimeEventTracked,
} from "@/lib/public-runtime-tracking";

type PublicRuntimeTrackerProps = {
  runtime: PublicFunnelRuntimePayload;
  previewHost?: string;
};

export function PublicRuntimeTracker({
  runtime,
  previewHost,
}: PublicRuntimeTrackerProps) {
  useEffect(() => {
    let isCancelled = false;

    const trackStep = async () => {
      try {
        await ensureHydratedSubmissionContext(runtime.publication.id);
      } catch {
        // If hydration fails we still emit the anonymous view instead of losing the event.
      }

      if (isCancelled) {
        return;
      }

      const submissionContext = readSubmissionContext(runtime.publication.id);
      const anonymousId =
        submissionContext?.anonymousId ??
        getOrCreateAnonymousId(runtime.publication.id);
      const sessionId = getOrCreateRuntimeSessionId();
      const sharedMetadata = {
        sessionId,
        previewHost: previewHost ?? null,
        stepType: runtime.currentStep.stepType,
        isConversionStep: runtime.currentStep.isConversionStep,
        hydratedLead: Boolean(submissionContext?.leadId),
      };

      const funnelViewMarker = [
        "funnel_viewed",
        runtime.publication.id,
        runtime.request.path,
      ].join(":");

      if (!hasTrackedRuntimeEvent(funnelViewMarker)) {
        markRuntimeEventTracked(funnelViewMarker);
        void emitPublicRuntimeEvent({
          eventName: "funnel_viewed",
          publicationId: runtime.publication.id,
          stepId: runtime.currentStep.id,
          anonymousId,
          visitorId: submissionContext?.visitorId ?? null,
          leadId: submissionContext?.leadId ?? null,
          assignmentId: submissionContext?.assignment?.id ?? null,
          currentPath: runtime.request.path,
          metadata: sharedMetadata,
        });
      }

      const stepViewMarker = [
        "step_viewed",
        runtime.publication.id,
        runtime.currentStep.id,
        runtime.request.path,
      ].join(":");

      if (!hasTrackedRuntimeEvent(stepViewMarker)) {
        markRuntimeEventTracked(stepViewMarker);
        void emitPublicRuntimeEvent({
          eventName: "step_viewed",
          publicationId: runtime.publication.id,
          stepId: runtime.currentStep.id,
          anonymousId,
          visitorId: submissionContext?.visitorId ?? null,
          leadId: submissionContext?.leadId ?? null,
          assignmentId: submissionContext?.assignment?.id ?? null,
          currentPath: runtime.request.path,
          metadata: sharedMetadata,
        });
      }
    };

    void trackStep();

    return () => {
      isCancelled = true;
    };
  }, [previewHost, runtime]);

  return null;
}
