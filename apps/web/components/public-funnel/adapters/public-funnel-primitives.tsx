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
}: {
  text?: string | null;
  className?: string;
}) {
  if (!text) {
    return null;
  }

  return (
    <span className={cx("font-headline", className)}>
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
  return (
    <div className={cx("funnel-eyebrow-shell", className)}>
      <span
        className={cx(
          "funnel-eyebrow-align bg-funnel-eyebrow-bg text-funnel-eyebrow-text font-body inline-block max-w-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em]",
          variant === "attached" ? "rounded-b-lg" : "rounded-full",
        )}
      >
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

export const buildCtaClassName = (variant: "primary" | "secondary" = "primary") =>
  variant === "primary"
    ? jakawiPremiumClassNames.primaryButton
    : jakawiPremiumClassNames.secondaryButton;
