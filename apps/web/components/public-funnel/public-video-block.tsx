"use client";

import { useEffect, useState } from "react";
import { KurukinPlayer } from "kurukin-video-player-pkg";
import "kurukin-video-player-pkg/style.css";

import { resolveLeadflowBlockMedia } from "@/components/public-funnel/leadflow-media-resolver";
import {
  asBoolean,
  asString,
} from "@/components/public-funnel/runtime-block-utils";
import type {
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

type PublicVideoBlockProps = {
  block: RuntimeBlock;
  runtime: PublicFunnelRuntimePayload;
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}

function resolveVideoProvider(value: string) {
  switch (value) {
    case "youtube":
    case "html5":
    case "bunnynet":
      return value;
    default:
      return "bunnynet";
  }
}

export function PublicVideoBlock({
  block,
  runtime,
}: PublicVideoBlockProps) {
  const [mounted, setMounted] = useState(false);
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const provider = resolveVideoProvider(asString(block.provider, "bunnynet"));
  const desktopVideoId = asString(block.video_id);
  const mobileVideoId = asString(block.video_id_mobile);
  const desktopRatio = asString(block.aspect_ratio_desktop, "16/9");
  const mobileRatio = asString(block.aspect_ratio_mobile, "9/16");
  const vslMode = asBoolean(block.vsl_mode, true);
  const title = asString(block.title, "Video principal");
  const topBannerText = asString(block.top_banner_text);
  const topBannerTextMobile = asString(block.top_banner_text_mobile);
  const baseRatio = desktopRatio || "16/9";
  const fallbackBannerText = topBannerTextMobile || topBannerText;

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeVideoId =
    isMobile && mobileVideoId ? mobileVideoId : desktopVideoId;
  const ratio = isMobile ? mobileRatio || "9/16" : desktopRatio || "16/9";
  const resolvedBannerText =
    isMobile && topBannerTextMobile ? topBannerTextMobile : topBannerText;
  const hasBanner = Boolean(fallbackBannerText);
  const posterMedia = resolveLeadflowBlockMedia({
    runtime,
    block,
    fallbackAlt: `${title} poster`,
    candidate: block.poster_image_key,
    preferBlockKeys: ["poster_image_key"],
    leadflowMetadata:
      block.leadflow_metadata ?? block.metadata ?? runtime.funnel.settingsJson,
  });

  if (!desktopVideoId) {
    return null;
  }

  return (
    <div
      className="flex w-full flex-col"
      style={{
        boxShadow: "var(--theme-section-video-shadow)",
      }}
    >
      {hasBanner ? (
        <div
          className="flex min-h-11 items-center justify-center px-4 py-3 text-center text-sm font-semibold tracking-[0.02em] rounded-t-xl md:text-base"
          style={{
            backgroundColor: "var(--theme-section-video-banner-bg)",
            color: "var(--theme-section-video-banner-text)",
            fontFamily: "var(--theme-text-subheadline-font-family)",
            fontWeight: "var(--theme-text-subheadline-font-weight)",
          }}
        >
          {mounted ? resolvedBannerText || fallbackBannerText : fallbackBannerText}
        </div>
      ) : null}

      <div
        className={hasBanner ? "overflow-hidden rounded-b-xl" : "overflow-hidden rounded-xl"}
        style={{ aspectRatio: mounted ? ratio : baseRatio }}
      >
        {!mounted ? (
          <div className="relative h-full w-full animate-pulse bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.88))]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_38%)]" />
          </div>
        ) : (
          <KurukinPlayer
            provider={provider}
            videoId={activeVideoId}
            vslMode={vslMode}
            vslProgressBarColor="var(--theme-section-video-progress-bar, var(--theme-button-primary-rest-bg))"
            lazyLoadYoutube={provider === "youtube" && !vslMode}
            hideYoutubeUi={provider === "youtube"}
            smartPoster={
              posterMedia
                ? {
                    imageUrl: posterMedia.src,
                    eyebrow: "VSL",
                    title,
                    description:
                      "Activa el audio para iniciar la presentacion desde el comienzo.",
                    buttonText: "Ver ahora",
                  }
                : undefined
            }
            className="h-full !aspect-auto !rounded-none"
          />
        )}
      </div>
    </div>
  );
}
