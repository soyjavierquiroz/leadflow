import type { CSSProperties, ReactNode } from "react";

import type { RuntimeMediaItem } from "@/components/public-funnel/runtime-block-utils";

type UniqueMechanismStepItem = {
  title?: string;
  text?: string;
};

type UniqueMechanismPairItem = {
  feature?: string;
  benefit?: string;
};

type JakawiUniqueMechanismSectionProps = {
  variant?: "default" | "flat";
  headline?: string;
  mechanismName?: string;
  steps: UniqueMechanismStepItem[];
  pairs: UniqueMechanismPairItem[];
  media?: RuntimeMediaItem | null;
  mediaNode?: ReactNode;
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

export function JakawiUniqueMechanismSection({
  variant = "default",
  headline,
  mechanismName,
  steps,
  pairs,
  media,
  mediaNode,
  hideDesktopMedia = false,
}: JakawiUniqueMechanismSectionProps) {
  return (
    <section
      className={
        variant === "flat"
          ? "w-full py-6 text-[var(--lf-unique-text-main)] md:py-8"
          : "w-full py-6 text-[var(--lf-unique-text-main)] md:py-8"
      }
      style={
        {
          "--lf-unique-primary": "#10b981",
          "--lf-unique-text-main": "#f8fafc",
          "--lf-unique-card-bg": "#020617",
        } as CSSProperties
      }
    >
      <div className="space-y-7">
        {headline ? (
          <h3 className="max-w-4xl text-3xl font-black leading-tight tracking-tight text-slate-100 md:text-4xl">
            {renderHighlightedText(headline)}
          </h3>
        ) : null}

        {mechanismName ? (
          <div className="space-y-3">
            <p
              className="text-xs font-black uppercase tracking-[0.22em]"
              style={{ color: "var(--lf-unique-primary)" }}
            >
              Mecanismo único
            </p>
            <p className="mt-3 text-lg font-bold leading-snug text-slate-100 md:text-xl">
              {mechanismName}
            </p>
          </div>
        ) : null}

        {steps.length > 0 ? (
          <div className="space-y-4">
            {steps.map((step, index) => (
              <article
                key={`${step.title || step.text}-${index}`}
                className="flex items-start gap-4"
              >
                <span
                  className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-black"
                  style={{
                    backgroundColor: "var(--lf-unique-primary)",
                    color: "var(--lf-unique-card-bg)",
                  }}
                >
                  {index + 1}
                </span>
                <div>
                  {step.title ? (
                    <h4 className="text-base font-bold leading-snug text-slate-100">
                      {step.title}
                    </h4>
                  ) : null}
                  {step.text ? (
                    <p className="mt-2 text-[15px] leading-relaxed text-slate-400">
                      {step.text}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <div className={hideDesktopMedia ? "overflow-hidden lg:hidden" : "overflow-hidden"}>
          {mediaNode ? (
            mediaNode
          ) : media ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.src}
              alt={media.alt}
              loading="lazy"
              className="h-full min-h-[280px] w-full object-cover"
            />
          ) : (
            <div className="flex min-h-[280px] items-center justify-center rounded-[1.6rem] border border-slate-800 bg-slate-900 text-sm font-medium text-slate-500">
              Demo del mecanismo
            </div>
          )}
        </div>

        {pairs.length > 0 ? (
          <div className="space-y-4">
            {pairs.map((pair, index) => (
              <article
                key={`${pair.feature || pair.benefit}-${index}`}
                className="space-y-3"
              >
                {pair.feature ? (
                  <p
                    className="text-xs font-black uppercase tracking-[0.18em]"
                    style={{ color: "var(--lf-unique-primary)" }}
                  >
                    {pair.feature}
                  </p>
                ) : null}
                {pair.benefit ? (
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
                    {pair.benefit}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
