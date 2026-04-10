import type { ComponentType } from "react";

import { SplitMediaFocusLayout } from "@/components/structures/SplitMediaFocusLayout";

export type StructureDef = {
  id: string;
  name: string;
  description: string;
  image?: string;
  thumbnailPath?: string;
  componentImportPath: string;
  componentExportName: string;
};

export const AVAILABLE_STRUCTURES: StructureDef[] = [
  {
    id: "split-media-focus",
    name: "Split Media Focus (Sticky)",
    description:
      "Layout de alto impacto con media fijo a la izquierda y scroll de contenido a la derecha",
    image: "/assets/placeholders/sticky-split.png",
    thumbnailPath: "/assets/placeholders/sticky-split.png",
    componentImportPath: "@/components/structures/SplitMediaFocusLayout",
    componentExportName: "SplitMediaFocusLayout",
  },
];

const structureComponentRegistry: Record<string, ComponentType<any>> = {
  "split-media-focus": SplitMediaFocusLayout,
};

export const getStructureComponent = (structureId: string) => {
  return structureComponentRegistry[structureId] ?? null;
};
