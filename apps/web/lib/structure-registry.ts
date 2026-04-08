export type StructureDef = {
  id: string;
  name: string;
  description: string;
  thumbnailPath: string;
};

export const AVAILABLE_STRUCTURES: StructureDef[] = [
  {
    id: "sticky-split",
    name: "Split Layout Asimétrico",
    description:
      "Media sticky a pantalla completa en desktop y columna de bloques con scroll para funnels con narrativa secuencial.",
    thumbnailPath: "/assets/placeholders/sticky-split.png",
  },
];
