import type { ComponentPropsWithoutRef, ReactNode } from "react";

import {
  jakawiPremiumClassNames,
  jakawiPremiumSurfaceToneClasses,
} from "@/styles/templates/jakawi-premium";

type SurfaceTone = "brand" | "neutral" | "warm" | "success";
type SurfaceVariant = "default" | "flat";
type RichHeadlineSegmentTone = "default" | "accent" | "highlight" | "underline";
type FunnelEyebrowVariant = "pill" | "attached";

type RichHeadlineSegment = {
  content: string;
  tone: RichHeadlineSegmentTone;
};

export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const surfaceToneClasses: Record<SurfaceTone, string> = jakawiPremiumSurfaceToneClasses;

const readUntil = (text: string, startIndex: number, needle: string) => {
  const endIndex = text.indexOf(needle, startIndex);
  return endIndex === -1
    ? null
    : {
        content: text.slice(startIndex, endIndex),
        nextIndex: endIndex + needle.length,
      };
};

export function parseRichHeadline(text: string): RichHeadlineSegment[] {
  const segments: RichHeadlineSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    if (text.startsWith("**", cursor)) {
      const match = readUntil(text, cursor + 2, "**");
      if (match && match.content.trim()) {
        segments.push({ content: match.content, tone: "highlight" });
        cursor = match.nextIndex;
        continue;
      }
    }

    if (text.startsWith("[[", cursor)) {
      const match = readUntil(text, cursor + 2, "]]");
      if (match && match.content.trim()) {
        segments.push({ content: match.content, tone: "highlight" });
        cursor = match.nextIndex;
        continue;
      }
    }

    if (text.startsWith("*", cursor)) {
      const match = readUntil(text, cursor + 1, "*");
      if (match && match.content.trim()) {
        segments.push({ content: match.content, tone: "accent" });
        cursor = match.nextIndex;
        continue;
      }
    }

    if (text.startsWith("_", cursor)) {
      const match = readUntil(text, cursor + 1, "_");
      if (match && match.content.trim()) {
        segments.push({ content: match.content, tone: "underline" });
        cursor = match.nextIndex;
        continue;
      }
    }

    let nextTokenIndex = text.length;

    for (const token of ["**", "[[", "*", "_"]) {
      const tokenIndex = text.indexOf(token, cursor + 1);
      if (tokenIndex !== -1) {
        nextTokenIndex = Math.min(nextTokenIndex, tokenIndex);
      }
    }

    segments.push({
      content: text.slice(cursor, nextTokenIndex),
      tone: "default",
    });
    cursor = nextTokenIndex;
  }

  return segments;
}

export function RichHeadline({
  text,
  className,
  fontClassName = "font-headline",
}: {
  text?: string | null;
  className?: string;
  fontClassName?: string;
}) {
  if (!text) {
    return null;
  }

  return (
    <span className={cx(fontClassName, className)}>
      {parseRichHeadline(text).map((segment, index) => {
        if (!segment.content) {
          return null;
        }

        if (segment.tone === "highlight") {
          return (
            <span
              key={`${segment.tone}-${segment.content}-${index}`}
              className="rounded-sm bg-vsl-highlight px-1 py-0.5 text-inherit"
            >
              {segment.content}
            </span>
          );
        }

        if (segment.tone === "accent") {
          return (
            <span
              key={`${segment.tone}-${segment.content}-${index}`}
              className="text-vsl-accent"
            >
              {segment.content}
            </span>
          );
        }

        if (segment.tone === "underline") {
          return (
            <span
              key={`${segment.tone}-${segment.content}-${index}`}
              className="underline decoration-2 underline-offset-[0.18em]"
            >
              {segment.content}
            </span>
          );
        }

        return <span key={`${segment.tone}-${segment.content}-${index}`}>{segment.content}</span>;
      })}
    </span>
  );
}

export const flatBlockTitleClassName = cx("font-headline", jakawiPremiumClassNames.title);

export function FunnelEyebrow({
  children,
  className,
  variant = "pill",
}: {
  children: ReactNode;
  className?: string;
  variant?: FunnelEyebrowVariant;
}) {
  const shellClassName =
    variant === "attached"
      ? "flex w-full justify-[var(--theme-eyebrow-attached-justify)]"
      : "flex w-full justify-[var(--theme-eyebrow-pill-justify)]";
  const contentClassName =
    variant === "attached"
      ? "inline-block max-w-full border [background:var(--theme-eyebrow-attached-bg)] [border-color:var(--theme-eyebrow-attached-border)] [border-radius:var(--theme-eyebrow-attached-radius)] px-[var(--theme-eyebrow-attached-padding-x)] py-[var(--theme-eyebrow-attached-padding-y)] text-[color:var(--theme-eyebrow-attached-color)] [font-family:var(--theme-eyebrow-attached-font-family)] [font-size:var(--theme-eyebrow-attached-font-size)] [font-weight:var(--theme-eyebrow-attached-font-weight)] [line-height:var(--theme-eyebrow-attached-line-height)] [letter-spacing:var(--theme-eyebrow-attached-letter-spacing)] [text-align:var(--theme-eyebrow-attached-alignment)] [text-transform:var(--theme-eyebrow-attached-text-transform)]"
      : "inline-block max-w-full border [background:var(--theme-eyebrow-pill-bg)] [border-color:var(--theme-eyebrow-pill-border)] [border-radius:var(--theme-eyebrow-pill-radius)] px-[var(--theme-eyebrow-pill-padding-x)] py-[var(--theme-eyebrow-pill-padding-y)] text-[color:var(--theme-eyebrow-pill-color)] [font-family:var(--theme-eyebrow-pill-font-family)] [font-size:var(--theme-eyebrow-pill-font-size)] [font-weight:var(--theme-eyebrow-pill-font-weight)] [line-height:var(--theme-eyebrow-pill-line-height)] [letter-spacing:var(--theme-eyebrow-pill-letter-spacing)] [text-align:var(--theme-eyebrow-pill-alignment)] [text-transform:var(--theme-eyebrow-pill-text-transform)]";

  return (
    <div className={cx(shellClassName, className)}>
      <span className={contentClassName}>
        {children}
      </span>
    </div>
  );
}

export function PublicSectionSurface({
  children,
  className,
  tone = "neutral",
  variant = "default",
  ...props
}: {
  children: ReactNode;
  className?: string;
  tone?: SurfaceTone;
  variant?: SurfaceVariant;
} & ComponentPropsWithoutRef<"section">) {
  return (
    <section
      {...props}
      className={cx(
        variant === "flat"
          ? "overflow-visible p-0"
          : "overflow-hidden rounded-[2rem] border p-6 md:p-8",
        variant === "flat" ? "" : surfaceToneClasses[tone],
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PublicEyebrow({
  children,
  className,
  tone = "brand",
}: {
  children: ReactNode;
  className?: string;
  tone?: "brand" | "neutral" | "warm" | "success";
}) {
  const toneClass =
    tone === "brand"
      ? "text-teal-300"
      : tone === "warm"
        ? "text-amber-700"
        : tone === "success"
          ? "text-emerald-700"
          : "text-slate-500";

  return (
    <p
      className={cx(
        "font-headline text-xs font-semibold uppercase tracking-[0.28em]",
        toneClass,
        className,
      )}
    >
      {children}
    </p>
  );
}

export function PublicPill({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "brand" | "warm" | "success";
}) {
  const toneClass =
    tone === "brand"
      ? "border-white/15 bg-white/10 text-slate-100"
      : tone === "warm"
        ? "border-amber-200 bg-white text-amber-800"
        : tone === "success"
          ? "border-emerald-200 bg-white text-emerald-800"
          : "border-slate-200 bg-white text-slate-700";

  return (
    <span
      className={cx(
        "font-headline inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em]",
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PublicChecklistItem({
  children,
  accent = "brand",
  variant = "default",
}: {
  children: ReactNode;
  accent?: "brand" | "warm" | "success";
  variant?: SurfaceVariant;
}) {
  const accentClass =
    accent === "warm"
      ? "bg-amber-500 text-white"
      : accent === "success"
        ? "bg-emerald-500 text-white"
        : "bg-slate-950 text-white";

  return (
    <div
      className={cx(
        "flex items-start gap-3",
        variant === "flat"
          ? "px-0 py-1"
          : "rounded-[1.5rem] border border-white/70 bg-white/80 px-4 py-4",
      )}
    >
      <div
        className={cx(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          accentClass,
        )}
      >
        ✓
      </div>
      <p
        className={cx(
          "font-body text-sm leading-6",
          variant === "flat" ? "text-slate-700" : "text-slate-700",
        )}
      >
        {children}
      </p>
    </div>
  );
}

export function PublicStatCard({
  label,
  value,
  description,
  tone = "neutral",
  variant = "default",
}: {
  label: string;
  value: string;
  description?: string;
  tone?: "neutral" | "brand" | "warm" | "success";
  variant?: SurfaceVariant;
}) {
  const toneClass =
    tone === "brand"
      ? "border-white/10 bg-white/8 text-white"
      : tone === "warm"
        ? "border-amber-200 bg-white/90"
        : tone === "success"
          ? "border-emerald-200 bg-white/90"
          : "border-slate-200 bg-white";

  const labelTone =
    variant === "flat"
      ? "text-slate-500"
      : tone === "brand"
        ? "text-slate-300"
        : "text-slate-500";
  const valueTone =
    variant === "flat"
      ? "text-slate-950"
      : tone === "brand"
        ? "text-white"
        : "text-slate-950";
  const descriptionTone =
    variant === "flat"
      ? "text-slate-600"
      : tone === "brand"
        ? "text-slate-200"
        : "text-slate-600";

  return (
    <article
      className={cx(
        variant === "flat"
          ? "border-0 bg-transparent px-0 py-1"
          : "rounded-[1.5rem] border px-4 py-4",
        variant === "flat" ? "" : toneClass,
      )}
    >
      <p
        className={cx(
          "font-headline text-[11px] font-semibold uppercase tracking-[0.24em]",
          labelTone,
        )}
      >
        {label}
      </p>
      <p
        className={cx(
          "font-headline mt-3 text-2xl font-semibold tracking-tight",
          valueTone,
        )}
      >
        {value}
      </p>
      {description ? (
        <p className={cx("font-body mt-2 text-sm leading-6", descriptionTone)}>
          {description}
        </p>
      ) : null}
    </article>
  );
}

export function PublicQuoteCard({
  quote,
  author,
  detail,
  variant = "default",
}: {
  quote: string;
  author: string;
  detail?: string;
  variant?: SurfaceVariant;
}) {
  return (
    <article
      className={cx(
        variant === "flat"
          ? "px-0 py-1"
          : "rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]",
      )}
    >
      <p
        className={cx(
          "font-body text-base leading-7",
          variant === "flat" ? "text-slate-700" : "text-slate-700",
        )}
      >
        &ldquo;{quote}&rdquo;
      </p>
      <div className="mt-5">
        <p
          className={cx(
            "font-headline text-sm font-semibold",
            variant === "flat" ? "text-slate-950" : "text-slate-950",
          )}
        >
          {author}
        </p>
        {detail ? (
          <p
            className={cx(
              "font-body mt-1 text-sm",
              variant === "flat" ? "text-slate-500" : "text-slate-500",
            )}
          >
            {detail}
          </p>
        ) : null}
      </div>
    </article>
  );
}

const primaryThemeButtonClassName =
  "font-button inline-flex items-center justify-center gap-[var(--theme-button-primary-gap)] border text-center no-underline [border-width:var(--theme-button-primary-border-width)] [border-radius:var(--theme-button-primary-rest-radius)] [background:var(--theme-button-primary-rest-bg)] [border-color:var(--theme-button-primary-rest-border)] px-[var(--theme-button-primary-padding-x)] py-[var(--theme-button-primary-padding-y)] [color:var(--theme-button-primary-rest-text-color)] [font-family:var(--theme-button-primary-rest-font-family)] [font-size:var(--theme-button-primary-rest-font-size)] [font-weight:var(--theme-button-primary-rest-font-weight)] [letter-spacing:var(--theme-button-primary-rest-letter-spacing)] [line-height:var(--theme-button-primary-rest-line-height)] [min-height:var(--theme-button-primary-min-height)] [text-transform:var(--theme-button-primary-rest-text-transform)] shadow-[var(--theme-button-primary-rest-shadow)] transition-all duration-[var(--theme-button-primary-motion-duration)] ease-[var(--theme-button-primary-motion-easing)] hover:[background:var(--theme-button-primary-hover-bg)] hover:[border-color:var(--theme-button-primary-hover-border)] hover:[color:var(--theme-button-primary-hover-text-color)] hover:shadow-[var(--theme-button-primary-hover-shadow)] hover:[transform:var(--theme-button-primary-motion-transform)] focus-visible:outline focus-visible:outline-[var(--theme-button-primary-border-width)] focus-visible:outline-[var(--theme-button-primary-outline-color)] focus-visible:[outline-offset:var(--theme-button-primary-outline-offset)] focus-visible:[background:var(--theme-button-primary-focus-bg)] focus-visible:[border-color:var(--theme-button-primary-focus-border)] focus-visible:[color:var(--theme-button-primary-focus-text-color)] focus-visible:shadow-[var(--theme-button-primary-focus-shadow)]";

const secondaryThemeButtonClassName =
  "font-button inline-flex items-center justify-center gap-[var(--theme-button-secondary-gap)] border text-center no-underline [border-width:var(--theme-button-secondary-border-width)] [border-radius:var(--theme-button-secondary-rest-radius)] [background:var(--theme-button-secondary-rest-bg)] [border-color:var(--theme-button-secondary-rest-border)] px-[var(--theme-button-secondary-padding-x)] py-[var(--theme-button-secondary-padding-y)] [color:var(--theme-button-secondary-rest-text-color)] [font-family:var(--theme-button-secondary-rest-font-family)] [font-size:var(--theme-button-secondary-rest-font-size)] [font-weight:var(--theme-button-secondary-rest-font-weight)] [letter-spacing:var(--theme-button-secondary-rest-letter-spacing)] [line-height:var(--theme-button-secondary-rest-line-height)] [min-height:var(--theme-button-secondary-min-height)] [text-transform:var(--theme-button-secondary-rest-text-transform)] shadow-[var(--theme-button-secondary-rest-shadow)] transition-all duration-[var(--theme-button-secondary-motion-duration)] ease-[var(--theme-button-secondary-motion-easing)] hover:[background:var(--theme-button-secondary-hover-bg)] hover:[border-color:var(--theme-button-secondary-hover-border)] hover:[color:var(--theme-button-secondary-hover-text-color)] hover:shadow-[var(--theme-button-secondary-hover-shadow)] hover:[transform:var(--theme-button-secondary-motion-transform)] focus-visible:outline focus-visible:outline-[var(--theme-button-secondary-border-width)] focus-visible:outline-[var(--theme-button-secondary-outline-color)] focus-visible:[outline-offset:var(--theme-button-secondary-outline-offset)] focus-visible:[background:var(--theme-button-secondary-focus-bg)] focus-visible:[border-color:var(--theme-button-secondary-focus-border)] focus-visible:[color:var(--theme-button-secondary-focus-text-color)] focus-visible:shadow-[var(--theme-button-secondary-focus-shadow)]";

export const heroHookPrimaryButtonClassName =
  "font-button inline-flex items-center justify-center gap-[var(--theme-section-hero-hook-primary-cta-gap)] border text-center no-underline [border-width:var(--theme-section-hero-hook-primary-cta-border-width)] [border-radius:var(--theme-section-hero-hook-primary-cta-rest-radius)] [background:var(--theme-section-hero-hook-primary-cta-rest-bg)] [border-color:var(--theme-section-hero-hook-primary-cta-rest-border)] px-[var(--theme-section-hero-hook-primary-cta-padding-x)] py-[var(--theme-section-hero-hook-primary-cta-padding-y)] [color:var(--theme-section-hero-hook-primary-cta-rest-text-color)] [font-family:var(--theme-section-hero-hook-primary-cta-rest-font-family)] [font-size:var(--theme-section-hero-hook-primary-cta-rest-font-size)] [font-weight:var(--theme-section-hero-hook-primary-cta-rest-font-weight)] [letter-spacing:var(--theme-section-hero-hook-primary-cta-rest-letter-spacing)] [line-height:var(--theme-section-hero-hook-primary-cta-rest-line-height)] [min-height:var(--theme-section-hero-hook-primary-cta-min-height)] [text-transform:var(--theme-section-hero-hook-primary-cta-rest-text-transform)] shadow-[var(--theme-section-hero-hook-primary-cta-rest-shadow)] transition-all duration-[var(--theme-section-hero-hook-primary-cta-motion-duration)] ease-[var(--theme-section-hero-hook-primary-cta-motion-easing)] hover:[background:var(--theme-section-hero-hook-primary-cta-hover-bg)] hover:[border-color:var(--theme-section-hero-hook-primary-cta-hover-border)] hover:[color:var(--theme-section-hero-hook-primary-cta-hover-text-color)] hover:shadow-[var(--theme-section-hero-hook-primary-cta-hover-shadow)] hover:[transform:var(--theme-section-hero-hook-primary-cta-motion-transform)] focus-visible:outline focus-visible:outline-[var(--theme-section-hero-hook-primary-cta-border-width)] focus-visible:outline-[var(--theme-section-hero-hook-primary-cta-outline-color)] focus-visible:[outline-offset:var(--theme-section-hero-hook-primary-cta-outline-offset)] focus-visible:[background:var(--theme-section-hero-hook-primary-cta-focus-bg)] focus-visible:[border-color:var(--theme-section-hero-hook-primary-cta-focus-border)] focus-visible:[color:var(--theme-section-hero-hook-primary-cta-focus-text-color)] focus-visible:shadow-[var(--theme-section-hero-hook-primary-cta-focus-shadow)]";

export const stickyBarPrimaryButtonClassName =
  "font-button inline-flex items-center justify-center gap-[var(--theme-section-sticky-bar-primary-cta-gap)] border text-center no-underline [border-width:var(--theme-section-sticky-bar-primary-cta-border-width)] [border-radius:var(--theme-section-sticky-bar-primary-cta-rest-radius)] [background:var(--theme-section-sticky-bar-primary-cta-rest-bg)] [border-color:var(--theme-section-sticky-bar-primary-cta-rest-border)] px-[var(--theme-section-sticky-bar-primary-cta-padding-x)] py-[var(--theme-section-sticky-bar-primary-cta-padding-y)] [color:var(--theme-section-sticky-bar-primary-cta-rest-text-color)] [font-family:var(--theme-section-sticky-bar-primary-cta-rest-font-family)] [font-size:var(--theme-section-sticky-bar-primary-cta-rest-font-size)] [font-weight:var(--theme-section-sticky-bar-primary-cta-rest-font-weight)] [letter-spacing:var(--theme-section-sticky-bar-primary-cta-rest-letter-spacing)] [line-height:var(--theme-section-sticky-bar-primary-cta-rest-line-height)] [min-height:var(--theme-section-sticky-bar-primary-cta-min-height)] [text-transform:var(--theme-section-sticky-bar-primary-cta-rest-text-transform)] shadow-[var(--theme-section-sticky-bar-primary-cta-rest-shadow)] transition-all duration-[var(--theme-section-sticky-bar-primary-cta-motion-duration)] ease-[var(--theme-section-sticky-bar-primary-cta-motion-easing)] hover:[background:var(--theme-section-sticky-bar-primary-cta-hover-bg)] hover:[border-color:var(--theme-section-sticky-bar-primary-cta-hover-border)] hover:[color:var(--theme-section-sticky-bar-primary-cta-hover-text-color)] hover:shadow-[var(--theme-section-sticky-bar-primary-cta-hover-shadow)] hover:[transform:var(--theme-section-sticky-bar-primary-cta-motion-transform)] focus-visible:outline focus-visible:outline-[var(--theme-section-sticky-bar-primary-cta-border-width)] focus-visible:outline-[var(--theme-section-sticky-bar-primary-cta-outline-color)] focus-visible:[outline-offset:var(--theme-section-sticky-bar-primary-cta-outline-offset)] focus-visible:[background:var(--theme-section-sticky-bar-primary-cta-focus-bg)] focus-visible:[border-color:var(--theme-section-sticky-bar-primary-cta-focus-border)] focus-visible:[color:var(--theme-section-sticky-bar-primary-cta-focus-text-color)] focus-visible:shadow-[var(--theme-section-sticky-bar-primary-cta-focus-shadow)]";

export const buildCtaClassName = (variant: "primary" | "secondary" = "primary") =>
  variant === "primary"
    ? primaryThemeButtonClassName
    : secondaryThemeButtonClassName;
