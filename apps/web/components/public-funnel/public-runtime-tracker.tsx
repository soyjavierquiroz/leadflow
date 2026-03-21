"use client";

import { useEffect } from "react";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";
import { getOrCreateAnonymousId } from "@/lib/public-funnel-session";
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
    const anonymousId = getOrCreateAnonymousId(runtime.publication.id);
    const sessionId = getOrCreateRuntimeSessionId();
    const sharedMetadata = {
      sessionId,
      previewHost: previewHost ?? null,
      stepType: runtime.currentStep.stepType,
      isConversionStep: runtime.currentStep.isConversionStep,
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
        currentPath: runtime.request.path,
        metadata: sharedMetadata,
      });
    }
  }, [previewHost, runtime]);

  return null;
}
