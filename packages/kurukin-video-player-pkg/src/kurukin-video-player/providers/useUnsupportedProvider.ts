import { useEffect, useRef } from 'react';
import type { IVideoProvider, ProviderBinding, ProviderHookOptions, VideoProvider } from './IVideoProvider';

const noop = () => undefined;
const noopUnsubscribe = () => noop;

function createUnsupportedProvider(provider: VideoProvider): IVideoProvider {
  return {
    async play() {
      console.warn(`[KurukinPlayer] Provider "${provider}" no implementado todavía.`);
    },
    pause() {
      console.warn(`[KurukinPlayer] Provider "${provider}" no implementado todavía.`);
    },
    mute() {
      console.warn(`[KurukinPlayer] Provider "${provider}" no implementado todavía.`);
    },
    seek() {
      console.warn(`[KurukinPlayer] Provider "${provider}" no implementado todavía.`);
    },
    setLoop() {
      console.warn(`[KurukinPlayer] Provider "${provider}" no implementado todavía.`);
    },
    destroy() {
      noop();
    },
    getCurrentTime() {
      return 0;
    },
    getDuration() {
      return 0;
    },
    isMuted() {
      return false;
    },
    onReady: noopUnsubscribe,
    onPlay: noopUnsubscribe,
    onPause: noopUnsubscribe,
    onProgress: noopUnsubscribe,
    onEnded: noopUnsubscribe,
    onMuteChange: noopUnsubscribe,
    onAutoplayBlocked: noopUnsubscribe,
  };
}

export function useUnsupportedProvider(
  provider: VideoProvider,
  { enabled }: ProviderHookOptions,
): ProviderBinding<HTMLDivElement> {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const providerRef = useRef<IVideoProvider | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    console.warn(`[KurukinPlayer] Provider "${provider}" no implementado todavía.`);
    providerRef.current = createUnsupportedProvider(provider);

    return () => {
      providerRef.current = null;
    };
  }, [enabled, provider]);

  return {
    mountRef,
    providerRef,
  };
}
