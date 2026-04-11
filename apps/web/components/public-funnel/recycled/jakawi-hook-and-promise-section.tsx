import type { CSSProperties, ReactNode } from "react";

import {
  cx,
  flatBlockTitleClassName,
  FunnelEyebrow,
  RichHeadline,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import type { RuntimeMediaItem } from "@/components/public-funnel/runtime-block-utils";
import { TrustAuthorityBar } from "@/components/public-funnel/trust-authority-bar";
import { jakawiPremiumThemeStyle } from "@/styles/templates/jakawi-premium";

type JakawiHookAndPromiseSectionProps = {
  variant?: "default" | "flat";
  eyebrow?: string;
  hookLeadIn?: string;
  headline: string;
  authorityText?: string;
  authorityFooter?: string;
  subheadline?: string;
  bodyCopy?: string;
  proofHeader?: string;
  bullets: string[];
  priceAnchorText?: string;
  priceMainText?: string;
  trustBadges: string[];
  authorityItems?: Array<{
    label: string;
    meta?: string;
  }>;
  urgencyText?: string;
  urgencyMechanism?: string;
  media?: RuntimeMediaItem | null;
  cta?: ReactNode;
  hideDesktopMedia?: boolean;
};

function parseTechnicalBullet(bullet: string) {
  const normalized = bullet.trim();
  if (!normalized) {
    return { title: "", description: "" };
  }

  const match = normalized.match(/^([^:.-]+?)\s*[:.-]\s*(.+)$/);
  if (!match) {
    return {
      title: normalized,
      description: "",
    };
  }

  return {
    title: match[1]?.trim() ?? normalized,
    description: match[2]?.trim() ?? "",
  };
}

function stripBulletPrefix(bullet: string) {
  return bullet.replace(/^[✔✓]\s*/, "").trim();
}

function renderAuthorityRow(
  authorityText: string | undefined,
  authorityItems: Array<{ label: string; meta?: string }>,
) {
  const segments = authorityText
    ? authorityText
        .split("|")
        .map((segment) => segment.trim())
        .filter(Boolean)
    : authorityItems
        .map((item) =>
          item.meta ? `${item.label}: ${item.meta}` : item.label,
        )
        .filter(Boolean);

  if (!segments.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium text-slate-500 md:text-xs">
      {segments.map((segment, index) => (
        <span key={`${segment}-${index}`} className="inline-flex items-center gap-2">
          <span>{segment}</span>
          {index < segments.length - 1 ? (
            <span aria-hidden="true" className="text-slate-300">
              |
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function renderSubheadline(
  subheadline: string | undefined,
  variant: JakawiHookAndPromiseSectionProps["variant"],
) {
  if (!subheadline) {
    return null;
  }

  if (variant !== "flat") {
    return <>{subheadline}</>;
  }

  const emphasisNeedle = "Y lo peor…";
  const emphasisIndex = subheadline.indexOf(emphasisNeedle);

  if (emphasisIndex === -1) {
    return <>{subheadline}</>;
  }

  const prefix = subheadline.slice(0, emphasisIndex).trimEnd();
  const emphasis = subheadline.slice(emphasisIndex).trim();

  return (
    <>
      {prefix ? <span>{prefix}</span> : null}
      <span className="mt-2 block font-semibold [color:var(--theme-section-hero-hook-headline-color)]">
        {emphasis}
      </span>
    </>
  );
}

export function JakawiHookAndPromiseSection({
  variant = "default",
  eyebrow,
  hookLeadIn,
  headline,
  authorityText,
  authorityFooter,
  subheadline,
  bodyCopy,
  proofHeader,
  bullets,
  priceAnchorText,
  priceMainText,
  trustBadges,
  authorityItems = [],
  urgencyText,
  urgencyMechanism,
  media,
  cta,
  hideDesktopMedia = false,
}: JakawiHookAndPromiseSectionProps) {
  return (
    <section
      className={cx(
        "w-full [background:var(--theme-section-hero-hook-bg)] text-[color:var(--theme-section-hero-hook-text-color)] shadow-[var(--theme-section-hero-hook-shadow)]",
        variant === "flat"
          ? "pb-12 pt-6 md:pb-20 md:pt-10 lg:pt-0"
          : "py-2 md:py-3",
      )}
      style={
        {
          ...jakawiPremiumThemeStyle,
          "--lf-hook-primary": "var(--jakawi-success)",
          "--lf-hook-text-main": "var(--theme-section-hero-hook-text-color)",
          "--lf-hook-card-bg": "var(--theme-section-hero-hook-bg)",
        } as CSSProperties
      }
    >
      <div
        className={cx(
          "grid gap-6",
          hideDesktopMedia ? "" : "lg:grid-cols-[1.04fr_0.96fr] lg:items-center",
        )}
      >
        <div className="mx-auto flex w-full max-w-[640px] flex-col space-y-2.5 lg:space-y-4">
          <div className="space-y-0.5">
            {eyebrow ? (
              <FunnelEyebrow
                className={variant === "flat" ? "mb-2" : "mb-3"}
                variant={variant === "flat" ? "attached" : "pill"}
              >
                {eyebrow}
              </FunnelEyebrow>
            ) : null}

            {hookLeadIn ? (
              <div
                className={cx(
                  "mx-auto mb-8 max-w-4xl text-center text-xl leading-[1.4] md:text-2xl",
                  "[color:var(--theme-section-hero-hook-text-color)]",
                )}
              >
                <RichHeadline
                  text={hookLeadIn}
                  fontClassName="font-subheadline"
                  className="font-medium not-italic"
                />
              </div>
            ) : null}

            <h2
              className={cx(
                "max-w-5xl text-balance",
                variant === "flat"
                  ? "text-left text-[1.8rem] font-black leading-[1.02] tracking-[-0.04em] [color:var(--theme-section-hero-hook-headline-color)] lg:text-5xl"
                  : cx(
                      flatBlockTitleClassName,
                      "[color:var(--theme-section-hero-hook-headline-color)]",
                    ),
              )}
            >
              <RichHeadline text={headline} className="font-black" />
            </h2>

            {subheadline ? (
              <p
                className={cx(
                  "max-w-3xl",
                  variant === "flat"
                    ? "mt-6 text-[14px] leading-5 [color:var(--theme-section-hero-hook-supporting-text-color)]"
                    : "mb-2 text-base leading-7 [color:var(--theme-section-hero-hook-supporting-text-color)]",
                )}
              >
                {renderSubheadline(subheadline, variant)}
              </p>
            ) : null}

            {variant !== "flat" && authorityItems.length > 0 ? (
              <TrustAuthorityBar items={authorityItems} className="pt-4" />
            ) : null}
          </div>

          {urgencyText ? (
            <div
              className={cx(
                "border-l-4 p-3 sm:my-4",
                variant === "flat"
                  ? "mb-10 mt-8 border-emerald-500 bg-emerald-50 text-emerald-900"
                  : "border-emerald-400 bg-emerald-950/30 text-slate-100",
              )}
            >
              <p className={variant === "flat" ? "text-[15px] leading-6" : ""}>{urgencyText}</p>
              {urgencyMechanism ? (
                <p
                  className={cx(
                    "mt-2",
                    variant === "flat"
                      ? "text-[15px] font-semibold leading-6 text-emerald-950"
                      : "font-semibold text-slate-50",
                  )}
                >
                  {urgencyMechanism}
                </p>
              ) : null}
            </div>
          ) : null}

          {cta ? <div className={variant === "flat" ? "mt-6" : "pt-0"}>{cta}</div> : null}

          {bodyCopy ? (
            <p
              className={cx(
                "max-w-3xl text-sm leading-6",
                "[color:var(--theme-section-hero-hook-supporting-text-color)]",
              )}
            >
              {bodyCopy}
            </p>
          ) : null}

          {media && variant === "flat" ? (
            <div className="mb-8 overflow-hidden rounded-[2rem] border border-slate-200 shadow-[0_18px_40px_rgba(15,23,42,0.08)] lg:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.src}
                alt={media.alt}
                loading="lazy"
                className="h-full min-h-[220px] w-full object-cover"
              />
            </div>
          ) : null}

          {proofHeader && bullets.length > 0 ? (
            <p className="mb-2 text-sm font-bold text-slate-800">{proofHeader}</p>
          ) : null}

          {bullets.length > 0 ? (
            <ul className={cx(variant === "flat" ? "space-y-2" : "space-y-1.5")}>
              {bullets.map((bullet, index) => (
                <li
                  key={`${bullet}-${index}`}
                  className={cx(
                    "flex items-start gap-3",
                    variant === "flat"
                      ? "text-slate-700"
                      : "rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-2.5",
                  )}
                >
                  {variant === "flat" ? (
                    <>
                      <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-xs font-black text-emerald-600">
                        ✓
                      </span>
                      <span className="text-sm font-medium leading-6 text-slate-700">
                        {stripBulletPrefix(bullet)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-sm font-black text-emerald-500">
                        {index + 1}
                      </span>
                      <span className="space-y-1">
                        <span className="block text-sm font-black uppercase tracking-[0.18em] text-emerald-600">
                          {parseTechnicalBullet(bullet).title}
                        </span>
                        {parseTechnicalBullet(bullet).description ? (
                          <span className="block text-sm leading-relaxed text-slate-200">
                            {parseTechnicalBullet(bullet).description}
                          </span>
                        ) : null}
                      </span>
                    </>
                  )}
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
                  className={cx(
                    "text-[11px] font-semibold uppercase tracking-wide md:text-xs",
                    variant === "flat" ? "text-slate-500" : "text-slate-400",
                  )}
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}

          {variant === "flat"
            ? renderAuthorityRow(
                authorityFooter || authorityText,
                authorityFooter ? [] : authorityItems,
              )
            : null}

          {media && variant !== "flat" ? (
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
      <style>{`
        @keyframes lf-cta-pulse-scale {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.018);
          }
        }
      `}</style>
    </section>
  );
}
