"use client";

import { useEffect, useMemo, useState } from "react";

import { cx } from "@/components/public-funnel/adapters/public-funnel-primitives";
import { resolveLeadflowBlockMedia } from "@/components/public-funnel/leadflow-media-resolver";
import type { RuntimeMediaItem } from "@/components/public-funnel/runtime-block-utils";
import type {
  PublicFunnelRuntimePayload,
} from "@/lib/public-funnel-runtime.types";

type StickyMediaGalleryProps = {
  runtime: PublicFunnelRuntimePayload;
  blocks: unknown[];
  className?: string;
};

const GALLERY_MAP_KEYS = [
  "hero",
  "gallery_1",
  "gallery_2",
  "gallery_3",
  "gallery_4",
  "gallery_5",
] as const;

function pushUniqueMedia(
  collection: RuntimeMediaItem[],
  seen: Set<string>,
  candidate: RuntimeMediaItem | null,
) {
  const normalizedSrc = normalizeGalleryMediaSrc(candidate?.src);

  if (!candidate?.src || !normalizedSrc) {
    return;
  }

  if (seen.has(normalizedSrc)) {
    return;
  }

  seen.add(normalizedSrc);
  collection.push({
    ...candidate,
    src: normalizedSrc,
  });
}

function isRenderableMediaSrc(src?: string | null) {
  if (!src?.trim()) {
    return false;
  }

  try {
    const url = new URL(src);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeGalleryMediaSrc(src?: string | null) {
  if (!src?.trim()) {
    return null;
  }

  try {
    const url = new URL(src);

    if (url.pathname.endsWith("/_next/image")) {
      const nestedUrl = url.searchParams.get("url");

      if (!nestedUrl) {
        return src;
      }

      return decodeURIComponent(nestedUrl);
    }

    return src;
  } catch {
    return src;
  }
}

function resolveGalleryImages(
  runtime: PublicFunnelRuntimePayload,
) {
  const items: RuntimeMediaItem[] = [];
  const seen = new Set<string>();
  const sharedMetadata = runtime.funnel.settingsJson;

  for (const key of GALLERY_MAP_KEYS) {
    pushUniqueMedia(
      items,
      seen,
      resolveLeadflowBlockMedia({
        runtime,
        fallbackAlt: `${runtime.funnel.name} ${key.replaceAll("_", " ")}`,
        candidate: key,
        fallbackMapKeys: [key],
        leadflowMetadata: sharedMetadata,
      }),
    );
  }

  return items;
}

export function StickyMediaGallery({
  runtime,
  blocks: _blocks,
  className,
}: StickyMediaGalleryProps) {
  const images = useMemo(
    () => resolveGalleryImages(runtime),
    [runtime],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedSources, setFailedSources] = useState<string[]>([]);

  const visibleImages = useMemo(
    () =>
      images.filter(
        (image) =>
          isRenderableMediaSrc(image.src) && !failedSources.includes(image.src),
      ),
    [failedSources, images],
  );

  const handleMediaError = (src: string) => {
    setFailedSources((current) =>
      current.includes(src) ? current : [...current, src],
    );
  };

  useEffect(() => {
    if (!visibleImages.length) {
      setSelectedIndex(0);
      return;
    }

    if (selectedIndex > visibleImages.length - 1) {
      setSelectedIndex(0);
    }
  }, [selectedIndex, visibleImages.length]);

  useEffect(() => {
    if (visibleImages.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setSelectedIndex((current) => (current + 1) % visibleImages.length);
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [visibleImages.length]);

  if (!visibleImages.length) {
    return null;
  }

  const activeImage =
    visibleImages[Math.min(selectedIndex, visibleImages.length - 1)] ??
    visibleImages[0];

  if (!activeImage) {
    return (
      <aside
        className={cx(
          "flex h-full w-full flex-col items-center justify-start bg-black",
          className,
        )}
      />
    );
  }

  return (
    <aside
      className={cx(
        "flex h-full w-full flex-col items-center justify-start bg-black",
        className,
      )}
    >
      <div className="flex h-full w-full flex-col items-center justify-start px-8 xl:px-12">
        <div className="mx-auto flex w-full max-w-[44rem] flex-col items-center justify-start space-y-4 lg:space-y-6">
          <div className="mx-auto flex aspect-square w-full max-w-[85%] items-center justify-center overflow-hidden rounded-[40px] border border-slate-800 bg-slate-900 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage.src}
              alt={activeImage.alt}
              loading="eager"
              onError={() => handleMediaError(activeImage.src)}
              className="h-full w-full rounded-[2.5rem] object-contain p-4"
            />
          </div>

          {visibleImages.length > 1 ? (
            <div className="grid w-full max-w-[28rem] grid-cols-3 gap-3 pb-1 sm:max-w-[34rem] sm:grid-cols-5">
              {visibleImages.map((image, index) => {
                const isActive = index === selectedIndex;

                return (
                  <button
                    key={`${image.src}-${index}`}
                    type="button"
                    onClick={() => setSelectedIndex(index)}
                    className={cx(
                      "aspect-square min-w-0 overflow-hidden rounded-xl border bg-slate-950/80 transition",
                      isActive
                        ? "border-amber-500 shadow-[0_0_0_1px_rgba(245,158,11,0.3)]"
                        : "border-slate-800 hover:border-emerald-500/50",
                    )}
                    aria-label={`Ver imagen ${index + 1}`}
                    aria-pressed={isActive}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.src}
                      alt={image.alt}
                      loading="lazy"
                      onError={() => handleMediaError(image.src)}
                      className="h-full w-full object-cover object-center"
                    />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
