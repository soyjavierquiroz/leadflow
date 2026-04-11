import Hls from 'hls.js';
import { useEffect, useRef } from 'react';
import { createProviderEventHub } from './createProviderEventHub';
import { bindNativeVideoEvents, createNativeVideoProvider } from './nativeVideoProvider';
import { subscribeProviderCallbacks } from './subscribeProviderCallbacks';
import type { ProviderBinding, ProviderHookOptions } from './IVideoProvider';

export function useBunnyProvider({
  enabled,
  videoId,
  muted,
  autoPlay,
  loop,
  onReady,
  onPlay,
  onPause,
  onProgress,
  onEnded,
  onMuteChange,
  onAutoplayBlocked,
}: ProviderHookOptions): ProviderBinding<HTMLVideoElement> {
  const mountRef = useRef<HTMLVideoElement | null>(null);
  const providerRef = useRef<ReturnType<typeof createNativeVideoProvider> | null>(null);
  const callbacksRef = useRef({
    onReady,
    onPlay,
    onPause,
    onProgress,
    onEnded,
    onMuteChange,
    onAutoplayBlocked,
  });

  useEffect(() => {
    callbacksRef.current = {
      onReady,
      onPlay,
      onPause,
      onProgress,
      onEnded,
      onMuteChange,
      onAutoplayBlocked,
    };
  }, [onAutoplayBlocked, onEnded, onMuteChange, onPause, onPlay, onProgress, onReady]);

  useEffect(() => {
    if (!enabled || !mountRef.current) {
      return;
    }

    const videoElement = mountRef.current;
    console.log('[BunnyProvider] Inicializando stream (SOLO UNA VEZ):', videoId);
    const eventHub = createProviderEventHub();
    const provider = createNativeVideoProvider(videoElement, eventHub);
    const unsubscribeCallbacks = subscribeProviderCallbacks(provider, {
      onReady: (activeProvider) => callbacksRef.current.onReady?.(activeProvider),
      onPlay: () => callbacksRef.current.onPlay?.(),
      onPause: () => callbacksRef.current.onPause?.(),
      onProgress: (currentTime) => callbacksRef.current.onProgress?.(currentTime),
      onEnded: () => callbacksRef.current.onEnded?.(),
      onMuteChange: (nextMuted) => callbacksRef.current.onMuteChange?.(nextMuted),
      onAutoplayBlocked: () => callbacksRef.current.onAutoplayBlocked?.(),
    });
    let hls: Hls | null = null;
    let readyEmitted = false;

    const notifyReady = () => {
      if (readyEmitted) {
        return;
      }

      readyEmitted = true;
      eventHub.emit('ready', provider);
    };

    providerRef.current = provider;
    videoElement.playsInline = true;
    videoElement.preload = 'metadata';
    videoElement.muted = muted;
    videoElement.autoplay = autoPlay;
    videoElement.loop = loop;

    const cleanupEvents = bindNativeVideoEvents(videoElement, eventHub, notifyReady);

    if (Hls.isSupported()) {
      hls = new Hls({
        startLevel: 2,
        capLevelToPlayerSize: true,
      });
      hls.loadSource(videoId);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        notifyReady();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('[BunnyProvider HLS Error]:', data.type, data.details, data.fatal);
      });
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = videoId;
      console.log('[BunnyProvider] Usando fallback nativo HLS para Safari:', videoId);
    } else {
      console.warn('[KurukinPlayer] HLS no es compatible en este navegador para Bunny.net.');
    }

    return () => {
      cleanupEvents();
      unsubscribeCallbacks.forEach((unsubscribe) => unsubscribe());
      hls?.destroy();
      provider.destroy();
      providerRef.current = null;
    };
  }, [enabled, videoId]);

  useEffect(() => {
    if (!enabled || !mountRef.current) {
      return;
    }

    mountRef.current.autoplay = autoPlay;
  }, [autoPlay, enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    providerRef.current?.mute(muted);
  }, [enabled, muted]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    providerRef.current?.setLoop(loop);
  }, [enabled, loop]);

  return {
    mountRef,
    providerRef,
  };
}
