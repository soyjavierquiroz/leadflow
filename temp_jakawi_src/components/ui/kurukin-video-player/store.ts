import { create } from 'zustand';
import type { PlayerState } from './types';

// Extendemos el estado con las funciones para actualizarlo
interface PlayerStore extends PlayerState {
  setIsReady: (ready: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setCurrentTime: (time: number) => void;
  setInMutedPreview: (inPreview: boolean) => void;
  setShowLazyCover: (show: boolean) => void;
  setShowCta: (show: boolean) => void;
  setIsSticky: (sticky: boolean) => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  // Valores iniciales
  isReady: false,
  isPlaying: false,
  isMuted: false,
  currentTime: 0,
  inMutedPreview: false,
  showLazyCover: false,
  showCta: false,
  isSticky: false,

  // Acciones para cambiar los valores
  setIsReady: (ready) => set({ isReady: ready }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setIsMuted: (muted) => set({ isMuted: muted }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setInMutedPreview: (inPreview) => set({ inMutedPreview: inPreview }),
  setShowLazyCover: (show) => set({ showLazyCover: show }),
  setShowCta: (show) => set({ showCta: show }),
  setIsSticky: (sticky) => set({ isSticky: sticky }),
}));
