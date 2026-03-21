"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
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
    <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-8 shadow-[0_18px_50px_rgba(245,158,11,0.12)]">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
          {description}
        </p>
      ) : null}
      <div className="mt-6 rounded-2xl border border-amber-200 bg-white p-5">
        {assignment && sponsor ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-700">
                  Sponsor asignado
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">
                  {sponsor.displayName}
                </p>
              </div>
              <span className="rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-800">
                {handoffMode === "immediate_whatsapp"
                  ? "WhatsApp inmediato"
                  : "Thank you + WhatsApp"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Estado
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {assignment.status}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Email
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {sponsor.email ?? "Sin email"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  WhatsApp
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {sponsor.phone ?? "Sin telefono"}
                </p>
              </div>
            </div>
            {whatsappUrl ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm leading-6 text-emerald-950">
                  {handoffMode === "immediate_whatsapp"
                    ? "Vamos a abrir WhatsApp automaticamente para continuar con tu sponsor asignado."
                    : "Tu sponsor ya esta listo para continuar contigo por WhatsApp."}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a
                    href={whatsappUrl}
                    className="inline-flex items-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    onClick={handleWhatsappClick}
                  >
                    {handoffButtonLabel}
                  </a>
                  <p className="text-sm text-emerald-900">
                    {runtime.handoff.autoRedirect &&
                    handoffMode === "immediate_whatsapp"
                      ? "Redirigiendo ahora..."
                      : "Si no se abre automaticamente, usa el boton."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm leading-6 text-slate-700">
                  El sponsor fue asignado correctamente, pero todavia no tenemos
                  un numero de WhatsApp disponible para continuar el handoff en
                  esta sesion.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-700">
              Todavia no hay un sponsor asignado en esta sesion.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Completa el formulario del funnel para resolver el assignment y
              ver aqui el reveal con el CTA de handoff.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
