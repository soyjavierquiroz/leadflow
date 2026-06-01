"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  PublicSectionSurface,
  RichHeadline,
  cx,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import type {
  ResolvedPublicFunnelAdvisor,
  ResolvedPublicFunnelHandoffState,
} from "@/lib/public-funnel-assigned-sponsor";
import {
  renderPublicHandoffTemplate,
  resolvePublicHandoffTrackingRef,
} from "@/lib/public-handoff";

type HandoffCtaProps = {
  isBoxed?: boolean;
  advisor: ResolvedPublicFunnelAdvisor | null;
  leadName?: string | null;
  handoff: Pick<
    ResolvedPublicFunnelHandoffState,
    | "whatsappPhone"
    | "whatsappMessage"
    | "whatsappUrl"
    | "leadId"
    | "assignmentId"
    | "ownershipKey"
    | "ownershipRef"
    | "trackingRef"
  >;
  headline?: string;
  buttonPrefix?: string;
  redirectText?: string;
  whatsappText?: string;
  autoRedirectSeconds?: number;
  buttonColor?: string;
  showAdvisorAvatar?: boolean;
  eyebrow?: string;
  subheadline?: string;
  advisorIntro?: string;
  refLabel?: string;
  trustNote?: string;
};

const DEFAULT_HEADLINE = "Continuar por WhatsApp";
const DEFAULT_BUTTON_PREFIX = "Continuar con {{advisorName}}";
const DEFAULT_REDIRECT_TEXT =
  "{{advisorName}} te está esperando. Redirigiendo en {{seconds}}";
const DEFAULT_WHATSAPP_TEXT = "Hola soy {{leadName}}, deseo más información";
const DEFAULT_EYEBROW = "ASESOR ASIGNADO";
const DEFAULT_SUBHEADLINE =
  "{{advisorName}} ya recibió tu solicitud y te ayudará a dar el siguiente paso por WhatsApp.";
const DEFAULT_ADVISOR_INTRO = "Tu asesor asignado";
const DEFAULT_REF_LABEL = "Código de seguimiento";
const DEFAULT_TRUST_NOTE =
  "Usa este código para que tu asesor identifique tu registro rápido.";
const MANUAL_SUPPORT_TEXT = "Toca el botón para continuar por WhatsApp.";

const VISIBLE_REF_REGEX = /\bref\s*:/i;

const normalizeWhatsappPhone = (value: string | null | undefined) => {
  const digits = value?.replace(/\D+/g, "") ?? "";
  return digits.startsWith("00") ? digits.slice(2) : digits;
};

const appendTrackingRef = (message: string, trackingRef: string | null) => {
  if (
    !trackingRef ||
    message.includes(trackingRef) ||
    VISIBLE_REF_REGEX.test(message)
  ) {
    return message;
  }

  return `${message}\n\nRef: ${trackingRef}`;
};

const getAdvisorInitials = (name: string | null | undefined) => {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "?";
};

function AdvisorAvatar({
  advisor,
}: {
  advisor: ResolvedPublicFunnelAdvisor;
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const photoUrl = advisor.photoUrl?.trim() || null;
  const shouldShowImage = Boolean(photoUrl && !hasImageError);

  useEffect(() => {
    setHasImageError(false);
  }, [photoUrl]);

  return (
    <div className="relative flex h-32 w-32 items-center justify-center md:h-36 md:w-36">
      <span className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl" />
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/80 bg-emerald-50 text-4xl font-black text-emerald-800 shadow-[0_18px_44px_rgba(16,185,129,0.22)] ring-4 ring-emerald-400/25">
        {shouldShowImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl ?? ""}
            alt={`Foto de ${advisor.name}`}
            className="h-full w-full object-cover object-center"
            onError={() => setHasImageError(true)}
          />
        ) : (
          <span aria-label={`Iniciales de ${advisor.name}`}>
            {getAdvisorInitials(advisor.name)}
          </span>
        )}
      </div>
    </div>
  );
}

export function HandoffCta({
  isBoxed = false,
  advisor,
  leadName,
  handoff,
  headline,
  buttonPrefix,
  redirectText,
  whatsappText,
  autoRedirectSeconds = 5,
  buttonColor,
  showAdvisorAvatar = true,
  eyebrow,
  subheadline,
  advisorIntro,
  refLabel,
  trustNote,
}: HandoffCtaProps) {
  const redirectStartedRef = useRef(false);
  const [countdown, setCountdown] = useState(
    Math.max(0, Math.floor(autoRedirectSeconds)),
  );

  const renderText = useCallback(
    (rawText: string | undefined, seconds = countdown) => {
      if (!rawText) return "";
      return renderPublicHandoffTemplate({
        template: rawText,
        advisorName: advisor?.name,
        leadName,
        leadId: handoff.leadId,
        assignmentId: handoff.assignmentId,
        ownershipKey: handoff.ownershipKey,
        ownershipRef: handoff.ownershipRef,
        trackingRef: handoff.trackingRef,
        fallbackMessage: handoff.whatsappMessage,
        seconds,
      });
    },
    [
      advisor?.name,
      countdown,
      handoff.assignmentId,
      handoff.leadId,
      handoff.ownershipKey,
      handoff.ownershipRef,
      handoff.trackingRef,
      handoff.whatsappMessage,
      leadName,
    ],
  );

  const dynamicWhatsappUrl = useMemo(() => {
    const messageTemplate =
      whatsappText || handoff.whatsappMessage || DEFAULT_WHATSAPP_TEXT;
    const phone = normalizeWhatsappPhone(
      handoff.whatsappPhone ?? advisor?.phone,
    );
    const trackingRef = resolvePublicHandoffTrackingRef({
      ownershipKey: handoff.ownershipKey,
      ownershipRef: handoff.ownershipRef,
      trackingRef: handoff.trackingRef,
      fallbackMessage: handoff.whatsappMessage,
    });
    const message = appendTrackingRef(
      renderPublicHandoffTemplate({
        template: messageTemplate,
        advisorName: advisor?.name,
        leadName,
        leadId: handoff.leadId,
        assignmentId: handoff.assignmentId,
        ownershipKey: handoff.ownershipKey,
        ownershipRef: handoff.ownershipRef,
        trackingRef: handoff.trackingRef,
        fallbackMessage: handoff.whatsappMessage,
      }).trim(),
      trackingRef,
    );

    if (!phone) {
      return handoff.whatsappUrl ?? null;
    }

    return message
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/${phone}`;
  }, [
    advisor?.name,
    advisor?.phone,
    handoff.whatsappMessage,
    handoff.whatsappPhone,
    handoff.whatsappUrl,
    handoff.leadId,
    handoff.assignmentId,
    handoff.ownershipKey,
    handoff.ownershipRef,
    handoff.trackingRef,
    leadName,
    whatsappText,
  ]);
  const trackingRef = useMemo(
    () =>
      resolvePublicHandoffTrackingRef({
        ownershipKey: handoff.ownershipKey,
        ownershipRef: handoff.ownershipRef,
        trackingRef: handoff.trackingRef,
        fallbackMessage: handoff.whatsappMessage,
      }),
    [
      handoff.ownershipKey,
      handoff.ownershipRef,
      handoff.trackingRef,
      handoff.whatsappMessage,
    ],
  );
  const shouldShowCountdown = autoRedirectSeconds > 0;
  const countdownText = renderText(redirectText || DEFAULT_REDIRECT_TEXT);
  const supportText = shouldShowCountdown ? countdownText : MANUAL_SUPPORT_TEXT;
  const resolvedAdvisorName = advisor?.name?.trim() || "";

  useEffect(() => {
    redirectStartedRef.current = false;
    setCountdown(Math.max(0, Math.floor(autoRedirectSeconds)));
  }, [autoRedirectSeconds, dynamicWhatsappUrl]);

  useEffect(() => {
    if (!dynamicWhatsappUrl || autoRedirectSeconds <= 0) {
      return;
    }

    if (countdown <= 0 || redirectStartedRef.current) {
      if (countdown <= 0 && dynamicWhatsappUrl && !redirectStartedRef.current) {
        redirectStartedRef.current = true;
        window.location.href = dynamicWhatsappUrl;
      }
      return;
    }
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [autoRedirectSeconds, countdown, dynamicWhatsappUrl]);

  const buttonStyle = {
    "--handoff-cta-primary": buttonColor || "var(--color-primary)",
    "--handoff-cta-hover": "var(--theme-button-primary-hover-bg)",
  } as CSSProperties;

  return (
    <PublicSectionSurface isBoxed={isBoxed} tone="success">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <span className="inline-flex rounded-full border border-emerald-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700 shadow-sm">
          {renderText(eyebrow || DEFAULT_EYEBROW)}
        </span>
        {showAdvisorAvatar && advisor ? <AdvisorAvatar advisor={advisor} /> : null}
        {advisor ? (
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {renderText(advisorIntro || DEFAULT_ADVISOR_INTRO)}
            </p>
            <p className="text-2xl font-black leading-tight text-slate-950 md:text-3xl">
              {resolvedAdvisorName || "Tu asesor"}
            </p>
          </div>
        ) : null}
        <div className="space-y-4">
          <h2 className="font-headline text-4xl font-black leading-[0.95] tracking-tighter [color:var(--theme-text-strong)] [font-family:var(--font-header)] md:text-5xl">
            <RichHeadline text={renderText(headline || DEFAULT_HEADLINE)} />
          </h2>
          <p className="mx-auto max-w-xl text-base font-medium leading-7 text-slate-700 [font-family:var(--font-body)] md:text-lg">
            {renderText(subheadline || DEFAULT_SUBHEADLINE)}
          </p>
        </div>
        {trackingRef ? (
          <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-emerald-50/80 px-5 py-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
              {renderText(refLabel || DEFAULT_REF_LABEL)}
            </p>
            <p className="mt-1 font-mono text-2xl font-black tracking-[0.12em] text-slate-950">
              {trackingRef}
            </p>
            <p className="mt-2 text-xs font-medium leading-5 text-slate-600">
              {renderText(trustNote || DEFAULT_TRUST_NOTE)}
            </p>
          </div>
        ) : null}
        <div className="w-full max-w-xl">
          <a
            href={dynamicWhatsappUrl || "#"}
            className={cx(
              "font-button inline-flex min-h-[var(--theme-button-primary-min-height)] w-full items-center justify-center border px-[var(--theme-button-primary-padding-x)] py-[var(--theme-button-primary-padding-y)] text-center no-underline transition-all",
              "rounded-theme [background:linear-gradient(135deg,var(--handoff-cta-primary),var(--handoff-cta-hover))] [border-color:var(--handoff-cta-primary)] [box-shadow:0_18px_44px_color-mix(in_srgb,var(--handoff-cta-primary)_40%,transparent)]",
              "[color:var(--theme-button-primary-rest-text-color)] [font-family:var(--theme-button-primary-rest-font-family)] [font-size:var(--theme-button-primary-rest-font-size)] [font-weight:var(--theme-button-primary-rest-font-weight)] [letter-spacing:var(--theme-button-primary-rest-letter-spacing)] [line-height:var(--theme-button-primary-rest-line-height)] [text-transform:var(--theme-button-primary-rest-text-transform)]",
              "hover:scale-[1.02] hover:[background:linear-gradient(135deg,var(--handoff-cta-hover),var(--handoff-cta-primary))] focus-visible:outline focus-visible:outline-[var(--theme-button-primary-border-width)] focus-visible:outline-[var(--theme-button-primary-outline-color)] focus-visible:[outline-offset:var(--theme-button-primary-outline-offset)]",
            )}
            style={buttonStyle}
          >
            {renderText(buttonPrefix || DEFAULT_BUTTON_PREFIX)}
          </a>
          {shouldShowCountdown ? (
            <div
              aria-live="polite"
              className="mt-4 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-base font-black text-emerald-800 shadow-sm [font-family:var(--font-body)]"
            >
              {supportText}
            </div>
          ) : (
            <p className="mt-4 text-sm font-semibold text-slate-600 [font-family:var(--font-body)]">
              {supportText}
            </p>
          )}
        </div>
      </div>
    </PublicSectionSurface>
  );
}
