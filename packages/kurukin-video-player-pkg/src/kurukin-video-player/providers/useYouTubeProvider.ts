import { useEffect, useRef } from 'react';
import { createProviderEventHub } from './createProviderEventHub';
import { subscribeProviderCallbacks } from './subscribeProviderCallbacks';
import type { IVideoProvider, ProviderBinding, ProviderHookOptions } from './IVideoProvider';
import type Plyr from 'plyr';

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
    let player: Plyr | null = null;
    let loopEnabled = loop;
    let disposed = false;
    let unsubscribeCallbacks: Array<() => void> = [];

    const provider: IVideoProvider = {
      async play() {
        try {
          await Promise.resolve(player?.play());
        } catch (error) {
          eventHub.emit('autoplayblocked');
          throw error;
        }
      },
      pause() {
        player?.pause();
      },
      mute(nextMuted) {
        if (!player) {
          return;
        }

        player.muted = nextMuted;
        eventHub.emit('mutechange', player.muted);
      },
      seek(seconds) {
        if (!player) {
          return;
        }

        player.currentTime = seconds;
        eventHub.emit('progress', player.currentTime);
      },
      setLoop(nextLoop) {
        loopEnabled = nextLoop;
      },
      destroy() {
        eventHub.clear();
        player?.destroy();
      },
      getCurrentTime() {
        return player?.currentTime || 0;
      },
      getDuration() {
        return player && Number.isFinite(player.duration) ? player.duration : 0;
      },
      isMuted() {
        return player?.muted ?? false;
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

    unsubscribeCallbacks = subscribeProviderCallbacks(provider, {
      onReady: (activeProvider) => callbacksRef.current.onReady?.(activeProvider),
      onPlay: () => callbacksRef.current.onPlay?.(),
      onPause: () => callbacksRef.current.onPause?.(),
      onProgress: (currentTime) => callbacksRef.current.onProgress?.(currentTime),
      onEnded: () => callbacksRef.current.onEnded?.(),
      onMuteChange: (nextMuted) => callbacksRef.current.onMuteChange?.(nextMuted),
      onAutoplayBlocked: () => callbacksRef.current.onAutoplayBlocked?.(),
    });
    providerRef.current = provider;

    const initializePlayer = async () => {
      const { default: Plyr } = await import('plyr');

      if (disposed) {
        return;
      }

      container.dataset.plyrProvider = 'youtube';
      container.dataset.plyrEmbedId = videoId;

      player = new Plyr(container, {
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
        eventHub.emit('progress', player?.currentTime ?? 0);
      });

      player.on('volumechange', () => {
        eventHub.emit('mutechange', player?.muted ?? false);
      });

      player.on('ended', () => {
        if (loopEnabled) {
          player?.restart();
          void Promise.resolve(player?.play()).catch(() => undefined);
          return;
        }

        eventHub.emit('ended');
      });
    };

    void initializePlayer().catch((error) => {
      console.error('[KurukinPlayer] No se pudo inicializar Plyr.', error);
      eventHub.emit('autoplayblocked');
    });

    return () => {
      disposed = true;
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
