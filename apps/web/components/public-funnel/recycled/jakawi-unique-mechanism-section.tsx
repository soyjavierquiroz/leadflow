import type { CSSProperties, ReactNode } from "react";

import {
  cx,
  flatBlockTitleClassName,
  PublicSectionSurface,
  RichHeadline,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import type { RuntimeMediaItem } from "@/components/public-funnel/runtime-block-utils";
import { jakawiPremiumThemeStyle } from "@/styles/templates/jakawi-premium";

type UniqueMechanismStepItem = {
  title?: string;
  text?: string;
};

type UniqueMechanismPairItem = {
  feature?: string;
  benefit?: string;
};

type JakawiUniqueMechanismSectionProps = {
  isBoxed?: boolean;
  variant?: "default" | "flat";
  headline?: string;
  mechanismName?: string;
  steps: UniqueMechanismStepItem[];
  pairs: UniqueMechanismPairItem[];
  media?: RuntimeMediaItem | null;
  mediaNode?: ReactNode;
  hideDesktopMedia?: boolean;
};

export function JakawiUniqueMechanismSection({
  isBoxed = false,
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
    <PublicSectionSurface
      isBoxed={isBoxed}
      variant={variant}
      className="text-[var(--lf-unique-text-main)]"
      style={
        {
          ...jakawiPremiumThemeStyle,
          "--lf-unique-primary": "var(--jakawi-success)",
          "--lf-unique-text-main":
            variant === "flat" ? "var(--jakawi-text-main)" : "var(--jakawi-text-on-dark)",
          "--lf-unique-card-bg":
            variant === "flat" ? "var(--jakawi-content-bg)" : "var(--jakawi-surface-dark)",
        } as CSSProperties
      }
    >
      <div className="space-y-7">
        {headline ? (
          <h3
            className={cx(
              "max-w-4xl leading-tight",
              variant === "flat"
                ? flatBlockTitleClassName
                : "text-3xl font-black tracking-tight text-slate-100 md:text-4xl",
            )}
          >
            <RichHeadline text={headline} className="font-black" />
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
            <p className="mt-3 text-lg font-bold leading-snug text-slate-950 md:text-xl">
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
                    <h4 className="text-base font-bold leading-snug text-slate-950">
                      {step.title}
                    </h4>
                  ) : null}
                  {step.text ? (
                    <p className="mt-2 text-[15px] leading-relaxed text-slate-700">
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
            <div className="flex min-h-[280px] items-center justify-center rounded-[1.6rem] border border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
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
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
                    {pair.benefit}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </PublicSectionSurface>
  );
}
