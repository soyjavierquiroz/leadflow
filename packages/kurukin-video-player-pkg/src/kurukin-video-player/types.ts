import type { VideoProvider } from './providers/IVideoProvider';

export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export interface MutedPreviewConfig {
  enabled: boolean;
  overlayImageUrl?: string;
  overlayPosition?: OverlayPosition;
  buttonText?: string;
  fallbackColor?: string;
  fallbackText1?: string;
  fallbackText2?: string;
}

export interface CallToActionConfig {
  enabled: boolean;
  displayAtSeconds: number;
  headline: string;
  buttonText: string;
  buttonUrl: string;
  isDismissible?: boolean;
}

export interface SmartPosterConfig {
  enabled?: boolean;
  imageUrl?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  buttonText?: string;
}

export interface KurukinPlayerProps {
  provider: VideoProvider;
  videoId: string;
  vslMode?: boolean;
  vslProgressBarColor?: string;
  mutedPreview?: MutedPreviewConfig;
  lazyLoadYoutube?: boolean;
  stickyOnScroll?: boolean;
  stickyScroll?: boolean;
  resumePlayback?: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  callToAction?: CallToActionConfig;
  hideYoutubeUi?: boolean;
  smartPoster?: SmartPosterConfig;
  className?: string;
}

export interface PlayerState {
  isReady: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  inMutedPreview: boolean;
  showPoster: boolean;
  showCta: boolean;
  autoplayBlocked: boolean;
  isSticky: boolean;
}
