"use client";

import { useCallback, useEffect, useState } from "react";
import { KurukinPlayer } from "kurukin-video-player-pkg";
import "kurukin-video-player-pkg/style.css";

import {
  RichHeadline,
  cx,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import { resolveLeadCaptureModalConfig } from "@/components/public-funnel/lead-capture-modal-config";
import { resolveLeadflowBlockMedia } from "@/components/public-funnel/leadflow-media-resolver";
import {
  asBoolean,
  asNumber,
  asRecord,
  asString,
  normalizeRuntimeBlockType,
} from "@/components/public-funnel/runtime-block-utils";
import { resolveRuntimeVariables } from "@/components/public-funnel/runtime-variables";
import { TrackedCta } from "@/components/public-funnel/tracked-cta";
import type {
  JsonValue,
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";

type HeroVslDelayedCtaBlockProps = {
  block: RuntimeBlock;
  runtime: PublicFunnelRuntimePayload;
  blocks: RuntimeBlock[];
  isBoxed?: boolean;
};

const MEDIA_REFERENCE_PREFIX = "media:";
const REVEAL_TIMEOUT_BUFFER_MS = 1250;

const resolveVideoProvider = (value: string, videoUrl: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "youtube" || normalized === "html5" || normalized === "bunnynet") {
    return normalized;
  }

  const normalizedUrl = videoUrl.toLowerCase();
  if (normalizedUrl.includes("youtube.com") || normalizedUrl.includes("youtu.be")) {
    return "youtube";
  }

  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(videoUrl)) {
    return "html5";
  }

  return "bunnynet";
};

const resolveMediaReference = ({
  runtime,
  block,
  value,
  fallbackAlt,
}: {
  runtime: PublicFunnelRuntimePayload;
  block: RuntimeBlock;
  value: JsonValue | undefined;
  fallbackAlt: string;
}) => {
  const rawValue = asString(value);
  const candidate = rawValue.startsWith(MEDIA_REFERENCE_PREFIX)
    ? rawValue.slice(MEDIA_REFERENCE_PREFIX.length)
    : rawValue;
  const media = resolveLeadflowBlockMedia({
    runtime,
    block,
    fallbackAlt,
    candidate,
    leadflowMetadata:
      block.leadflow_metadata ?? block.metadata ?? runtime.funnel.settingsJson,
  });

  return media?.src ?? "";
};

const renderHighlightedHeadline = (headline: string, highlight: string) => {
  const trimmedHighlight = highlight.trim();
  if (!trimmedHighlight) {
    return <RichHeadline text={headline} />;
  }

  const highlightIndex = headline.indexOf(trimmedHighlight);
  if (highlightIndex < 0) {
    return <RichHeadline text={headline} />;
  }

  const before = headline.slice(0, highlightIndex);
  const after = headline.slice(highlightIndex + trimmedHighlight.length);

  return (
    <>
      {before}
      <span className="rounded-sm bg-vsl-highlight px-1 py-0.5">
        {trimmedHighlight}
      </span>
      {after}
    </>
  );
};

export function HeroVslDelayedCtaBlock({
  block,
  runtime,
  blocks,
  isBoxed = false,
}: HeroVslDelayedCtaBlockProps) {
  const content = asRecord(block.content) ?? {};
  const behavior = asRecord(block.behavior) ?? {};
  const eyebrow = resolveRuntimeVariables(
    asString(content.eyebrow, asString(block.eyebrow)),
    runtime,
  );
  const headline = resolveRuntimeVariables(
    asString(content.headline, asString(block.headline)),
    runtime,
  );
  const highlight = resolveRuntimeVariables(asString(content.highlight), runtime);
  const subheadline = resolveRuntimeVariables(
    asString(content.subheadline, asString(block.subheadline)),
    runtime,
  );
  const ctaText = resolveRuntimeVariables(
    asString(content.cta_text, asString(block.cta_text, "Continuar")),
    runtime,
  );
  const stickyTitle = resolveRuntimeVariables(
    asString(content.sticky_title, headline),
    runtime,
  );
  const stickySubtitle = resolveRuntimeVariables(
    asString(content.sticky_subtitle, subheadline),
    runtime,
  );
  const posterTitle = resolveRuntimeVariables(
    asString(content.poster_title, headline || "Ver mensaje"),
    runtime,
  );
  const posterDescription = resolveRuntimeVariables(
    asString(content.poster_description, subheadline || "Haz clic para ver el video."),
    runtime,
  );
  const posterButtonText = resolveRuntimeVariables(
    asString(content.poster_button_text, "Ver ahora"),
    runtime,
  );
  const revealAfterSeconds = Math.max(
    0,
    asNumber(behavior.reveal_after_seconds, asNumber(block.reveal_after_seconds, 10)),
  );
  const showStickyCta = asBoolean(
    behavior.show_sticky_cta ?? block.show_sticky_cta,
    true,
  );
  const ctaMode = asString(behavior.cta_mode, asString(block.cta_mode, "modal"));
  const resumePlayback = asBoolean(
    behavior.resume_playback ?? block.resume_playback,
    true,
  );
  const progressBarColor = asString(
    behavior.vsl_progress_bar_color,
    asString(block.vsl_progress_bar_color, "var(--theme-section-video-progress-bar, var(--theme-button-primary-rest-bg))"),
  );
  const videoUrl = resolveMediaReference({
    runtime,
    block,
    value: content.video_url ?? block.video_url,
    fallbackAlt: posterTitle,
  });
  const posterImageUrl = resolveMediaReference({
    runtime,
    block,
    value:
      content.poster_image_url ??
      content.poster_image_key ??
      block.poster_image_url ??
      block.poster_image_key,
    fallbackAlt: posterTitle,
  });
  const provider = resolveVideoProvider(
    asString(content.provider, asString(block.provider)),
    videoUrl,
  );
  const leadCaptureConfigBlock =
    blocks.find(
      (candidate) =>
        normalizeRuntimeBlockType(candidate.type) === "lead_capture_config",
    ) ?? null;
  const hasModalConfig = Boolean(resolveLeadCaptureModalConfig(leadCaptureConfigBlock));
  const ctaAction =
    ctaMode === "modal" || ctaMode === "drawer"
      ? "open_lead_capture_modal"
      : asString(block.action) || null;
  const ctaHref =
    ctaAction === "open_lead_capture_modal" && hasModalConfig
      ? "#lead-capture-modal"
      : asString(block.href, "#public-capture-form");
  const [hasRevealed, setHasRevealed] = useState(false);
  const hasCtaRevealed = revealAfterSeconds <= 0 || hasRevealed;

  const handleTimeUpdate = useCallback(
    (currentTime: number) => {
      if (currentTime >= revealAfterSeconds) {
        setHasRevealed((current) => (current ? current : true));
      }
    },
    [revealAfterSeconds],
  );

  useEffect(() => {
    if (hasCtaRevealed) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setHasRevealed(true);
    }, revealAfterSeconds * 1000 + REVEAL_TIMEOUT_BUFFER_MS);

    return () => window.clearTimeout(timeout);
  }, [hasCtaRevealed, revealAfterSeconds]);

  if (!videoUrl) {
    return null;
  }

  return (
    <section
      id={asString(block.key) || undefined}
      className={cx(
        "relative overflow-hidden bg-slate-950 text-white",
        isBoxed ? "rounded-theme border [border-color:var(--theme-base-divider)]" : "",
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,1))]" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl content-center gap-8 px-4 py-10 md:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:py-14">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="text-xs font-bold uppercase text-emerald-300 md:text-sm">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-4 text-4xl font-black leading-none md:text-6xl lg:text-7xl">
            {renderHighlightedHeadline(headline, highlight)}
          </h1>
          {subheadline ? (
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              {subheadline}
            </p>
          ) : null}

          {hasCtaRevealed ? (
            <div className="mt-7">
              <TrackedCta
                publicationId={runtime.publication.id}
                currentStepId={runtime.currentStep.id}
                currentPath={runtime.request.path}
                href={ctaHref}
                label={ctaText}
                className="inline-flex min-h-14 items-center justify-center rounded-xl bg-emerald-400 px-6 py-4 text-center text-base font-black text-slate-950 shadow-[0_18px_44px_rgba(16,185,129,0.28)] transition hover:-translate-y-0.5 hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
                action={ctaAction}
              />
            </div>
          ) : null}
        </div>

        <div className="w-full">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
            <div className="aspect-video">
              <KurukinPlayer
                provider={provider}
                videoId={videoUrl}
                vslMode={true}
                vslProgressBarColor={progressBarColor}
                resumePlayback={resumePlayback}
                onTimeUpdate={handleTimeUpdate}
                hideYoutubeUi={provider === "youtube"}
                smartPoster={{
                  imageUrl: posterImageUrl || undefined,
                  eyebrow: "VSL",
                  title: posterTitle,
                  description: posterDescription,
                  buttonText: posterButtonText,
                }}
                className="h-full !aspect-auto !rounded-none"
              />
            </div>
          </div>
        </div>
      </div>

      {hasCtaRevealed && showStickyCta ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/94 px-4 py-3 text-white shadow-[0_-18px_50px_rgba(0,0,0,0.32)] backdrop-blur md:px-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold md:text-base">{stickyTitle}</p>
              {stickySubtitle ? (
                <p className="mt-1 text-xs text-slate-300 md:text-sm">
                  {stickySubtitle}
                </p>
              ) : null}
            </div>
            <TrackedCta
              publicationId={runtime.publication.id}
              currentStepId={runtime.currentStep.id}
              currentPath={runtime.request.path}
              href={ctaHref}
              label={ctaText}
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-emerald-400 px-5 py-3 text-center text-sm font-black text-slate-950 shadow-[0_14px_32px_rgba(16,185,129,0.24)] transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              action={ctaAction}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
