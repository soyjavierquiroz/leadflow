import { useEffect, useRef } from 'react';
import { createProviderEventHub } from './createProviderEventHub';
import { bindNativeVideoEvents, createNativeVideoProvider } from './nativeVideoProvider';
import { subscribeProviderCallbacks } from './subscribeProviderCallbacks';
import type { ProviderBinding, ProviderHookOptions } from './IVideoProvider';

export function useHtml5Provider({
  enabled,
  videoId,
  muted,
  autoPlay,
  loop,
  controlsVariant,
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
    videoElement.controls = false;
    videoElement.dataset.controlsVariant = controlsVariant || 'standard';
    videoElement.src = videoId;

    const cleanupEvents = bindNativeVideoEvents(videoElement, eventHub, notifyReady);

    return () => {
      cleanupEvents();
      unsubscribeCallbacks.forEach((unsubscribe) => unsubscribe());
      provider.destroy();
      providerRef.current = null;
    };
  }, [controlsVariant, enabled, videoId]);

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
