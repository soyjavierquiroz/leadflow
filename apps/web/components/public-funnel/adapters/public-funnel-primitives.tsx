import type { ComponentPropsWithoutRef, ReactNode } from "react";

type SurfaceTone = "brand" | "neutral" | "warm" | "success";
type SurfaceVariant = "default" | "flat";

const surfaceToneClasses: Record<SurfaceTone, string> = {
  brand:
    "border-white/15 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.22),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(250,204,21,0.16),_transparent_28%),linear-gradient(135deg,_rgba(2,6,23,0.98)_0%,_rgba(15,23,42,0.95)_52%,_rgba(30,41,59,0.98)_100%)] text-white shadow-[0_34px_110px_rgba(15,23,42,0.28)]",
  neutral:
    "border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(248,250,252,0.96)_100%)] text-slate-950 shadow-[0_22px_70px_rgba(15,23,42,0.08)]",
  warm:
    "border-amber-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_32%),linear-gradient(180deg,_rgba(255,251,235,0.98)_0%,_rgba(255,255,255,0.96)_100%)] text-slate-950 shadow-[0_22px_70px_rgba(217,119,6,0.12)]",
  success:
    "border-emerald-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),linear-gradient(180deg,_rgba(236,253,245,0.98)_0%,_rgba(255,255,255,0.96)_100%)] text-slate-950 shadow-[0_22px_70px_rgba(5,150,105,0.12)]",
};

export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

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
          variant === "flat" ? "text-slate-300" : "text-slate-700",
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
      ? "text-slate-100"
      : tone === "brand"
        ? "text-white"
        : "text-slate-950";
  const descriptionTone =
    variant === "flat"
      ? "text-slate-400"
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
          variant === "flat" ? "text-slate-300" : "text-slate-700",
        )}
      >
        &ldquo;{quote}&rdquo;
      </p>
      <div className="mt-5">
        <p
          className={cx(
            "text-sm font-semibold",
            variant === "flat" ? "text-slate-100" : "text-slate-950",
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
  cx(
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    variant === "primary"
      ? "bg-slate-950 text-white hover:bg-slate-800 focus-visible:outline-slate-900"
      : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 focus-visible:outline-slate-400",
  );
