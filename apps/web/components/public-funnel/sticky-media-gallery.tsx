"use client";

import { useEffect, useMemo, useState } from "react";

import { cx } from "@/components/public-funnel/adapters/public-funnel-primitives";
import { resolveLeadflowBlockMedia } from "@/components/public-funnel/leadflow-media-resolver";
import { asString, type RuntimeMediaItem } from "@/components/public-funnel/runtime-block-utils";
import type {
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";

type StickyMediaGalleryProps = {
  runtime: PublicFunnelRuntimePayload;
  blocks: RuntimeBlock[];
  className?: string;
};

const GALLERY_MAP_KEYS = [
  "hero",
  "gallery_1",
  "gallery_2",
  "gallery_3",
  "gallery_4",
  "gallery_5",
  "gallery_6",
  "product_box",
  "heroImage",
  "image",
  "seo_cover",
] as const;

const BLOCK_MEDIA_KEYS = [
  "hero_image_url",
  "heroImageUrl",
  "image_url",
  "imageUrl",
  "media_url",
  "mediaUrl",
  "image_key",
  "imageKey",
  "media_key",
  "mediaKey",
  "asset_key",
  "assetKey",
] as const;

function pushUniqueMedia(
  collection: RuntimeMediaItem[],
  seen: Set<string>,
  candidate: RuntimeMediaItem | null,
) {
  if (!candidate?.src) {
    return;
  }

  if (seen.has(candidate.src)) {
    return;
  }

  seen.add(candidate.src);
  collection.push(candidate);
}

function resolveGalleryImages(
  runtime: PublicFunnelRuntimePayload,
  blocks: RuntimeBlock[],
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

  for (const block of blocks) {
    const fallbackAlt =
      asString(block.headline) ||
      asString(block.title) ||
      asString(block.offer_name) ||
      runtime.funnel.name;

    pushUniqueMedia(
      items,
      seen,
      resolveLeadflowBlockMedia({
        runtime,
        block,
        fallbackAlt,
        candidate: block.media_url ?? block.media ?? block.image,
        preferBlockKeys: [...BLOCK_MEDIA_KEYS],
        fallbackMapKeys: [...GALLERY_MAP_KEYS],
        leadflowMetadata:
          block.leadflow_metadata ?? block.metadata ?? sharedMetadata,
      }),
    );
  }

  return items;
}

export function StickyMediaGallery({
  runtime,
  blocks,
  className,
}: StickyMediaGalleryProps) {
  const images = useMemo(
    () => resolveGalleryImages(runtime, blocks),
    [blocks, runtime],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!images.length) {
      setSelectedIndex(0);
      return;
    }

    if (selectedIndex > images.length - 1) {
      setSelectedIndex(0);
    }
  }, [images.length, selectedIndex]);

  if (!images.length) {
    return null;
  }

  const activeImage = images[Math.min(selectedIndex, images.length - 1)] ?? images[0];

  return (
    <aside
      className={cx(
        "hidden bg-black lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-full lg:flex-col lg:justify-center",
        className,
      )}
    >
      <div className="w-full px-8 py-8 xl:px-12">
        <div className="mx-auto flex w-full max-w-[44rem] flex-col justify-center">
          <div className="overflow-hidden rounded-[1.75rem] border border-amber-500/20 bg-slate-950/70 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage.src}
              alt={activeImage.alt}
              loading="lazy"
              className="aspect-square w-full object-cover object-center"
            />
          </div>

          {images.length > 1 ? (
              <div className="mt-4 flex justify-center gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {images.map((image, index) => {
                  const isActive = index === selectedIndex;

                  return (
                    <button
                      key={`${image.src}-${index}`}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className={cx(
                        "overflow-hidden rounded-xl border bg-slate-950/80 transition",
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
                        className="h-20 w-20 object-cover object-center"
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
