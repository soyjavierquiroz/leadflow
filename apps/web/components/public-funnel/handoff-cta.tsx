"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  PublicSectionSurface,
  RichHeadline,
  cx,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";
import { useSubmissionContext } from "@/lib/public-funnel-session";

type HandoffCtaProps = {
  isBoxed?: boolean;
  runtime: PublicFunnelRuntimePayload;
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

export function HandoffCta({
  isBoxed = false,
  runtime,
  headline,
  buttonPrefix,
  redirectText,
  whatsappText,
  autoRedirectSeconds = 5,
  buttonColor,
}: HandoffCtaProps) {
  const context = useSubmissionContext(runtime.publication.id, runtime);
  const redirectStartedRef = useRef(false);
  const runtimeData = runtime as any;
  const advisor = useMemo(
    () => runtimeData?.advisor ?? context?.advisor ?? null,
    [context, runtimeData],
  );
  const [countdown, setCountdown] = useState(
    Math.max(1, Math.floor(autoRedirectSeconds)),
  );

  const renderText = useCallback(
    (rawText: string | undefined, seconds = countdown) => {
      if (!rawText) return "";
      const leadName =
        context?.leadSnapshot?.fullName?.trim() || "un nuevo lead";
      return rawText
        .replace(/\{\{\s*advisorName\s*\}\}/g, advisor?.name || "")
        .replace(/\{\{\s*leadName\s*\}\}/g, leadName)
        .replace(/\{\{\s*seconds\s*\}\}/g, String(seconds));
    },
    [advisor?.name, context?.leadSnapshot?.fullName, countdown],
  );

  const dynamicWhatsappUrl = useMemo(() => {
    const messageTemplate =
      whatsappText ||
      runtimeData?.handoff?.whatsappMessage ||
      DEFAULT_WHATSAPP_TEXT;
    const phone = normalizeWhatsappPhone(
      advisor?.phone ?? runtimeData?.handoff?.whatsappPhone,
    );
    const leadName = context?.leadSnapshot?.fullName?.trim() || "un nuevo lead";
    const message = messageTemplate
      .replace(/\{\{\s*advisorName\s*\}\}/g, advisor?.name || "")
      .replace(/\{\{\s*leadName\s*\}\}/g, leadName)
      .trim();

    if (!phone) {
      return (
        context?.handoff?.whatsappUrl ??
        runtimeData?.handoff?.whatsappUrl ??
        null
      );
    }

    return message
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/${phone}`;
  }, [
    advisor?.phone,
    context?.handoff?.whatsappUrl,
    context?.leadSnapshot?.fullName,
    advisor?.name,
    runtimeData?.handoff?.whatsappMessage,
    runtimeData?.handoff?.whatsappPhone,
    runtimeData?.handoff?.whatsappUrl,
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
