import type { CSSProperties, ReactNode } from "react";

import {
  cx,
  flatBlockTitleClassName,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import type { RuntimeMediaItem } from "@/components/public-funnel/runtime-block-utils";
import { TrustAuthorityBar } from "@/components/public-funnel/trust-authority-bar";

type JakawiHookAndPromiseSectionProps = {
  variant?: "default" | "flat";
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  bullets: string[];
  priceAnchorText?: string;
  priceMainText?: string;
  trustBadges: string[];
  authorityItems?: Array<{
    label: string;
    meta?: string;
  }>;
  media?: RuntimeMediaItem | null;
  cta?: ReactNode;
  hideDesktopMedia?: boolean;
};

function renderHighlightedText(text?: string) {
  if (!text) {
    return null;
  }

  const parts = text.split(/(\[\[.*?\]\])/g);

  return parts.map((part, index) => {
    if (part.startsWith("[[") && part.endsWith("]]")) {
      const content = part.slice(2, -2).trim();
      if (!content) {
        return null;
      }

      return (
        <mark
          key={`${content}-${index}`}
          className="rounded-sm bg-amber-200/85 px-1 py-0.5 text-slate-950"
        >
          {content}
        </mark>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export function JakawiHookAndPromiseSection({
  variant = "default",
  eyebrow,
  headline,
  subheadline,
  bullets,
  priceAnchorText,
  priceMainText,
  trustBadges,
  authorityItems = [],
  media,
  cta,
  hideDesktopMedia = false,
}: JakawiHookAndPromiseSectionProps) {
  return (
    <section
      className={cx(
        "w-full text-[var(--lf-hook-text-main)]",
        variant === "flat" ? "py-6 md:py-8" : "py-2 md:py-3",
      )}
      style={
        {
          "--lf-hook-primary": "#10b981",
          "--lf-hook-text-main": "#f8fafc",
          "--lf-hook-card-bg": "#020617",
        } as CSSProperties
      }
    >
      <div
        className={cx(
          "grid gap-6",
          hideDesktopMedia ? "" : "lg:grid-cols-[1.04fr_0.96fr] lg:items-center",
        )}
      >
        <div className="flex flex-col space-y-3 lg:space-y-4">
          <div className="space-y-1">
            {eyebrow ? (
              <span
                className="mb-0 inline-flex rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-400 md:text-xs"
              >
                {eyebrow}
              </span>
            ) : null}

            <h2
              className={cx(
                "mb-2 max-w-5xl text-balance leading-[0.95]",
                flatBlockTitleClassName,
              )}
            >
              {renderHighlightedText(headline)}
            </h2>

            {subheadline ? (
              <p className="mb-2 max-w-3xl text-base leading-7 text-slate-400">
                {subheadline}
              </p>
            ) : null}

            {authorityItems.length > 0 ? (
              <TrustAuthorityBar items={authorityItems} className="pt-4" />
            ) : null}
          </div>

          {bullets.length > 0 ? (
            <ul className="space-y-2">
              {bullets.map((bullet, index) => (
                <li key={`${bullet}-${index}`} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-sm font-black text-emerald-500">
                    ✓
                  </span>
                  <span className="text-base font-medium leading-relaxed text-slate-100">
                    {bullet}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {priceAnchorText || priceMainText ? (
            <div className="mb-2 flex flex-wrap items-end gap-x-3 gap-y-1">
              {priceAnchorText ? (
                <span className="text-xs font-semibold uppercase text-slate-500 line-through sm:text-sm lg:text-base">
                  {priceAnchorText}
                </span>
              ) : null}
              {priceMainText ? (
                <span className="whitespace-nowrap text-[6.5vw] font-black tracking-tighter text-amber-400 sm:text-3xl lg:text-4xl">
                  {priceMainText}
                </span>
              ) : null}
            </div>
          ) : null}

          {authorityItems.length === 0 && trustBadges.length > 0 ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {trustBadges.map((badge, index) => (
                <span
                  key={`${badge}-${index}`}
                  className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:text-xs"
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}

          {cta ? <div className="pt-1">{cta}</div> : null}

          {media ? (
            <div className="overflow-hidden md:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.src}
                alt={media.alt}
                loading="lazy"
                className="h-full min-h-[220px] w-full object-cover"
              />
            </div>
          ) : null}
        </div>

        {media ? (
          <div className={hideDesktopMedia ? "hidden overflow-hidden md:block lg:hidden" : "hidden overflow-hidden md:block"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media.src}
              alt={media.alt}
              loading="lazy"
              className="h-full min-h-[320px] w-full object-cover"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
