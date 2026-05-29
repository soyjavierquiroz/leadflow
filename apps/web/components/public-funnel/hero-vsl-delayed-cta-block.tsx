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
      <span className="text-amber-400">{trimmedHighlight}</span>
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
    <>
      <section
        id={asString(block.key) || undefined}
        className={cx(
          "relative left-1/2 min-h-screen w-screen -translate-x-1/2 overflow-hidden bg-black text-white",
          isBoxed ? "rounded-none border-0" : "",
        )}
      >
        <div className="relative mx-auto grid min-h-screen w-full max-w-7xl content-center items-center gap-6 px-5 py-10 md:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-16">
          <div className="max-w-3xl text-left">
            {eyebrow ? (
              <p className="text-center text-xs font-bold uppercase tracking-[0.24em] text-amber-400 lg:text-left lg:tracking-[0.32em]">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="mx-auto mt-4 max-w-sm text-center text-[2.25rem] font-bold leading-[0.95] md:max-w-2xl md:text-5xl lg:mx-0 lg:max-w-none lg:text-left lg:text-7xl lg:leading-[1.02]">
              {renderHighlightedHeadline(headline, highlight)}
            </h1>
            {subheadline ? (
              <p className="mt-6 hidden max-w-2xl text-left text-lg leading-7 text-zinc-300 lg:block">
                {subheadline}
              </p>
            ) : null}
          </div>

          <div className="flex w-full justify-center lg:justify-end">
            <div className="w-full max-w-[360px] overflow-hidden rounded-[2rem] border border-zinc-800 bg-black shadow-[0_24px_90px_rgba(0,0,0,0.55)] md:max-w-[420px]">
              <div className="aspect-[3/4] h-full w-full">
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
                  className="h-full w-full !aspect-auto !rounded-none [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
                />
              </div>
            </div>
          </div>

          {subheadline ? (
            <p className="mx-auto mt-0 max-w-sm text-center text-base leading-7 text-zinc-300 lg:hidden">
              {subheadline}
            </p>
          ) : null}
        </div>
      </section>

      {hasCtaRevealed && showStickyCta ? (
        <div className="fixed bottom-0 left-0 right-0 z-[60] text-white">
          <div className="absolute inset-0 border-t border-white/10 bg-black/90 shadow-[0_-18px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl" />
          <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 p-4 md:flex-row md:gap-8 md:px-6 md:py-4">
            <div className="hidden min-w-0 flex-1 text-left md:block">
              <p className="text-lg font-bold text-white">
                {stickyTitle}
              </p>
              {stickySubtitle ? (
                <p className="mt-1 text-sm text-slate-400">
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
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-3 text-center text-sm font-black uppercase tracking-[0.12em] text-black shadow-[0_14px_34px_rgba(251,191,36,0.25)] transition hover:-translate-y-0.5 hover:from-amber-200 hover:to-orange-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 md:h-14 md:w-auto md:min-w-[320px] md:px-8 md:py-4"
              action={ctaAction}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
