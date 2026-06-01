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
};

const DEFAULT_HEADLINE = "Continuar por WhatsApp";
const DEFAULT_BUTTON_PREFIX = "Continuar con {{advisorName}}";
const DEFAULT_REDIRECT_TEXT =
  "{{advisorName}} te está esperando. Redirigiendo en {{seconds}}";
const DEFAULT_WHATSAPP_TEXT = "Hola soy {{leadName}}, deseo más información";

const VISIBLE_REF_REGEX = /\bref\s*:/i;

const normalizeWhatsappPhone = (value: string | null | undefined) => {
  const digits = value?.replace(/\D+/g, "") ?? "";
  return digits.startsWith("00") ? digits.slice(2) : digits;
};

const appendTrackingRef = (message: string, trackingRef: string | null) => {
  if (!trackingRef || message.includes(trackingRef) || VISIBLE_REF_REGEX.test(message)) {
    return message;
  }

  return `${message}\n\nRef: ${trackingRef}`;
};

const getAdvisorInitials = (name: string | null | undefined) => {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

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
    <div className="relative flex h-24 w-24 items-center justify-center md:h-28 md:w-28">
      <span className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl" />
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/80 bg-emerald-50 text-2xl font-black text-emerald-800 shadow-[0_18px_44px_rgba(16,185,129,0.22)] ring-4 ring-emerald-400/25">
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
        {showAdvisorAvatar && advisor ? <AdvisorAvatar advisor={advisor} /> : null}
        <div>
          <h2 className="font-headline text-4xl font-black leading-[0.95] tracking-tighter [color:var(--theme-text-strong)] [font-family:var(--font-header)] md:text-5xl">
            <RichHeadline text={renderText(headline || DEFAULT_HEADLINE)} />
          </h2>
        </div>
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
          <p className="mt-3 text-sm font-medium [color:var(--theme-text-muted)] [font-family:var(--font-body)]">
            {renderText(redirectText || DEFAULT_REDIRECT_TEXT)}
          </p>
        </div>
      </div>
    </PublicSectionSurface>
  );
}
