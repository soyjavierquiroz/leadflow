import type { ComponentPropsWithoutRef, ReactNode } from "react";

import {
  jakawiPremiumClassNames,
  jakawiPremiumSurfaceToneClasses,
} from "@/styles/templates/jakawi-premium";

type SurfaceTone = "brand" | "neutral" | "warm" | "success";
type SurfaceVariant = "default" | "flat";

export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const surfaceToneClasses: Record<SurfaceTone, string> = jakawiPremiumSurfaceToneClasses;

export const flatBlockTitleClassName = jakawiPremiumClassNames.title;

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
        "text-xs font-semibold uppercase tracking-[0.28em]",
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
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em]",
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
          "text-sm leading-6",
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
          "text-[11px] font-semibold uppercase tracking-[0.24em]",
          labelTone,
        )}
      >
        {label}
      </p>
      <p className={cx("mt-3 text-2xl font-semibold tracking-tight", valueTone)}>
        {value}
      </p>
      {description ? (
        <p className={cx("mt-2 text-sm leading-6", descriptionTone)}>
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
          "text-base leading-7",
          variant === "flat" ? "text-slate-700" : "text-slate-700",
        )}
      >
        &ldquo;{quote}&rdquo;
      </p>
      <div className="mt-5">
        <p
          className={cx(
            "text-sm font-semibold",
            variant === "flat" ? "text-slate-950" : "text-slate-950",
          )}
        >
          {author}
        </p>
        {detail ? (
          <p
            className={cx(
              "mt-1 text-sm",
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
