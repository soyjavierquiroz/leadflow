import { create } from 'zustand';
import type { PlayerState } from './types';

interface PlayerStore extends PlayerState {
  setIsReady: (ready: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setInMutedPreview: (inPreview: boolean) => void;
  setShowPoster: (show: boolean) => void;
  setShowCta: (show: boolean) => void;
  setAutoplayBlocked: (blocked: boolean) => void;
  setIsSticky: (sticky: boolean) => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  isReady: false,
  isPlaying: false,
  isMuted: false,
  currentTime: 0,
  duration: 0,
  inMutedPreview: false,
  showPoster: false,
  showCta: false,
  autoplayBlocked: false,
  isSticky: false,
  setIsReady: (ready) => set({ isReady: ready }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setIsMuted: (muted) => set({ isMuted: muted }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setInMutedPreview: (inPreview) => set({ inMutedPreview: inPreview }),
  setShowPoster: (show) => set({ showPoster: show }),
  setShowCta: (show) => set({ showCta: show }),
  setAutoplayBlocked: (blocked) => set({ autoplayBlocked: blocked }),
  setIsSticky: (sticky) => set({ isSticky: sticky }),
}));
