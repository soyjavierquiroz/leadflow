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

type HandoffCtaProps = {
  isBoxed?: boolean;
  advisor: ResolvedPublicFunnelAdvisor | null;
  leadName?: string | null;
  handoff: Pick<
    ResolvedPublicFunnelHandoffState,
    "whatsappPhone" | "whatsappMessage" | "whatsappUrl"
  >;
  headline?: string;
  buttonPrefix?: string;
  redirectText?: string;
  whatsappText?: string;
  autoRedirectSeconds?: number;
  buttonColor?: string;
};

const DEFAULT_HEADLINE = "Continuar por WhatsApp";
const DEFAULT_BUTTON_PREFIX = "Continuar con {{advisorName}}";
const DEFAULT_REDIRECT_TEXT =
  "{{advisorName}} te está esperando. Redirigiendo en {{seconds}}";
const DEFAULT_WHATSAPP_TEXT = "Hola soy {{leadName}}, deseo más información";

const normalizeWhatsappPhone = (value: string | null | undefined) => {
  const digits = value?.replace(/\D+/g, "") ?? "";
  return digits.startsWith("00") ? digits.slice(2) : digits;
};

const extractOwnershipRef = (value: string | null | undefined) =>
  value?.match(/(?:^|\n)Ref:\s*(lf_own_[A-Za-z0-9_-]+)/)?.[1] ?? null;

const appendOwnershipRef = (message: string, ownershipRef: string | null) => {
  if (!ownershipRef || message.includes(ownershipRef)) {
    return message;
  }

  return `${message}\n\nRef: ${ownershipRef}`;
};

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
}: HandoffCtaProps) {
  const redirectStartedRef = useRef(false);
  const [countdown, setCountdown] = useState(
    Math.max(1, Math.floor(autoRedirectSeconds)),
  );

  const renderText = useCallback(
    (rawText: string | undefined, seconds = countdown) => {
      if (!rawText) return "";
      return rawText
        .replace(/\{\{\s*advisorName\s*\}\}/g, advisor?.name || "")
        .replace(/\{\{\s*leadName\s*\}\}/g, leadName?.trim() || "un nuevo lead")
        .replace(/\{\{\s*seconds\s*\}\}/g, String(seconds));
    },
    [advisor?.name, leadName, countdown],
  );

  const dynamicWhatsappUrl = useMemo(() => {
    const messageTemplate =
      whatsappText || handoff.whatsappMessage || DEFAULT_WHATSAPP_TEXT;
    const phone = normalizeWhatsappPhone(
      handoff.whatsappPhone ?? advisor?.phone,
    );
    const resolvedLeadName = leadName?.trim() || "un nuevo lead";
    const ownershipRef = extractOwnershipRef(handoff.whatsappMessage);
    const message = appendOwnershipRef(
      messageTemplate
        .replace(/\{\{\s*advisorName\s*\}\}/g, advisor?.name || "")
        .replace(/\{\{\s*leadName\s*\}\}/g, resolvedLeadName)
        .trim(),
      ownershipRef,
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
    leadName,
    whatsappText,
  ]);

  useEffect(() => {
    redirectStartedRef.current = false;
    setCountdown(Math.max(1, Math.floor(autoRedirectSeconds)));
  }, [autoRedirectSeconds, dynamicWhatsappUrl]);

  useEffect(() => {
    if (!dynamicWhatsappUrl || countdown <= 0 || redirectStartedRef.current) {
      if (countdown <= 0 && dynamicWhatsappUrl && !redirectStartedRef.current) {
        redirectStartedRef.current = true;
        window.location.href = dynamicWhatsappUrl;
      }
      return;
    }
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, dynamicWhatsappUrl]);

  const buttonStyle = {
    "--handoff-cta-primary": buttonColor || "var(--color-primary)",
    "--handoff-cta-hover": "var(--theme-button-primary-hover-bg)",
  } as CSSProperties;

  return (
    <PublicSectionSurface isBoxed={isBoxed} tone="success">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
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
