"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";
import { normalizeWhatsappPhone } from "@/lib/public-handoff";
import { readSubmissionContext } from "@/lib/public-funnel-session";

type ConversionAdvisor = {
  name: string;
  phone: string | null;
  photoUrl: string | null;
  bio: string | null;
  whatsappUrl: string | null;
};

type ConversionPageProps = {
  runtime: PublicFunnelRuntimePayload;
  headline: string;
  subheadline?: string;
  ctaText?: string;
  whatsappMessage?: string;
  redirectDelay?: number | null;
  fallbackAdvisor: ConversionAdvisor;
};

const DEFAULT_ADVISOR_PHOTO = "/assets/default-advisor.svg";
const ADVISOR_NAME_TOKEN_REGEX = /\[\s*NOMBRE\s*\]/gi;
const ADVISOR_HANDLEBAR_REGEX = /\{\{\s*advisorName\s*\}\}/gi;
const MOBILE_DEVICE_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

const getFirstName = (value: string | null | undefined) =>
  value?.trim().split(/\s+/)[0] ?? "tu asesor";

const withAdvisorName = (value: string | undefined, advisorName: string) => {
  if (!value) {
    return "";
  }

  return value
    .replace(ADVISOR_NAME_TOKEN_REGEX, advisorName)
    .replace(ADVISOR_HANDLEBAR_REGEX, advisorName);
};

const normalizeAdvisorPhotoUrl = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  return value === "/assets/default-advisor.png"
    ? DEFAULT_ADVISOR_PHOTO
    : value;
};

const isValidRedirectUrl = (value: string | null | undefined) => {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const getRedirectCountdownSeconds = (delayMs: number) =>
  Math.max(0, Math.ceil(Math.max(0, delayMs) / 1000));

const isMobileDevice = (userAgent: string) =>
  MOBILE_DEVICE_REGEX.test(userAgent);

const buildDeviceAwareWhatsappUrl = ({
  phone,
  message,
  isMobile,
  fallbackUrl,
}: {
  phone: string | null;
  message: string;
  isMobile: boolean | null;
  fallbackUrl: string | null;
}) => {
  if (phone) {
    if (isMobile === null) {
      return null;
    }

    const encodedText = message ? encodeURIComponent(message) : null;
    const baseUrl = isMobile
      ? `https://wa.me/${phone}`
      : "https://web.whatsapp.com/send";

    if (isMobile) {
      return encodedText ? `${baseUrl}?text=${encodedText}` : baseUrl;
    }

    return encodedText
      ? `${baseUrl}?phone=${phone}&text=${encodedText}`
      : `${baseUrl}?phone=${phone}`;
  }

  return isValidRedirectUrl(fallbackUrl) ? fallbackUrl : null;
};

const readAdvisorFromSearchParams = (
  searchParams: ReturnType<typeof useSearchParams>,
) => {
  const name = searchParams.get("advisor_name") ?? searchParams.get("advisor");
  const phone = searchParams.get("advisor_phone");
  const photoUrl = searchParams.get("advisor_photo");
  const bio = searchParams.get("advisor_bio");
  const whatsappUrl = searchParams.get("advisor_whatsapp");

  if (!name && !phone && !photoUrl && !bio && !whatsappUrl) {
    return null;
  }

  return {
    name: name?.trim() || "",
    phone: phone?.trim() || null,
    photoUrl: normalizeAdvisorPhotoUrl(photoUrl?.trim() || null),
    bio: bio?.trim() || null,
    whatsappUrl: whatsappUrl?.trim() || null,
  };
};

function AdvisorAvatar({
  name,
  photoUrl,
}: Pick<ConversionAdvisor, "name" | "photoUrl">) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [photoUrl]);

  const resolvedPhotoUrl = !hasImageError ? photoUrl : null;

  return (
    <div className="relative flex h-32 w-32 items-center justify-center md:h-44 md:w-44">
      <span className="absolute inset-0 rounded-full bg-emerald-400/15 blur-2xl" />
      <span className="absolute inset-2 rounded-full border border-emerald-300/40 animate-pulse" />
      <div className="relative h-full w-full overflow-hidden rounded-full border border-white/80 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(220,252,231,0.96)_55%,_rgba(52,211,153,0.32)_100%)] p-2 shadow-2xl ring-4 ring-emerald-400/35">
        <div className="relative h-full w-full overflow-hidden rounded-full border border-emerald-100/80 bg-emerald-50">
          {resolvedPhotoUrl ? (
            <Image
              src={resolvedPhotoUrl}
              alt={`Foto de ${name}`}
              fill
              sizes="(min-width: 768px) 176px, 160px"
              className="object-cover object-center scale-[1.03]"
              onError={() => setHasImageError(true)}
            />
          ) : (
            <Image
              src={DEFAULT_ADVISOR_PHOTO}
              alt={`Avatar genérico de ${name}`}
              fill
              sizes="(min-width: 768px) 176px, 160px"
              className="object-cover p-2"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function ConversionPage({
  runtime,
  headline,
  subheadline,
  ctaText,
  whatsappMessage: configuredWhatsappMessage,
  redirectDelay,
  fallbackAdvisor,
}: ConversionPageProps) {
  const searchParams = useSearchParams();
  const redirectHandledRef = useRef(false);
  const [isMobileWhatsappDevice, setIsMobileWhatsappDevice] = useState<
    boolean | null
  >(null);
  const context = useMemo(
    () => readSubmissionContext(runtime.publication.id),
    [runtime.publication.id],
  );
  const queryAdvisor = useMemo(
    () => readAdvisorFromSearchParams(searchParams),
    [searchParams],
  );

  const advisor = useMemo<ConversionAdvisor>(() => {
    const handoffSponsor = context?.handoff?.sponsor ?? null;
    const assignedSponsor = context?.assignment?.sponsor ?? null;
    const resolvedSponsor = handoffSponsor ?? assignedSponsor;

    if (queryAdvisor) {
      return {
        name: queryAdvisor.name || fallbackAdvisor.name,
        phone: queryAdvisor.phone ?? fallbackAdvisor.phone,
        photoUrl:
          queryAdvisor.photoUrl ??
          normalizeAdvisorPhotoUrl(fallbackAdvisor.photoUrl),
        bio: queryAdvisor.bio ?? fallbackAdvisor.bio,
        whatsappUrl: queryAdvisor.whatsappUrl ?? fallbackAdvisor.whatsappUrl,
      };
    }

    if (context?.advisor) {
      return {
        name: context.advisor.name,
        phone: context.advisor.phone,
        photoUrl: normalizeAdvisorPhotoUrl(context.advisor.photoUrl),
        bio: context.advisor.bio,
        whatsappUrl: context.advisor.whatsappUrl,
      };
    }

    if (resolvedSponsor) {
      return {
        name: resolvedSponsor.displayName,
        phone: resolvedSponsor.phone,
        photoUrl: normalizeAdvisorPhotoUrl(resolvedSponsor.avatarUrl),
        bio:
          fallbackAdvisor.bio ?? "Especialista en Protocolos de Recuperación",
        whatsappUrl:
          context?.handoff?.whatsappUrl ?? fallbackAdvisor.whatsappUrl,
      };
    }

    return {
      ...fallbackAdvisor,
      photoUrl: normalizeAdvisorPhotoUrl(fallbackAdvisor.photoUrl),
    };
  }, [context, fallbackAdvisor, queryAdvisor]);

  const handoffMode = context?.handoff?.mode ?? runtime.handoff.mode;
  const handoffButtonLabel =
    context?.handoff?.buttonLabel ?? runtime.handoff.buttonLabel;
  const configuredRedirectDelayMs =
    typeof redirectDelay === "number" ? Math.max(0, redirectDelay) : null;
  const forceAutoRedirectFromContent =
    configuredRedirectDelayMs !== null && configuredRedirectDelayMs > 0;
  const redirectDelayMs = Math.max(
    0,
    (forceAutoRedirectFromContent ? configuredRedirectDelayMs : null) ??
      context?.handoff?.autoRedirectDelayMs ??
      runtime.handoff.autoRedirectDelayMs ??
      0,
  );
  const advisorFirstName = getFirstName(advisor.name);
  const resolvedWhatsappMessage = withAdvisorName(
    configuredWhatsappMessage ??
      context?.handoff?.whatsappMessage ??
      runtime.handoff.messageTemplate ??
      undefined,
    advisorFirstName,
  );
  const resolvedHeadline =
    withAdvisorName(headline, advisorFirstName) ||
    "Tu asesor experto ha sido asignado";
  const resolvedSubheadline =
    withAdvisorName(subheadline, advisorFirstName) ||
    "Tu asesor asignado revisará personalmente tu caso antes de continuar contigo por WhatsApp.";
  const resolvedCtaText =
    withAdvisorName(ctaText, advisorFirstName) ||
    withAdvisorName(handoffButtonLabel ?? undefined, advisorFirstName) ||
    (advisor.name && advisor.name !== fallbackAdvisor.name
      ? `CHAT DIRECTO CON ${advisorFirstName.toUpperCase()} 👉`
      : "HABLAR CON MI ASESOR AHORA");
  const normalizedWhatsappPhone =
    context?.handoff?.whatsappPhone ?? normalizeWhatsappPhone(advisor.phone);
  const directWhatsappUrl =
    context?.handoff?.whatsappUrl ?? advisor.whatsappUrl;
  const whatsappUrl = useMemo(
    () =>
      buildDeviceAwareWhatsappUrl({
        phone: normalizedWhatsappPhone,
        message: resolvedWhatsappMessage,
        isMobile: isMobileWhatsappDevice,
        fallbackUrl: directWhatsappUrl,
      }),
    [
      directWhatsappUrl,
      isMobileWhatsappDevice,
      normalizedWhatsappPhone,
      resolvedWhatsappMessage,
    ],
  );
  const autoRedirectRequested =
    forceAutoRedirectFromContent ||
    (handoffMode === "immediate_whatsapp" &&
      (context?.handoff?.autoRedirect ?? runtime.handoff.autoRedirect));
  const shouldAutoRedirect = autoRedirectRequested && Boolean(whatsappUrl);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      setIsMobileWhatsappDevice(false);
      return;
    }

    setIsMobileWhatsappDevice(isMobileDevice(navigator.userAgent));
  }, []);

  const handleManualWhatsappClick = useCallback(() => {
    redirectHandledRef.current = true;
  }, []);

  useEffect(() => {
    if (
      !autoRedirectRequested ||
      whatsappUrl ||
      (normalizedWhatsappPhone && isMobileWhatsappDevice === null)
    ) {
      return;
    }

    console.warn(
      "[ConversionPage] Auto-redirect skipped because there is no valid WhatsApp destination.",
      {
        advisorPhone: advisor.phone,
        fallbackAdvisorPhone: fallbackAdvisor.phone,
        directWhatsappUrl,
      },
    );
  }, [
    advisor.phone,
    autoRedirectRequested,
    directWhatsappUrl,
    fallbackAdvisor.phone,
    isMobileWhatsappDevice,
    normalizedWhatsappPhone,
    whatsappUrl,
  ]);

  useEffect(() => {
    if (!shouldAutoRedirect || !whatsappUrl || redirectHandledRef.current) {
      setCountdownSeconds(null);
      return;
    }

    if (redirectDelayMs === 0) {
      setCountdownSeconds(0);
      return;
    }

    const redirectAt = Date.now() + redirectDelayMs;
    setCountdownSeconds(getRedirectCountdownSeconds(redirectDelayMs));
    const interval = window.setInterval(() => {
      setCountdownSeconds(getRedirectCountdownSeconds(redirectAt - Date.now()));
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    redirectDelayMs,
    shouldAutoRedirect,
    whatsappUrl,
  ]);

  useEffect(() => {
    if (
      !shouldAutoRedirect ||
      !whatsappUrl ||
      redirectHandledRef.current ||
      countdownSeconds !== 0
    ) {
      return;
    }

    redirectHandledRef.current = true;
    window.location.href = whatsappUrl;
  }, [countdownSeconds, shouldAutoRedirect, whatsappUrl]);

  return (
    <section className="w-full">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl items-center justify-center px-4 py-4 md:px-6 md:py-6">
        <div className="w-full rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_32px_80px_rgba(15,23,42,0.12)] md:p-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700">
              Especialista Asignado
            </span>

            <h1 className="mt-4 text-[1.75rem] font-black leading-tight tracking-tight text-slate-950 md:mt-5 md:text-5xl">
              {resolvedHeadline}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 md:mt-4 md:text-lg md:leading-7">
              {resolvedSubheadline}
            </p>
          </div>

          <div className="mx-auto mt-6 max-w-xl rounded-[2rem] border border-emerald-100 bg-slate-50/80 p-5 md:mt-7 md:p-6">
            <div className="flex flex-col items-center text-center">
              <AdvisorAvatar name={advisor.name} photoUrl={advisor.photoUrl} />

              <span className="mt-4 text-xs font-bold uppercase tracking-[0.28em] text-emerald-700">
                Especialista Asignado
              </span>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                {advisor.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {advisor.bio || "Especialista en Protocolos de Recuperación"}
              </p>
            </div>

            <div className="mt-6">
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  onClick={handleManualWhatsappClick}
                  className="inline-flex min-h-16 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 py-4 text-center text-lg font-black uppercase tracking-tight text-white shadow-[0_18px_44px_rgba(5,150,105,0.28)] transition hover:bg-emerald-500"
                >
                  {resolvedCtaText}
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex min-h-16 w-full items-center justify-center rounded-2xl bg-slate-300 px-6 py-4 text-center text-lg font-black uppercase tracking-tight text-white shadow-none disabled:cursor-not-allowed"
                >
                  {resolvedCtaText}
                </button>
              )}
              {whatsappUrl ? (
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  {shouldAutoRedirect && countdownSeconds !== null
                    ? `Redirigiendo a WhatsApp en ${countdownSeconds}...`
                    : "Tu asesor ya quedó asignado. Usa el botón para continuar por WhatsApp."}
                </p>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  El asesor fue asignado, pero esta sesión todavía no tiene un
                  WhatsApp disponible para continuar.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
