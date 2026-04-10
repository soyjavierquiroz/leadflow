import type { ReactNode } from "react";

import { SplitMediaFocusLayout } from "@/components/structures/SplitMediaFocusLayout";

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
    <SplitMediaFocusLayout
      className={className}
      mediaPanelClassName={mediaClassName}
      contentPanelClassName={blocksClassName}
      contentInnerClassName={blocksInnerClassName}
      mediaSlot={media}
      contentSlot={blocks}
    />
  );
}
