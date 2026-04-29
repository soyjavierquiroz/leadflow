"use client";

import { useCallback, useMemo } from "react";
import {
  buildCtaClassName,
  PublicEyebrow,
  PublicSectionSurface,
  RichHeadline,
  cx,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";
import { buildWhatsappUrl, normalizeWhatsappPhone } from "@/lib/public-handoff";
import { useSubmissionContext } from "@/lib/public-funnel-session";
import {
  emitPublicRuntimeEvent,
  getOrCreateRuntimeSessionId,
  hasTrackedRuntimeEvent,
  markRuntimeEventTracked,
} from "@/lib/public-runtime-tracking";

type HandoffCtaProps = {
  isBoxed?: boolean;
  runtime: PublicFunnelRuntimePayload;
  headline: string;
  subheadline?: string;
  buttonText?: string;
  helperText?: string;
  variant?: string;
};

const buildHandoffMarker = (
  eventName: "cta_clicked" | "handoff_completed",
  publicationId: string,
  stepId: string,
  assignmentId: string,
) => [eventName, publicationId, stepId, assignmentId, "standalone"].join(":");

export function HandoffCta({
  isBoxed = false,
  runtime,
  headline,
  subheadline,
  buttonText,
  helperText,
  variant,
}: HandoffCtaProps) {
  const context = useSubmissionContext(runtime.publication.id);
  const sponsor =
    context?.handoff?.sponsor ?? context?.assignment?.sponsor ?? null;
  const handoffPhone =
    context?.handoff?.whatsappPhone ??
    normalizeWhatsappPhone(sponsor?.phone ?? null);
  const handoffUrl =
    context?.handoff?.whatsappUrl ??
    buildWhatsappUrl(handoffPhone, context?.handoff?.whatsappMessage ?? null);
  const handoffMode = context?.handoff?.mode ?? runtime.handoff.mode;
  const handoffButtonLabel =
    buttonText ??
    context?.handoff?.buttonLabel ??
    runtime.handoff.buttonLabel ??
    "Continuar por WhatsApp";

  const trackHandoff = useCallback(() => {
    if (!context?.assignment || !handoffUrl) {
      return;
    }

    const ctaMarker = buildHandoffMarker(
      "cta_clicked",
      runtime.publication.id,
      runtime.currentStep.id,
      context.assignment.id,
    );
    if (!hasTrackedRuntimeEvent(ctaMarker)) {
      markRuntimeEventTracked(ctaMarker);
      void emitPublicRuntimeEvent({
        eventName: "cta_clicked",
        publicationId: runtime.publication.id,
        stepId: runtime.currentStep.id,
        anonymousId: context.anonymousId,
        visitorId: context.visitorId,
        leadId: context.leadId,
        assignmentId: context.assignment.id,
        currentPath: runtime.request.path,
        ctaLabel: handoffButtonLabel,
        ctaHref: handoffUrl,
        ctaAction: "whatsapp_handoff",
        metadata: {
          sessionId: getOrCreateRuntimeSessionId(),
          handoffMode,
          handoffSource: "standalone_block",
        },
      });
    }

    const completionMarker = buildHandoffMarker(
      "handoff_completed",
      runtime.publication.id,
      runtime.currentStep.id,
      context.assignment.id,
    );
    if (!hasTrackedRuntimeEvent(completionMarker)) {
      markRuntimeEventTracked(completionMarker);
      void emitPublicRuntimeEvent({
        eventName: "handoff_completed",
        publicationId: runtime.publication.id,
        stepId: runtime.currentStep.id,
        anonymousId: context.anonymousId,
        visitorId: context.visitorId,
        leadId: context.leadId,
        assignmentId: context.assignment.id,
        currentPath: runtime.request.path,
        ctaLabel: handoffButtonLabel,
        ctaHref: handoffUrl,
        ctaAction: "whatsapp_handoff",
        metadata: {
          sessionId: getOrCreateRuntimeSessionId(),
          handoffMode,
          handoffSource: "standalone_block",
        },
      });
    }
  }, [
    context,
    handoffButtonLabel,
    handoffMode,
    handoffUrl,
    runtime.currentStep.id,
    runtime.publication.id,
    runtime.request.path,
  ]);

  return (
    <PublicSectionSurface isBoxed={isBoxed} tone="success">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <PublicEyebrow tone="success">Handoff CTA</PublicEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            <RichHeadline text={headline} />
          </h2>
          <p className="font-subheadline mt-4 max-w-2xl text-base leading-7 text-slate-700">
            {subheadline ||
              "Bloque declarativo para continuar el handoff usando el contexto real de la sesión."}
          </p>
        </div>

        <div className="p-1">
          {handoffUrl && sponsor ? (
            <>
              <p className="text-sm leading-6 text-slate-700">
                Continuarás con {sponsor.displayName} por el canal definido en
                el runtime.
              </p>
              <div className="mt-5">
                <a
                  href={handoffUrl}
                  onClick={trackHandoff}
                  className={cx(
                    buildCtaClassName("primary"),
                    variant === "handoff_primary"
                      ? "bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-emerald-600"
                      : "bg-slate-950 hover:bg-slate-800 focus-visible:outline-slate-950",
                  )}
                >
                  {handoffButtonLabel}
                </a>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {helperText ||
                  "Si el canal no se abre automáticamente, este CTA mantiene el handoff visible y trazable."}
              </p>
            </>
          ) : (
            <p className="text-sm leading-6 text-slate-700">
              Todavía no hay contexto de sponsor o canal disponible en esta
              sesión.
            </p>
          )}
        </div>
      </div>
    </PublicSectionSurface>
  );
}
