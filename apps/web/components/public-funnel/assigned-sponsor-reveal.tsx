"use client";

import Image from "next/image";
import {
  RichHeadline,
  PublicSectionSurface,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import type { ResolvedPublicFunnelAdvisor } from "@/lib/public-funnel-assigned-sponsor";

type AssignedSponsorRevealProps = {
  isBoxed?: boolean;
  advisor: ResolvedPublicFunnelAdvisor | null;
  title?: string;
  subtitlePrefix?: string;
};

const DEFAULT_ADVISOR_PHOTO = "/assets/default-advisor.svg";
const DEFAULT_TITLE = "¡Felicidades! Te has registrado con éxito";
const DEFAULT_SUBTITLE_PREFIX = "Tu asesor asignado es: {{advisorName}}";

export function AssignedSponsorReveal({
  isBoxed = false,
  advisor,
  title,
  subtitlePrefix,
}: AssignedSponsorRevealProps) {
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
