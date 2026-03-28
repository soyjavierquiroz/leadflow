import type { ReactNode } from "react";

import {
  PublicChecklistItem,
  PublicEyebrow,
  PublicPill,
  PublicQuoteCard,
  PublicSectionSurface,
  PublicStatCard,
  cx,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import type {
  RuntimeFaqItem,
  RuntimeFeatureItem,
  RuntimeLogoItem,
  RuntimeMediaItem,
  RuntimeMetricItem,
  RuntimeOfferItem,
  RuntimeTestimonialItem,
} from "@/components/public-funnel/runtime-block-utils";

type RecycledHeroSectionProps = {
  variant?: string;
  eyebrow: string;
  pills: Array<{
    label: string;
    tone?: "neutral" | "brand" | "warm" | "success";
  }>;
  title: string;
  description: string;
  primaryCta: ReactNode;
  secondaryCta?: ReactNode;
  metrics: RuntimeMetricItem[];
  media?: RuntimeMediaItem | null;
  accent: string;
  narrative: string;
  proofItems: string[];
};

export function RecycledHeroSection({
  variant = "leadflow_signal",
  eyebrow,
  pills,
  title,
  description,
  primaryCta,
  secondaryCta,
  metrics,
  media,
  accent,
  narrative,
  proofItems,
}: RecycledHeroSectionProps) {
  return (
    <PublicSectionSurface
      tone="brand"
      className={cx(
        "md:p-10",
        variant === "opportunity" ? "border-amber-300/30" : "",
      )}
    >
      <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-stretch">
        <div className="flex flex-col justify-between">
          <div>
            <PublicEyebrow>{eyebrow}</PublicEyebrow>
            <div className="mt-5 flex flex-wrap gap-2">
              {pills.map((pill) => (
                <PublicPill
                  key={`${pill.tone ?? "neutral"}-${pill.label}`}
                  tone={pill.tone ?? "brand"}
                >
                  {pill.label}
                </PublicPill>
              ))}
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              {description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {primaryCta}
              {secondaryCta}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {metrics.map((item) => (
              <PublicStatCard
                key={`${item.label}-${item.value}`}
                label={item.label}
                value={item.value}
                description={item.description}
                tone="brand"
              />
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/7 p-5 backdrop-blur">
          {media ? (
            <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.src}
                alt={media.alt}
                className="h-64 w-full object-cover md:h-72"
              />
            </div>
          ) : null}
          <div className={cx("grid gap-4", media ? "mt-5" : "")}>
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">
                {accent}
              </p>
              <p className="mt-3 text-lg font-semibold text-white">{narrative}</p>
            </div>
            <div className="grid gap-3">
              {proofItems.map((item) => (
                <PublicChecklistItem key={item}>{item}</PublicChecklistItem>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PublicSectionSurface>
  );
}

type RecycledHookSectionProps = {
  eyebrow: string;
  hook: string;
  promise: string;
  cta: ReactNode;
  points: string[];
};

export function RecycledHookSection({
  eyebrow,
  hook,
  promise,
  cta,
  points,
}: RecycledHookSectionProps) {
  return (
    <PublicSectionSurface tone="brand">
      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div>
          <PublicEyebrow>{eyebrow}</PublicEyebrow>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            {hook}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
            {promise}
          </p>
          <div className="mt-7">{cta}</div>
        </div>

        <div className="grid gap-3">
          {points.map((item) => (
            <PublicChecklistItem key={item}>{item}</PublicChecklistItem>
          ))}
        </div>
      </div>
    </PublicSectionSurface>
  );
}

type RecycledSocialProofSectionProps = {
  variant?: string;
  surfaceVariant?: "default" | "flat";
  eyebrow: string;
  title: string;
  description: string;
  metrics: RuntimeMetricItem[];
  testimonials: RuntimeTestimonialItem[];
  checklist: RuntimeFeatureItem[];
  logos?: RuntimeLogoItem[];
};

export function RecycledSocialProofSection({
  variant = "metrics_trust",
  surfaceVariant = "default",
  eyebrow,
  title,
  description,
  metrics,
  testimonials,
  checklist,
  logos = [],
}: RecycledSocialProofSectionProps) {
  return (
    <PublicSectionSurface
      variant={surfaceVariant}
      className={surfaceVariant === "flat" ? "py-6 text-left md:py-8" : ""}
    >
      <div className="max-w-3xl">
        <PublicEyebrow
          tone="neutral"
          className={surfaceVariant === "flat" ? "text-slate-400" : ""}
        >
          {eyebrow}
        </PublicEyebrow>
        <h2
          className={cx(
            "mt-3 text-left text-3xl font-black tracking-tight",
            surfaceVariant === "flat" ? "text-slate-100" : "text-slate-950",
          )}
        >
          {title}
        </h2>
        <p
          className={cx(
            "mt-4 text-left text-base leading-7",
            surfaceVariant === "flat" ? "text-slate-400" : "text-slate-600",
          )}
        >
          {description}
        </p>
      </div>
      {logos.length > 0 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {logos.map((logo) => (
            <div
              key={`${logo.alt}-${logo.src}`}
              className={cx(
                "flex min-h-20 items-center justify-center rounded-[1.4rem] px-4 py-5",
                surfaceVariant === "flat"
                  ? "border border-slate-800 bg-slate-900"
                  : "border border-slate-200 bg-white",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo.src}
                alt={logo.alt}
                className="max-h-10 w-auto object-contain opacity-80 saturate-0"
              />
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {metrics.map((item) => (
          <PublicStatCard
            key={`${item.label}-${item.value}`}
            label={item.label}
            value={item.value}
            description={item.description}
            variant={surfaceVariant}
          />
        ))}
      </div>
      {variant === "risk_reversal" && checklist.length > 0 ? (
        <div className="mt-8 grid gap-3">
          {checklist.map((item) => (
            <PublicChecklistItem key={item.title} variant={surfaceVariant}>
              {item.title}
            </PublicChecklistItem>
          ))}
        </div>
      ) : null}
      {testimonials.length > 0 ? (
        <div
          className={cx(
            "mt-8 grid gap-4",
            variant === "testimonials_focus" ? "lg:grid-cols-3" : "lg:grid-cols-2",
          )}
        >
          {testimonials.map((item) => (
            <PublicQuoteCard
              key={`${item.author}-${item.quote}`}
              quote={item.quote}
              author={item.author}
              detail={[item.role, item.company].filter(Boolean).join(" · ")}
              variant={surfaceVariant}
            />
          ))}
        </div>
      ) : null}
    </PublicSectionSurface>
  );
}

type RecycledVideoSectionProps = {
  sectionId?: string;
  eyebrow: string;
  title: string;
  caption?: string;
  embedUrl: string;
  checklist: string[];
  footer: string;
  helperPill?: string;
};

export function RecycledVideoSection({
  sectionId,
  eyebrow,
  title,
  caption,
  embedUrl,
  checklist,
  footer,
  helperPill,
}: RecycledVideoSectionProps) {
  return (
    <PublicSectionSurface id={sectionId}>
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <PublicEyebrow tone="neutral">{eyebrow}</PublicEyebrow>
          {helperPill ? (
            <div className="mt-4">
              <PublicPill>{helperPill}</PublicPill>
            </div>
          ) : null}
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          {caption ? (
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              {caption}
            </p>
          ) : null}
          <div className="mt-6 overflow-hidden rounded-[1.8rem] border border-slate-200 bg-slate-950 shadow-inner">
            <div className="aspect-video">
              <iframe
                className="h-full w-full"
                src={embedUrl}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
          <PublicEyebrow tone="neutral">Qué refuerza este bloque</PublicEyebrow>
          <p className="mt-3 text-lg font-semibold text-slate-950">
            Una pieza media deja de ser decorativa y pasa a sostener la decisión
            comercial antes de la captura.
          </p>
          <div className="mt-6 grid gap-3">
            {checklist.map((item) => (
              <PublicChecklistItem key={item}>{item}</PublicChecklistItem>
            ))}
          </div>
          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-4">
            <p className="text-sm leading-6 text-slate-700">{footer}</p>
          </div>
        </div>
      </div>
    </PublicSectionSurface>
  );
}

type RecycledOfferStackSectionProps = {
  variant?: string;
  eyebrow: string;
  title: string;
  description: string;
  items: RuntimeOfferItem[];
  price?: string;
  note?: string;
  cta: ReactNode;
};

export function RecycledOfferStackSection({
  variant = "offer_stack",
  eyebrow,
  title,
  description,
  items,
  price,
  note,
  cta,
}: RecycledOfferStackSectionProps) {
  return (
    <PublicSectionSurface tone="warm">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <PublicEyebrow tone="warm">{eyebrow}</PublicEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-700">{description}</p>
          {items.length > 0 ? (
            <div className="mt-6 grid gap-3">
              {items.map((item, index) => (
                <div
                  key={item.title}
                  className="rounded-[1.5rem] border border-amber-200/80 bg-white/80 px-4 py-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                    Incluye {index + 1}
                  </p>
                  <p className="mt-3 text-base font-semibold text-slate-950">
                    {item.title}
                  </p>
                  {item.description ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.8rem] border border-amber-200 bg-white p-6">
          <PublicPill tone="warm">
            {variant === "offer_stack" ? "Offer stack" : "Oferta comercial"}
          </PublicPill>
          <p className="mt-5 text-4xl font-semibold tracking-tight text-slate-950">
            {price || "Personalizable"}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {note ||
              "Componente listo para envolver pricing, bonus, bundles y CTA propio."}
          </p>
          <div className="mt-6">{cta}</div>
        </div>
      </div>
    </PublicSectionSurface>
  );
}

type RecycledFinalCtaSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  primaryCta: ReactNode;
  secondaryCta?: ReactNode;
};

export function RecycledFinalCtaSection({
  eyebrow,
  title,
  description,
  highlights,
  primaryCta,
  secondaryCta,
}: RecycledFinalCtaSectionProps) {
  return (
    <PublicSectionSurface tone="brand" className="md:p-10">
      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div>
          <PublicEyebrow>{eyebrow}</PublicEyebrow>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-balance text-white md:text-5xl">
            {title}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
            {description}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {primaryCta}
            {secondaryCta}
          </div>
        </div>
        <div className="grid gap-3">
          {highlights.map((item) => (
            <PublicChecklistItem key={item}>{item}</PublicChecklistItem>
          ))}
        </div>
      </div>
    </PublicSectionSurface>
  );
}

type RecycledFaqAccordionSectionProps = {
  variant?: "default" | "flat";
  eyebrow: string;
  title: string;
  items: RuntimeFaqItem[];
};

export function RecycledFaqAccordionSection({
  variant = "default",
  eyebrow,
  title,
  items,
}: RecycledFaqAccordionSectionProps) {
  return (
    <PublicSectionSurface
      variant={variant}
      className={variant === "flat" ? "py-6 text-left md:py-8" : ""}
    >
      <div className="max-w-3xl">
        <PublicEyebrow
          tone={variant === "flat" ? "neutral" : "neutral"}
          className={variant === "flat" ? "text-slate-400" : ""}
        >
          {eyebrow}
        </PublicEyebrow>
        <h2
          className={cx(
            "mt-3 text-left text-3xl font-black tracking-tight",
            variant === "flat" ? "text-slate-100" : "text-slate-950",
          )}
        >
          {title}
        </h2>
      </div>
      <div className="mt-8 space-y-3">
        {items.map((item) => (
          <details
            key={item.question}
            className={cx(
              "group",
              variant === "flat"
                ? "rounded-[1.4rem] border border-slate-800 bg-slate-900 px-5 py-5"
                : "rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5 open:bg-white",
            )}
          >
            <summary
              className={cx(
                "cursor-pointer list-none text-base font-semibold",
                variant === "flat" ? "text-slate-100" : "text-slate-900",
              )}
            >
              {item.question}
            </summary>
            <p
              className={cx(
                "mt-3 text-sm leading-6",
                variant === "flat" ? "text-slate-400" : "text-slate-600",
              )}
            >
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </PublicSectionSurface>
  );
}
