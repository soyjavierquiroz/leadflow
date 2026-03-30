"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";
import { buildWhatsappUrl, normalizeWhatsappPhone } from "@/lib/public-handoff";
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
  redirectDelay: number;
  fallbackAdvisor: ConversionAdvisor;
};

const DEFAULT_ADVISOR_PHOTO = "/assets/default-advisor.svg";

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

const getFirstName = (value: string | null | undefined) =>
  value?.trim().split(/\s+/)[0] ?? "tu asesor";

const withAdvisorName = (value: string | undefined, advisorName: string) => {
  if (!value) {
    return "";
  }

  return value
    .replaceAll("[NOMBRE]", advisorName)
    .replaceAll("{{advisorName}}", advisorName);
};

const normalizeAdvisorPhotoUrl = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  return value === "/assets/default-advisor.png"
    ? DEFAULT_ADVISOR_PHOTO
    : value;
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

export function ConversionPage({
  runtime,
  headline,
  subheadline,
  ctaText,
  redirectDelay,
  fallbackAdvisor,
}: ConversionPageProps) {
  const searchParams = useSearchParams();
  const redirectHandledRef = useRef(false);
  const context = useMemo(
    () => readSubmissionContext(runtime.publication.id),
    [runtime.publication.id],
  );
  const queryAdvisor = useMemo(
    () => readAdvisorFromSearchParams(searchParams),
    [searchParams],
  );

  const advisor = useMemo<ConversionAdvisor>(() => {
    if (queryAdvisor) {
      return {
        name: queryAdvisor.name || fallbackAdvisor.name,
        phone: queryAdvisor.phone ?? fallbackAdvisor.phone,
        photoUrl: queryAdvisor.photoUrl ?? normalizeAdvisorPhotoUrl(fallbackAdvisor.photoUrl),
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

    if (context?.assignment?.sponsor) {
      return {
        name: context.assignment.sponsor.displayName,
        phone: context.assignment.sponsor.phone,
        photoUrl: normalizeAdvisorPhotoUrl(fallbackAdvisor.photoUrl),
        bio:
          fallbackAdvisor.bio ?? "Especialista en Protocolos de Recuperación",
        whatsappUrl: context.handoff.whatsappUrl,
      };
    }

    return {
      ...fallbackAdvisor,
      photoUrl: normalizeAdvisorPhotoUrl(fallbackAdvisor.photoUrl),
    };
  }, [context, fallbackAdvisor, queryAdvisor]);

  const advisorFirstName = getFirstName(advisor.name);
  const resolvedHeadline =
    withAdvisorName(headline, advisorFirstName) ||
    "Tu asesor experto ha sido asignado";
  const resolvedSubheadline =
    withAdvisorName(subheadline, advisorFirstName) ||
    "Tu asesor asignado revisará personalmente tu caso antes de continuar contigo por WhatsApp.";
  const resolvedCtaText =
    advisor.name && advisor.name !== fallbackAdvisor.name
      ? withAdvisorName(ctaText, advisorFirstName) ||
        `CHAT DIRECTO CON ${advisorFirstName.toUpperCase()} 👉`
      : ctaText || "HABLAR CON MI ASESOR AHORA";
  const whatsappUrl =
    context?.handoff?.whatsappUrl ??
    advisor.whatsappUrl ??
    buildWhatsappUrl(normalizeWhatsappPhone(advisor.phone), null);

  const handleWhatsappRedirect = () => {
    if (!whatsappUrl || redirectHandledRef.current) {
      return;
    }

    redirectHandledRef.current = true;
    window.location.assign(whatsappUrl);
  };

  useEffect(() => {
    if (!whatsappUrl || redirectHandledRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (redirectHandledRef.current) {
        return;
      }

      redirectHandledRef.current = true;
      window.location.assign(whatsappUrl);
    }, redirectDelay);

    return () => window.clearTimeout(timeout);
  }, [redirectDelay, whatsappUrl]);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 md:px-6 md:py-14">
      <div className="w-full rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-[0_32px_80px_rgba(15,23,42,0.12)] md:p-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700">
            Especialista Asignado
          </span>

          <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
            {resolvedHeadline}
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">
            {resolvedSubheadline}
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-xl rounded-[2rem] border border-emerald-100 bg-slate-50/80 p-6">
          <div className="flex flex-col items-center text-center">
            {advisor.photoUrl ? (
              // External advisor photos can come from runtime/API URLs that are not preconfigured for next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={advisor.photoUrl}
                alt={advisor.name}
                className="h-28 w-28 rounded-full border-4 border-emerald-400 object-cover shadow-[0_16px_40px_rgba(16,185,129,0.18)]"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-emerald-400 bg-slate-900 text-3xl font-black text-white shadow-[0_16px_40px_rgba(16,185,129,0.18)]">
                {getInitials(advisor.name)}
              </div>
            )}

            <span className="mt-5 text-xs font-bold uppercase tracking-[0.28em] text-emerald-700">
              Especialista Asignado
            </span>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              {advisor.name}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {advisor.bio || "Especialista en Protocolos de Recuperación"}
            </p>
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={handleWhatsappRedirect}
              className="inline-flex min-h-16 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 py-4 text-center text-lg font-black uppercase tracking-tight text-white shadow-[0_18px_44px_rgba(5,150,105,0.28)] transition hover:bg-emerald-500"
            >
              {resolvedCtaText}
            </button>
            <p className="mt-4 text-xs text-slate-500">
              Serás redirigido automáticamente a WhatsApp en{" "}
              {Math.max(1, Math.round(redirectDelay / 1000))} segundos.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
