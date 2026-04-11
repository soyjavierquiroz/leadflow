declare module "kurukin-video-player-pkg" {
  import type { ComponentType } from "react";

  export type VideoProvider = "bunnynet" | "youtube" | "html5";

  export type SmartPosterConfig = {
    enabled?: boolean;
    imageUrl?: string;
    eyebrow?: string;
    title?: string;
    description?: string;
    buttonText?: string;
  };

  export type KurukinPlayerProps = {
    provider: VideoProvider;
    videoId: string;
    vslMode?: boolean;
    vslProgressBarColor?: string;
    lazyLoadYoutube?: boolean;
    hideYoutubeUi?: boolean;
    smartPoster?: SmartPosterConfig;
    className?: string;
  };

  export const KurukinPlayer: ComponentType<KurukinPlayerProps>;
}

declare module "kurukin-video-player-pkg/style.css";
