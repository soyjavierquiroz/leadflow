"use client";

import type {
  LeadCaptureSubmissionPayload,
  LeadCaptureSubmissionResponse,
} from "@/lib/public-funnel-session";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";

type RuntimeLeadConversionContext = {
  type: string;
  outcome?: string | null;
};

type EmitLeadCaptureConversionOptions = {
  runtime: PublicFunnelRuntimePayload;
  payload: LeadCaptureSubmissionPayload;
  response: LeadCaptureSubmissionResponse;
  block: RuntimeLeadConversionContext;
  nextStepPath?: string | null;
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const normalizeBlockType = (value: string) => value.trim().toLowerCase();

const isLeadCaptureConversionBlock = (value: string) => {
  const normalized = normalizeBlockType(value);
  return (
    normalized === "lead_capture_form" ||
    normalized === "lead_capture_config"
  );
};

export const emitLeadCaptureConversionEvent = ({
  runtime,
  payload,
  response,
  block,
  nextStepPath,
}: EmitLeadCaptureConversionOptions) => {
  if (
    typeof window === "undefined" ||
    !runtime.entryContext.browserPixelsEnabled ||
    !runtime.publication.metaPixelId ||
    !isLeadCaptureConversionBlock(block.type)
  ) {
    return;
  }

  const fbq = window.fbq;
  if (typeof fbq !== "function") {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[runtime-conversions] Meta pixel is not available; skipping Lead conversion event.",
        {
          publicationId: runtime.publication.id,
          blockType: block.type,
        },
      );
    }
    return;
  }

  const conversionMetadata = {
    content_name: runtime.funnel.name,
    content_category:
      runtime.funnel.structuralType ?? runtime.currentStep.stepType,
    content_ids: [
      runtime.funnel.id,
      runtime.publication.id,
      runtime.currentStep.id,
    ],
    funnel_id: runtime.funnel.id,
    funnel_code: runtime.funnel.code,
    publication_id: runtime.publication.id,
    step_id: runtime.currentStep.id,
    step_slug: runtime.currentStep.slug,
    step_path: runtime.currentStep.path,
    block_type: normalizeBlockType(block.type),
    block_outcome: block.outcome?.trim() || "default",
    next_step_path: nextStepPath ?? response.nextStep?.path ?? null,
    lead_id: response.lead.id,
    assignment_id: response.assignment?.id ?? null,
    source_channel: payload.sourceChannel ?? null,
    traffic_layer: runtime.entryContext.trafficLayer,
  };

  fbq(
    "track",
    "Lead",
    conversionMetadata,
    payload.submissionEventId ? { eventID: payload.submissionEventId } : undefined,
  );
};
