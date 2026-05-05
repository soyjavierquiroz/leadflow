"use client";

import Image from "next/image";
import { useMemo } from "react";
import {
  RichHeadline,
  PublicSectionSurface,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";
import { useSubmissionContext } from "@/lib/public-funnel-session";
import { buildWhatsappUrl, normalizeWhatsappPhone } from "@/lib/public-handoff";

type AssignedSponsorRevealProps = {
  isBoxed?: boolean;
  runtime: PublicFunnelRuntimePayload;
  title?: string;
  subtitlePrefix?: string;
};

const DEFAULT_ADVISOR_PHOTO = "/assets/default-advisor.svg";
const DEFAULT_TITLE = "¡Felicidades! Te has registrado con éxito";
const DEFAULT_SUBTITLE_PREFIX = "Tu asesor asignado es: {{advisorName}}";

export function AssignedSponsorReveal({
  isBoxed = false,
  runtime,
  title,
  subtitlePrefix,
}: AssignedSponsorRevealProps) {
  const context = useSubmissionContext(runtime.publication.id);

  const advisor = useMemo(() => {
    const contextSponsor = context?.lastAssignment?.sponsor;
    if (contextSponsor) {
      return {
        name: contextSponsor.displayName,
        role: null,
        phone: contextSponsor.phone,
        photoUrl: contextSponsor.avatarUrl,
        bio: null,
        whatsappUrl: buildWhatsappUrl(
          normalizeWhatsappPhone(contextSponsor.phone),
          context?.handoff?.whatsappMessage ?? null,
        ),
      };
    }

    return null;
  }, [context]);

  const renderText = (rawText: string | undefined) => {
    if (!rawText) return "";
    return rawText.replace(/\{\{\s*advisorName\s*\}\}/g, advisor?.name || "");
  };

  return (
    <PublicSectionSurface isBoxed={isBoxed} tone="warm" className="min-h-0">
      <div className="mx-auto flex min-h-0 max-w-2xl flex-col items-center justify-center gap-4 text-center">
        <div className="shrink-0">
          <h2 className="font-headline text-4xl font-black leading-[0.95] tracking-tighter [color:var(--theme-text-strong)] [font-family:var(--font-header)] md:text-5xl">
            <RichHeadline text={renderText(title || DEFAULT_TITLE)} />
          </h2>
          <p className="mt-3 text-xl font-medium leading-snug [color:var(--theme-text-muted)] [font-family:var(--font-body)]">
            {renderText(subtitlePrefix || DEFAULT_SUBTITLE_PREFIX)}
          </p>
        </div>
        <a
          href={advisor?.whatsappUrl ?? undefined}
          aria-disabled={!advisor?.whatsappUrl}
          className="relative aspect-square w-full max-w-[min(78vw,40vh,22rem)] max-h-[40vh] shrink overflow-hidden rounded-theme border bg-[var(--theme-base-surface)] shadow-[var(--theme-surface-section-shadow)] [border-color:var(--theme-base-divider)] md:max-w-[min(24rem,40vh)]"
        >
          <Image
            src={advisor?.photoUrl || DEFAULT_ADVISOR_PHOTO}
            alt={advisor?.name || "Asesor"}
            fill
            sizes="(min-width: 768px) 384px, min(78vw, 352px)"
            className="object-cover"
          />
        </a>
      </div>
    </PublicSectionSurface>
  );
}
