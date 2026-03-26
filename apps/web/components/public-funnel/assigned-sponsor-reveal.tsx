"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { StatusBadge } from "@/components/app-shell/status-badge";
import {
  buildCtaClassName,
  PublicChecklistItem,
  PublicEyebrow,
  PublicPill,
  PublicSectionSurface,
  PublicStatCard,
  cx,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";
import { buildWhatsappUrl, normalizeWhatsappPhone } from "@/lib/public-handoff";
import { readSubmissionContext } from "@/lib/public-funnel-session";
import {
  emitPublicRuntimeEvent,
  getOrCreateRuntimeSessionId,
  hasTrackedRuntimeEvent,
  markRuntimeEventTracked,
} from "@/lib/public-runtime-tracking";

type AssignedSponsorRevealProps = {
  runtime: PublicFunnelRuntimePayload;
  title: string;
  description?: string;
};

const buildHandoffMarker = (
  eventName: "cta_clicked" | "handoff_completed",
  publicationId: string,
  stepId: string,
  assignmentId: string,
  suffix: string,
) => [eventName, publicationId, stepId, assignmentId, suffix].join(":");

const getInitials = (value: string | null | undefined) => {
  if (!value) {
    return "LF";
  }

  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() ?? "")
    .join("");
};

export function AssignedSponsorReveal({
  runtime,
  title,
  description,
}: AssignedSponsorRevealProps) {
  const autoRedirectStartedRef = useRef(false);
  const context = useMemo(
    () => readSubmissionContext(runtime.publication.id),
    [runtime.publication.id],
  );

  const assignment = context?.assignment ?? null;
  const sponsor = useMemo(() => {
    return context?.handoff?.sponsor ?? assignment?.sponsor ?? null;
  }, [assignment?.sponsor, context?.handoff?.sponsor]);
  const whatsappPhone = useMemo(() => {
    return (
      context?.handoff?.whatsappPhone ??
      normalizeWhatsappPhone(context?.handoff?.sponsor?.phone ?? sponsor?.phone)
    );
  }, [
    context?.handoff?.sponsor?.phone,
    context?.handoff?.whatsappPhone,
    sponsor?.phone,
  ]);
  const whatsappMessage = context?.handoff?.whatsappMessage ?? null;
  const whatsappUrl =
    context?.handoff?.whatsappUrl ??
    buildWhatsappUrl(whatsappPhone, whatsappMessage);
  const handoffMode = context?.handoff?.mode ?? runtime.handoff.mode;
  const handoffButtonLabel =
    context?.handoff?.buttonLabel ??
    runtime.handoff.buttonLabel ??
    "Continuar por WhatsApp";
  const redirectDelaySeconds = Math.max(
    1,
    Math.round((runtime.handoff.autoRedirectDelayMs ?? 1200) / 1000),
  );

  const trackHandoff = useCallback(
    ({
      href,
      label,
      source,
    }: {
      href: string;
      label: string;
      source: "button_click" | "auto_redirect";
    }) => {
      if (!context?.assignment) {
        return;
      }

      const ctaMarker = buildHandoffMarker(
        "cta_clicked",
        runtime.publication.id,
        runtime.currentStep.id,
        context.assignment.id,
        source,
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
          ctaLabel: label,
          ctaHref: href,
          ctaAction: "whatsapp_handoff",
          metadata: {
            sessionId: getOrCreateRuntimeSessionId(),
            handoffMode,
            handoffSource: source,
          },
        });
      }

      const completionMarker = buildHandoffMarker(
        "handoff_completed",
        runtime.publication.id,
        runtime.currentStep.id,
        context.assignment.id,
        source,
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
          ctaLabel: label,
          ctaHref: href,
          ctaAction: "whatsapp_handoff",
          metadata: {
            sessionId: getOrCreateRuntimeSessionId(),
            handoffMode,
            handoffSource: source,
          },
        });
      }
    },
    [
      context,
      handoffMode,
      runtime.currentStep.id,
      runtime.publication.id,
      runtime.request.path,
    ],
  );

  useEffect(() => {
    if (
      !context?.assignment ||
      !whatsappUrl ||
      handoffMode !== "immediate_whatsapp" ||
      !runtime.handoff.autoRedirect ||
      autoRedirectStartedRef.current
    ) {
      return;
    }

    autoRedirectStartedRef.current = true;

    const timeout = window.setTimeout(() => {
      trackHandoff({
        href: whatsappUrl,
        label: handoffButtonLabel,
        source: "auto_redirect",
      });
      window.location.assign(whatsappUrl);
    }, runtime.handoff.autoRedirectDelayMs ?? 1200);

    return () => window.clearTimeout(timeout);
  }, [
    context?.assignment,
    handoffButtonLabel,
    handoffMode,
    runtime.handoff.autoRedirect,
    runtime.handoff.autoRedirectDelayMs,
    trackHandoff,
    whatsappUrl,
  ]);

  const handleWhatsappClick = () => {
    if (!whatsappUrl) {
      return;
    }

    trackHandoff({
      href: whatsappUrl,
      label: handoffButtonLabel,
      source: "button_click",
    });
  };

  return (
    <PublicSectionSurface tone="warm">
      <div className="flex flex-wrap items-center gap-3">
        <PublicPill tone="warm">Reveal & Handoff</PublicPill>
        <PublicPill>Paso final visible</PublicPill>
      </div>

      <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
        {description ||
          "Presentamos al sponsor asignado y dejamos evidente cómo continúa la conversación, para que el cierre del funnel no se sienta técnico ni ambiguo."}
      </p>

      <div className="mt-6 rounded-[1.85rem] border border-amber-200 bg-white p-5 md:p-6">
        {assignment && sponsor ? (
          <>
            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.8rem] border border-amber-200 bg-amber-50/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-lg font-semibold text-white">
                      {getInitials(sponsor.displayName)}
                    </div>
                    <div>
                      <PublicEyebrow tone="warm">Sponsor asignado</PublicEyebrow>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {sponsor.displayName}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Tu oportunidad ya tiene owner y el siguiente paso es
                        continuar la conversación por el canal indicado.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={assignment.status} />
                    <PublicPill tone="warm">
                      {handoffMode === "immediate_whatsapp"
                        ? "WhatsApp inmediato"
                        : "Thank you + WhatsApp"}
                    </PublicPill>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <PublicStatCard
                    label="Email"
                    value={sponsor.email ?? "Sin email"}
                    description="Dato visible para continuidad operativa."
                    tone="warm"
                  />
                  <PublicStatCard
                    label="WhatsApp"
                    value={sponsor.phone ?? "Sin teléfono"}
                    description="Se usa para construir el handoff real."
                    tone="warm"
                  />
                  <PublicStatCard
                    label="Assignment"
                    value={assignment.id.slice(0, 8)}
                    description="Contexto persistido en la sesión del runtime."
                    tone="warm"
                  />
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                <PublicEyebrow tone="neutral">Qué pasa ahora</PublicEyebrow>
                <div className="mt-5 grid gap-3">
                  <PublicChecklistItem accent="warm">
                    Tu lead ya fue capturado y asociado a esta sesión.
                  </PublicChecklistItem>
                  <PublicChecklistItem accent="warm">
                    El sponsor asignado ya puede continuar la conversación.
                  </PublicChecklistItem>
                  <PublicChecklistItem accent="warm">
                    El CTA final mantiene tracking y continuidad del handoff.
                  </PublicChecklistItem>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                "Assignment resuelto y asociado a esta sesión.",
                "Sponsor visible con datos de continuidad.",
                "CTA listo para pasar a WhatsApp o fallback definido.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>

            {whatsappUrl ? (
              <div className="mt-5 rounded-[1.85rem] border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm leading-6 text-emerald-950">
                  {handoffMode === "immediate_whatsapp"
                    ? `Vamos a abrir WhatsApp automáticamente en ${redirectDelaySeconds}s para continuar con tu sponsor asignado.`
                    : "Tu sponsor ya está listo para continuar contigo por WhatsApp."}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a
                    href={whatsappUrl}
                    className={cx(
                      buildCtaClassName("primary"),
                      "bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-emerald-600",
                    )}
                    onClick={handleWhatsappClick}
                  >
                    {handoffButtonLabel}
                  </a>
                  <p className="text-sm text-emerald-900">
                    {runtime.handoff.autoRedirect &&
                    handoffMode === "immediate_whatsapp"
                        ? "Redirigiendo ahora..."
                        : "Si no se abre automáticamente, usa el botón."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm leading-6 text-slate-700">
                  El sponsor fue asignado correctamente, pero todavía no tenemos
                  un número de WhatsApp disponible para continuar el handoff en
                  esta sesión.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-700">
              Todavía no hay un sponsor asignado en esta sesión.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Completa el formulario del funnel para resolver el assignment y
              ver aquí el reveal con el CTA de handoff.
            </p>
          </div>
        )}
      </div>
    </PublicSectionSurface>
  );
}
