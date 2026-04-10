import type { RuntimeBlock } from "@/lib/public-funnel-runtime.types";
import {
  asString,
  normalizeRuntimeBlockType,
} from "@/components/public-funnel/runtime-block-utils";

type PublicAnnouncementBannerProps = {
  blocks: RuntimeBlock[];
};

function resolveAnnouncementText(block: RuntimeBlock) {
  return (
    asString(block.text) ||
    asString(block.message) ||
    asString(block.content) ||
    asString(block.label) ||
    asString(block.title) ||
    asString(block.headline) ||
    asString(block.announcement_text) ||
    asString(block.marquee_text)
  );
}

export function PublicAnnouncementBanner({
  blocks,
}: PublicAnnouncementBannerProps) {
  const announcementBlock = blocks.find((block) => {
    const type = normalizeRuntimeBlockType(block.type);
    return type === "announcement" || type === "marquee";
  });

  if (!announcementBlock) {
    return null;
  }

  const text = resolveAnnouncementText(announcementBlock).trim();
  if (!text) {
    return null;
  }

  const repeatedContent = Array.from({ length: 6 }, (_, index) => (
    <span
      key={`${text}-${index}`}
      className="inline-flex items-center gap-12 pr-32 text-white font-bold md:gap-16 md:pr-40"
    >
      <span className="inline-flex items-center text-white font-bold">
        {text}
      </span>
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 rounded-full bg-white/80"
      />
      <span aria-hidden="true" className="inline-block w-20 md:w-24" />
      <span aria-hidden="true" className="font-bold text-white/80">
        —
      </span>
      <span aria-hidden="true" className="inline-block w-20 md:w-24" />
    </span>
  ));

  return (
    <div className="w-full overflow-hidden bg-[#00BC7D] py-3 text-white shadow-[0_18px_40px_rgba(0,188,125,0.22)]">
      <div className="announcement-marquee flex w-max min-w-full items-center whitespace-nowrap">
        <div className="flex shrink-0 items-center px-6 text-sm font-extrabold tracking-[0.22em] text-white md:px-8 md:text-base">
          {repeatedContent}
        </div>
        <div
          aria-hidden="true"
          className="flex shrink-0 items-center px-6 text-sm font-extrabold tracking-[0.22em] text-white md:px-8 md:text-base"
        >
          {repeatedContent}
        </div>
      </div>
      <style>{`
        @keyframes public-announcement-marquee {
          0% {
            transform: translate3d(0, 0, 0);
          }

          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }

        .announcement-marquee {
          animation: public-announcement-marquee 72s linear infinite;
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
