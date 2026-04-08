import type { ReactNode } from "react";

type StickySplitStructureProps = {
  media: ReactNode;
  blocks: ReactNode;
  className?: string;
  mediaClassName?: string;
  blocksClassName?: string;
  blocksInnerClassName?: string;
};

export function StickySplitStructure({
  media,
  blocks,
  className,
  mediaClassName,
  blocksClassName,
  blocksInnerClassName,
}: StickySplitStructureProps) {
  return (
    <div className={`grid min-h-screen lg:grid-cols-2 lg:gap-0 ${className ?? ""}`.trim()}>
      <div
        className={`hidden overflow-hidden bg-black lg:block lg:sticky lg:top-0 lg:h-screen ${
          mediaClassName ?? ""
        }`.trim()}
      >
        {media}
      </div>

      <div
        className={`min-h-screen bg-white px-6 pb-8 pt-0 text-slate-900 lg:px-20 lg:pb-12 lg:pt-4 ${
          blocksClassName ?? ""
        }`.trim()}
      >
        <div
          className={`mx-auto w-full max-w-[44rem] space-y-12 ${
            blocksInnerClassName ?? ""
          }`.trim()}
        >
          {blocks}
        </div>
      </div>
    </div>
  );
}
