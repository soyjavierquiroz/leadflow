import type { MutableRefObject } from 'react';

export type VideoProvider = 'youtube' | 'bunnynet' | 'vimeo' | 'wistia' | 'html5';
export type ControlsVariant = 'standard' | 'minimal' | 'vsl';

export interface IVideoProviderEvents {
  ready: (provider: IVideoProvider) => void;
  play: () => void;
  pause: () => void;
  progress: (currentTime: number) => void;
  ended: () => void;
  mutechange: (muted: boolean) => void;
  autoplayblocked: () => void;
}

export interface IVideoProvider {
  play(): Promise<void>;
  pause(): void;
  mute(muted: boolean): void;
  seek(seconds: number): void;
  setLoop(loop: boolean): void;
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  isMuted(): boolean;
  onReady(callback: IVideoProviderEvents['ready']): () => void;
  onPlay(callback: IVideoProviderEvents['play']): () => void;
  onPause(callback: IVideoProviderEvents['pause']): () => void;
  onProgress(callback: IVideoProviderEvents['progress']): () => void;
  onEnded(callback: IVideoProviderEvents['ended']): () => void;
  onMuteChange(callback: IVideoProviderEvents['mutechange']): () => void;
  onAutoplayBlocked(callback: IVideoProviderEvents['autoplayblocked']): () => void;
}

export interface ProviderLifecycleCallbacks {
  onReady?: (provider: IVideoProvider) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onProgress?: (currentTime: number) => void;
  onEnded?: () => void;
  onMuteChange?: (muted: boolean) => void;
  onAutoplayBlocked?: () => void;
}

export interface ProviderHookOptions extends ProviderLifecycleCallbacks {
  enabled: boolean;
  videoId: string;
  muted: boolean;
  autoPlay: boolean;
  loop: boolean;
  hideNativeUi?: boolean;
  controlsVariant?: ControlsVariant;
}

export interface ProviderBinding<TElement extends HTMLElement> {
  mountRef: MutableRefObject<TElement | null>;
  providerRef: MutableRefObject<IVideoProvider | null>;
}
