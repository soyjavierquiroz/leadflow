"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KurukinPlayer } from "kurukin-video-player-pkg";
import "kurukin-video-player-pkg/style.css";

import {
  FunnelButtonContent,
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
import {
  useSubmissionContext,
  type StoredSubmissionContext,
} from "@/lib/public-funnel-session";
import { resolvePublicFunnelHandoffState } from "@/lib/public-funnel-assigned-sponsor";
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
  if (highlightIndex >= 0) {
    const before = headline.slice(0, highlightIndex);
    const after = headline.slice(highlightIndex + trimmedHighlight.length);

    return (
      <>
        <RichHeadline text={before} />
        <span className="text-amber-400">{trimmedHighlight}</span>
        <RichHeadline text={after} />
      </>
    );
  }

  if (headline.toLowerCase().includes(trimmedHighlight.toLowerCase())) {
    return <RichHeadline text={headline} />;
  }

  return (
    <>
      <RichHeadline text={headline} />{" "}
      <span className="text-amber-400">{trimmedHighlight}</span>
    </>
  );
};

const isRealAssignmentId = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return Boolean(normalized) && !normalized?.startsWith("runtime-");
};

const mergeRuntimeWithSubmissionContext = (
  runtime: PublicFunnelRuntimePayload,
  submissionContext: StoredSubmissionContext | null,
): PublicFunnelRuntimePayload => {
  if (!submissionContext) {
    return runtime;
  }

  const assignment =
    submissionContext.assignment ??
    submissionContext.lastAssignment ??
    runtime.assignment;
  const assignedSponsor =
    assignment?.sponsor ??
    submissionContext.handoff.sponsor ??
    runtime.assignedSponsor;

  return {
    ...runtime,
    leadId: submissionContext.leadId ?? runtime.leadId,
    assignment,
    advisor: submissionContext.advisor
      ? {
          ...submissionContext.advisor,
          role: submissionContext.advisor.role ?? null,
        }
      : runtime.advisor,
    assignedSponsor,
    handoff: {
      ...runtime.handoff,
      ...submissionContext.handoff,
      sponsor: submissionContext.handoff.sponsor ?? runtime.handoff.sponsor,
    },
  };
};

export function HeroVslDelayedCtaBlock({
  block,
  runtime,
  blocks,
  isBoxed = false,
}: HeroVslDelayedCtaBlockProps) {
  const content = asRecord(block.content) ?? {};
  const behavior = asRecord(block.behavior) ?? {};
  const submissionContext = useSubmissionContext(runtime.publication.id, runtime);
  const variableRuntime = useMemo(
    () => mergeRuntimeWithSubmissionContext(runtime, submissionContext),
    [runtime, submissionContext],
  );
  const handoffState = useMemo(
    () =>
      resolvePublicFunnelHandoffState({
        context: submissionContext,
        runtime,
      }),
    [runtime, submissionContext],
  );
  const eyebrow = resolveRuntimeVariables(
    asString(content.eyebrow, asString(block.eyebrow)),
    variableRuntime,
  );
  const headline = resolveRuntimeVariables(
    asString(content.headline, asString(block.headline)),
    variableRuntime,
  );
  const highlight = resolveRuntimeVariables(asString(content.highlight), variableRuntime);
  const subheadline = resolveRuntimeVariables(
    asString(content.subheadline, asString(block.subheadline)),
    variableRuntime,
  );
  const ctaText = resolveRuntimeVariables(
    asString(content.cta_text, asString(block.cta_text, "Continuar")),
    variableRuntime,
  );
  const stickyTitle = resolveRuntimeVariables(
    asString(content.sticky_title, headline),
    variableRuntime,
  );
  const stickySubtitle = resolveRuntimeVariables(
    asString(content.sticky_subtitle, subheadline),
    variableRuntime,
  );
  const posterTitle = resolveRuntimeVariables(
    asString(content.poster_title, headline || "Ver mensaje"),
    variableRuntime,
  );
  const posterDescription = resolveRuntimeVariables(
    asString(content.poster_description, subheadline || "Haz clic para ver el video."),
    variableRuntime,
  );
  const posterButtonText = resolveRuntimeVariables(
    asString(content.poster_button_text, "Ver ahora"),
    variableRuntime,
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
  const isAssignedWhatsappMode = ctaMode === "assigned_whatsapp";
  const realAssignmentId =
    submissionContext?.assignment?.id ??
    submissionContext?.lastAssignment?.id ??
    runtime.assignment?.id ??
    null;
  const canUseAssignedWhatsapp =
    isAssignedWhatsappMode &&
    isRealAssignmentId(realAssignmentId) &&
    Boolean(handoffState.whatsappUrl);
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
  const ctaAction = isAssignedWhatsappMode
    ? "assigned_whatsapp"
    : ctaMode === "modal" || ctaMode === "drawer"
      ? "open_lead_capture_modal"
      : asString(block.action) || null;
  const ctaHref = isAssignedWhatsappMode
    ? handoffState.whatsappUrl ?? "#"
    : ctaAction === "open_lead_capture_modal" && hasModalConfig
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

  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" ||
      !isAssignedWhatsappMode ||
      !hasCtaRevealed ||
      canUseAssignedWhatsapp
    ) {
      return;
    }

    console.warn(
      "[hero_vsl_delayed_cta] assigned_whatsapp requested but no assigned handoff WhatsApp URL is available.",
      {
        publicationId: runtime.publication.id,
        stepId: runtime.currentStep.id,
        assignmentId: realAssignmentId,
      },
    );
  }, [
    canUseAssignedWhatsapp,
    hasCtaRevealed,
    isAssignedWhatsappMode,
    realAssignmentId,
    runtime.currentStep.id,
    runtime.publication.id,
  ]);

  if (!videoUrl) {
    return null;
  }

  return (
    <>
      <div className="relative left-1/2 min-h-screen w-screen -translate-x-1/2 overflow-hidden bg-black text-white">
        <section
          id={asString(block.key) || undefined}
          className={cx(
            "relative overflow-hidden",
            isBoxed ? "rounded-none border-0" : "",
          )}
        >
          <div className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-amber-500/20 blur-[140px]" />
          <div className="pointer-events-none absolute -left-32 top-24 h-[24rem] w-[24rem] rounded-full bg-zinc-700/20 blur-[130px]" />
          <div className="pointer-events-none absolute -right-32 bottom-0 h-[26rem] w-[26rem] rounded-full bg-amber-900/20 blur-[150px]" />

          <div className="relative mx-auto grid max-w-7xl gap-5 px-4 pt-4 pb-16 sm:px-6 sm:pt-6 md:pt-8 md:pb-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-14 lg:py-24">
            <div className="text-center lg:hidden">
              {eyebrow ? (
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-amber-400">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="mt-4 text-3xl font-bold leading-[1.02] text-white sm:text-4xl md:text-5xl">
                {renderHighlightedHeadline(headline, highlight)}
              </h1>
            </div>

            <div className="hidden max-w-none lg:block">
              {eyebrow ? (
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-amber-400">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="mt-5 text-3xl font-bold leading-[1.02] text-white md:text-6xl">
                {renderHighlightedHeadline(headline, highlight)}
              </h1>
              {subheadline ? (
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
                  {subheadline}
                </p>
              ) : null}
            </div>

            <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
              <div className="absolute -inset-8 rounded-full bg-zinc-900/30 blur-[120px]" />
              <div className="relative overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 p-2 shadow-[0_40px_120px_rgba(0,0,0,0.65)] backdrop-blur-md">
                <div className="aspect-[3/4] overflow-hidden rounded-[1.5rem] bg-black">
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
              <p className="mx-auto max-w-2xl text-center text-base leading-relaxed text-slate-300 sm:text-lg md:text-xl lg:hidden">
                {subheadline}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {hasCtaRevealed && showStickyCta ? (
        <div className="fixed bottom-0 left-0 right-0 z-[60] animate-in fade-in slide-in-from-bottom-10 duration-700">
          <div className="absolute inset-0 border-t border-white/10 bg-black/90 backdrop-blur-xl" />
          <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-4 px-4 py-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:gap-8 md:py-4">
            <div className="min-w-0 text-center md:text-left">
              <p className="text-base font-bold leading-tight text-white md:text-lg">
                {stickyTitle}
              </p>
              {stickySubtitle ? (
                <p className="mt-1 text-xs font-medium leading-snug text-slate-400 md:text-sm">
                  {stickySubtitle}
                </p>
              ) : null}
            </div>
            {isAssignedWhatsappMode && !canUseAssignedWhatsapp ? (
              <button
                type="button"
                disabled
                className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-700 px-8 py-3 text-center text-base font-bold uppercase tracking-[0.08em] text-slate-300 opacity-70 shadow-[0_16px_32px_rgba(0,0,0,0.5)] md:w-[340px] lg:w-[380px] [&>span>span:first-child]:whitespace-nowrap"
              >
                <FunnelButtonContent text="WhatsApp no disponible" />
              </button>
            ) : (
              <TrackedCta
                publicationId={runtime.publication.id}
                currentStepId={runtime.currentStep.id}
                currentPath={runtime.request.path}
                href={ctaHref}
                label={ctaText}
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 px-8 py-3 text-center text-base font-bold uppercase tracking-[0.08em] text-slate-950 shadow-[0_16px_32px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.03] active:scale-95 md:w-[340px] lg:w-[380px] [&>span>span:first-child]:whitespace-nowrap"
                action={ctaAction}
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
