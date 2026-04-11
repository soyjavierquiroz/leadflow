import { useEffect, useRef } from 'react';
import Plyr from 'plyr';
import { createProviderEventHub } from './createProviderEventHub';
import { subscribeProviderCallbacks } from './subscribeProviderCallbacks';
import type { IVideoProvider, ProviderBinding, ProviderHookOptions } from './IVideoProvider';

export function useYouTubeProvider({
  enabled,
  videoId,
  muted,
  autoPlay,
  loop,
  hideNativeUi,
  controlsVariant = 'standard',
  onReady,
  onPlay,
  onPause,
  onProgress,
  onEnded,
  onMuteChange,
  onAutoplayBlocked,
}: ProviderHookOptions): ProviderBinding<HTMLDivElement> {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const providerRef = useRef<IVideoProvider | null>(null);
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

    const eventHub = createProviderEventHub();
    const container = mountRef.current;
    const shouldUseZeroUi = controlsVariant === 'vsl' || controlsVariant === 'minimal' || hideNativeUi;
    const controls = shouldUseZeroUi
      ? []
      : ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'];

    container.dataset.plyrProvider = 'youtube';
    container.dataset.plyrEmbedId = videoId;

    const player = new Plyr(container, {
      autoplay: autoPlay,
      muted,
      clickToPlay: false,
      controls,
      youtube: {
        noCookie: true,
        rel: 0,
        showinfo: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        controls: 0,
        disablekb: 1,
        playsinline: 1,
      },
    });

    let loopEnabled = loop;

    const provider: IVideoProvider = {
      async play() {
        try {
          await Promise.resolve(player.play());
        } catch (error) {
          eventHub.emit('autoplayblocked');
          throw error;
        }
      },
      pause() {
        player.pause();
      },
      mute(nextMuted) {
        player.muted = nextMuted;
        eventHub.emit('mutechange', player.muted);
      },
      seek(seconds) {
        player.currentTime = seconds;
        eventHub.emit('progress', player.currentTime);
      },
      setLoop(nextLoop) {
        loopEnabled = nextLoop;
      },
      destroy() {
        eventHub.clear();
        player.destroy();
      },
      getCurrentTime() {
        return player.currentTime || 0;
      },
      getDuration() {
        return Number.isFinite(player.duration) ? player.duration : 0;
      },
      isMuted() {
        return player.muted;
      },
      onReady(callback) {
        return eventHub.on('ready', callback);
      },
      onPlay(callback) {
        return eventHub.on('play', callback);
      },
      onPause(callback) {
        return eventHub.on('pause', callback);
      },
      onProgress(callback) {
        return eventHub.on('progress', callback);
      },
      onEnded(callback) {
        return eventHub.on('ended', callback);
      },
      onMuteChange(callback) {
        return eventHub.on('mutechange', callback);
      },
      onAutoplayBlocked(callback) {
        return eventHub.on('autoplayblocked', callback);
      },
    };

    const unsubscribeCallbacks = subscribeProviderCallbacks(provider, {
      onReady: (activeProvider) => callbacksRef.current.onReady?.(activeProvider),
      onPlay: () => callbacksRef.current.onPlay?.(),
      onPause: () => callbacksRef.current.onPause?.(),
      onProgress: (currentTime) => callbacksRef.current.onProgress?.(currentTime),
      onEnded: () => callbacksRef.current.onEnded?.(),
      onMuteChange: (nextMuted) => callbacksRef.current.onMuteChange?.(nextMuted),
      onAutoplayBlocked: () => callbacksRef.current.onAutoplayBlocked?.(),
    });
    providerRef.current = provider;

    player.on('ready', () => {
      eventHub.emit('ready', provider);
    });

    player.on('playing', () => {
      eventHub.emit('play');
    });

    player.on('pause', () => {
      eventHub.emit('pause');
    });

    player.on('timeupdate', () => {
      eventHub.emit('progress', player.currentTime);
    });

    player.on('volumechange', () => {
      eventHub.emit('mutechange', player.muted);
    });

    player.on('ended', () => {
      if (loopEnabled) {
        player.restart();
        void Promise.resolve(player.play()).catch(() => undefined);
        return;
      }

      eventHub.emit('ended');
    });

    return () => {
      unsubscribeCallbacks.forEach((unsubscribe) => unsubscribe());
      provider.destroy();
      providerRef.current = null;
    };
  }, [controlsVariant, enabled, hideNativeUi, videoId]);

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
