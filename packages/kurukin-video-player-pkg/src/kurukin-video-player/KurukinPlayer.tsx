import { useCallback, useEffect, useRef, useState } from 'react';
import 'plyr/dist/plyr.css';
import { Play } from 'lucide-react';
import { CallToActionOverlay } from './components/CallToActionOverlay';
import { FakeProgressBar } from './components/FakeProgressBar';
import { MutedOverlay } from './components/MutedOverlay';
import { PlayerControls } from './components/PlayerControls';
import { SmartPoster } from './components/SmartPoster';
import { VslOverlay } from './components/VslOverlay';
import { useVideoProviderController } from './providers/useVideoProviderController';
import type { IVideoProvider } from './providers/IVideoProvider';
import type { KurukinPlayerProps } from './types';

function formatClassName(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

export function KurukinPlayer({
  provider,
  videoId,
  vslMode = false,
  vslProgressBarColor,
  mutedPreview = { enabled: false, overlayPosition: 'center' },
  lazyLoadYoutube,
  stickyOnScroll,
  stickyScroll,
  resumePlayback = false,
  onTimeUpdate,
  callToAction,
  hideYoutubeUi,
  smartPoster,
  className,
}: KurukinPlayerProps) {
  const isVslMode = Boolean(vslMode);
  const isMutedPreviewEnabled = Boolean(mutedPreview.enabled) && !isVslMode;
  const shouldAutoPlay = isVslMode || isMutedPreviewEnabled;
  const isYoutubeLazyMode = provider === 'youtube' && Boolean(lazyLoadYoutube) && !shouldAutoPlay;
  const shouldApplyYoutubeUiHack = provider === 'youtube' && Boolean(hideYoutubeUi);
  const isProviderImplemented = provider === 'youtube' || provider === 'bunnynet' || provider === 'html5';
  const isStickyEnabled = Boolean(stickyOnScroll ?? stickyScroll);
  const controlsVariant = isVslMode ? 'vsl' : 'standard';
  const resumeStorageKey = `kurukin-player:resume:${provider}:${videoId}`;

  const [shouldLoadPlayer, setShouldLoadPlayer] = useState(!isYoutubeLazyMode);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(shouldAutoPlay);
  const [isVslMuted, setIsVslMuted] = useState(isVslMode);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [inMutedPreview, setInMutedPreview] = useState(isMutedPreviewEnabled);
  const [showMutedPreviewOverlay, setShowMutedPreviewOverlay] = useState(isMutedPreviewEnabled);
  const [showPoster, setShowPoster] = useState(isYoutubeLazyMode);
  const [ctaTriggered, setCtaTriggered] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const pendingPlayIntentRef = useRef<'autoplay' | 'user' | null>(shouldAutoPlay ? 'autoplay' : null);
  const hasRestoredPlaybackRef = useRef(false);
  const lastPersistedSecondRef = useRef(-1);

  const handleProviderReady = useCallback((activeProvider: IVideoProvider) => {
    setIsReady(true);
    setIsMuted(activeProvider.isMuted());
    setDuration(activeProvider.getDuration());
  }, []);

  const handleProviderPlay = useCallback(() => {
    setIsPlaying(true);
    setShowPoster(false);
    setAutoplayBlocked(false);
  }, []);

  const handleProviderPause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleProviderProgress = useCallback((seconds: number) => {
    setCurrentTime(seconds);
    onTimeUpdate?.(seconds);

    if (!resumePlayback || isVslMode) {
      return;
    }

    const roundedSecond = Math.floor(seconds);

    if (roundedSecond <= 0 || roundedSecond === lastPersistedSecondRef.current || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(resumeStorageKey, String(roundedSecond));
      lastPersistedSecondRef.current = roundedSecond;
    } catch (error) {
      console.warn('[KurukinPlayer] No se pudo persistir el progreso del video.', error);
    }
  }, [isVslMode, onTimeUpdate, resumePlayback, resumeStorageKey]);

  const handleProviderEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);

    if (!resumePlayback || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.removeItem(resumeStorageKey);
      lastPersistedSecondRef.current = -1;
    } catch (error) {
      console.warn('[KurukinPlayer] No se pudo limpiar el progreso guardado.', error);
    }
  }, [resumePlayback, resumeStorageKey]);

  const handleProviderMuteChange = useCallback((nextMuted: boolean) => {
    setIsMuted(nextMuted);
  }, []);

  const handleAutoplayBlocked = useCallback(() => {
    setAutoplayBlocked(true);
    setShowPoster(!isVslMode);
    setShowMutedPreviewOverlay(false);
    setIsPlaying(false);
  }, [isVslMode]);

  const controller = useVideoProviderController({
    provider,
    enabled: shouldLoadPlayer,
    videoId,
    autoPlay: shouldAutoPlay,
    muted: isMuted,
    loop: inMutedPreview,
    hideNativeUi: hideYoutubeUi,
    controlsVariant,
    onReady: handleProviderReady,
    onPlay: handleProviderPlay,
    onPause: handleProviderPause,
    onProgress: handleProviderProgress,
    onEnded: handleProviderEnded,
    onMuteChange: handleProviderMuteChange,
    onAutoplayBlocked: handleAutoplayBlocked,
  });

  const runPendingPlay = useCallback(async (activeProvider: IVideoProvider) => {
    const intent = pendingPlayIntentRef.current;

    if (!intent) {
      return;
    }

    pendingPlayIntentRef.current = null;

    try {
      await activeProvider.play();
      setShowPoster(false);
      setAutoplayBlocked(false);
    } catch (error) {
      activeProvider.pause();
      setShowPoster(!isVslMode);
      setShowMutedPreviewOverlay(false);

      if (intent === 'autoplay') {
        setAutoplayBlocked(true);
      }
    }
  }, [isVslMode]);

  useEffect(() => {
    const nextVslMode = Boolean(vslMode);
    const nextMutedPreviewEnabled = Boolean(mutedPreview.enabled) && !nextVslMode;
    const nextShouldAutoplay = nextVslMode || nextMutedPreviewEnabled;
    const lazyMode = provider === 'youtube' && Boolean(lazyLoadYoutube) && !nextShouldAutoplay;

    setShouldLoadPlayer(!lazyMode);
    setIsReady(false);
    setIsPlaying(false);
    setIsMuted(nextShouldAutoplay);
    setIsVslMuted(nextVslMode);
    setCurrentTime(0);
    setDuration(0);
    setInMutedPreview(nextMutedPreviewEnabled);
    setShowMutedPreviewOverlay(nextMutedPreviewEnabled);
    setShowPoster(lazyMode);
    setAutoplayBlocked(false);
    setCtaTriggered(false);
    setShowCta(false);
    hasRestoredPlaybackRef.current = false;
    lastPersistedSecondRef.current = -1;
    pendingPlayIntentRef.current = nextShouldAutoplay ? 'autoplay' : null;
  }, [provider, videoId, lazyLoadYoutube, mutedPreview.enabled, vslMode]);

  useEffect(() => {
    if (!shouldLoadPlayer || !isReady || !controller.providerRef.current) {
      return;
    }

    void runPendingPlay(controller.providerRef.current);
  }, [controller.providerRef, isReady, runPendingPlay, shouldLoadPlayer]);

  useEffect(() => {
    if (!isReady || duration > 0) {
      return;
    }

    const nextDuration = controller.providerRef.current?.getDuration() ?? 0;

    if (nextDuration > 0) {
      setDuration(nextDuration);
    }
  }, [controller.providerRef, currentTime, duration, isReady]);

  useEffect(() => {
    if (!resumePlayback || isVslMode || !isReady || hasRestoredPlaybackRef.current || typeof window === 'undefined') {
      return;
    }

    const activeProvider = controller.providerRef.current;

    if (!activeProvider) {
      return;
    }

    try {
      const savedTime = Number(window.localStorage.getItem(resumeStorageKey));

      if (!Number.isFinite(savedTime) || savedTime <= 0) {
        hasRestoredPlaybackRef.current = true;
        return;
      }

      const boundedTime = duration > 2 ? Math.min(savedTime, duration - 2) : savedTime;

      if (boundedTime <= 0) {
        hasRestoredPlaybackRef.current = true;
        return;
      }

      activeProvider.seek(boundedTime);
      setCurrentTime(boundedTime);
      lastPersistedSecondRef.current = Math.floor(boundedTime);
      hasRestoredPlaybackRef.current = true;
    } catch (error) {
      hasRestoredPlaybackRef.current = true;
      console.warn('[KurukinPlayer] No se pudo restaurar el progreso guardado.', error);
    }
  }, [controller.providerRef, duration, isReady, isVslMode, resumePlayback, resumeStorageKey]);

  useEffect(() => {
    if (!callToAction?.enabled || ctaTriggered || showCta || showMutedPreviewOverlay || isVslMuted) {
      return;
    }

    if (currentTime >= callToAction.displayAtSeconds) {
      setCtaTriggered(true);
      setShowCta(true);
      controller.providerRef.current?.pause();
    }
  }, [callToAction, controller.providerRef, ctaTriggered, currentTime, isVslMuted, showCta, showMutedPreviewOverlay]);

  const requestPlay = useCallback(
    async (intent: 'autoplay' | 'user', options?: { unmute: boolean; restartFromZero?: boolean }) => {
      pendingPlayIntentRef.current = intent;

      if (options?.restartFromZero) {
        setCurrentTime(0);
        controller.providerRef.current?.seek(0);
      }

      if (options?.unmute) {
        setIsMuted(false);
        setIsVslMuted(false);
        setInMutedPreview(false);
        setShowMutedPreviewOverlay(false);
        controller.providerRef.current?.mute(false);
        controller.providerRef.current?.setLoop(false);
      }

      if (!shouldLoadPlayer) {
        setShouldLoadPlayer(true);
        return;
      }

      if (!controller.providerRef.current) {
        return;
      }

      await runPendingPlay(controller.providerRef.current);
    },
    [controller.providerRef, runPendingPlay, shouldLoadPlayer],
  );

  const handlePosterPlay = useCallback(() => {
    const shouldUnmuteOnManualStart = autoplayBlocked || !isMutedPreviewEnabled || isVslMode;
    void requestPlay('user', { unmute: shouldUnmuteOnManualStart });
  }, [autoplayBlocked, isMutedPreviewEnabled, isVslMode, requestPlay]);

  const handleDismissCta = useCallback(() => {
    setShowCta(false);
    void requestPlay('user');
  }, [requestPlay]);

  const handleExitMutedPreview = useCallback(() => {
    controller.providerRef.current?.seek(0);
    setCurrentTime(0);
    void requestPlay('user', { unmute: true });
  }, [controller.providerRef, requestPlay]);

  const handleUnmute = useCallback(() => {
    setIsMuted(false);
    setIsVslMuted(false);
    controller.providerRef.current?.mute(false);
    controller.providerRef.current?.seek(0);
    setCurrentTime(0);
    void requestPlay('user', { unmute: true, restartFromZero: true });
  }, [controller.providerRef, requestPlay]);

  const handleResumeFromPauseOverlay = useCallback(() => {
    void requestPlay('user');
  }, [requestPlay]);

  const handleGlobalClick = useCallback(() => {
    const activeProvider = controller.providerRef.current;

    if (isVslMuted || showPoster || showCta) {
      return;
    }

    if (isPlaying) {
      activeProvider?.pause();
      return;
    }

    if (activeProvider) {
      void activeProvider.play().catch(() => {
        void requestPlay('user');
      });
      return;
    }

    void requestPlay('user');
  }, [controller.providerRef, isPlaying, isVslMuted, requestPlay, showCta, showPoster]);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      controller.providerRef.current?.pause();
      return;
    }

    void requestPlay('user');
  }, [controller.providerRef, isPlaying, requestPlay]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = !isMuted;

    setIsMuted(nextMuted);
    controller.providerRef.current?.mute(nextMuted);

    if (!nextMuted) {
      setInMutedPreview(false);
      setShowMutedPreviewOverlay(false);
      controller.providerRef.current?.setLoop(false);
    }
  }, [controller.providerRef, isMuted]);

  const handleSeek = useCallback(
    (seconds: number) => {
      setCurrentTime(seconds);
      controller.providerRef.current?.seek(seconds);
    },
    [controller.providerRef],
  );

  const handleRestart = useCallback(() => {
    handleSeek(0);
    void requestPlay('user');
  }, [handleSeek, requestPlay]);

  const posterTitle = autoplayBlocked
    ? smartPoster?.title || 'El navegador bloqueó el autoplay'
    : smartPoster?.title || 'Video listo para reproducir';

  const posterDescription = autoplayBlocked
    ? smartPoster?.description || 'Haz click para iniciar la reproducción manualmente.'
    : smartPoster?.description || 'Pulsa play para ver el video con nuestra experiencia premium.';

  const shouldShowPauseOverlay = !isVslMode && !isPlaying && isReady && !inMutedPreview && !isVslMuted && !showCta && !showPoster;
  const shouldShowControls = shouldLoadPlayer && isReady && !showPoster && !showCta && !showMutedPreviewOverlay && !isVslMuted;
  const shouldRenderCustomControls = !isVslMode && shouldShowControls;
  const shouldRenderFakeProgress = shouldLoadPlayer && isVslMode && !showPoster;
  const shouldRenderGlobalClickLayer = shouldLoadPlayer && isVslMode && !showPoster && !showCta;
  const shouldRenderVslPauseIndicator = isVslMode && !isVslMuted && !isPlaying && !showPoster && !showCta;
  const videoRef = controller.surface === 'video' ? controller.mountRef : undefined;

  return (
    <div
      className={formatClassName(
        'relative aspect-video w-full overflow-hidden rounded-2xl bg-black',
        shouldApplyYoutubeUiHack && '[&_iframe]:scale-[1.45] [&_iframe]:origin-center',
        className,
      )}
      data-provider={provider}
      data-vsl-mode={isVslMode ? 'true' : 'false'}
      data-sticky-enabled={isStickyEnabled ? 'true' : undefined}
    >
      {shouldLoadPlayer ? (
        <div className={formatClassName('h-full w-full', isVslMode && 'pointer-events-none')}>
          {controller.surface === 'video' ? (
            <video
              ref={videoRef}
              className={formatClassName('w-full h-full object-cover', isVslMode && 'pointer-events-none')}
              playsInline
              controls={false}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              controlsList={isVslMode ? 'nodownload noplaybackrate noremoteplayback' : undefined}
              disablePictureInPicture={isVslMode}
              muted={isMuted}
              autoPlay={shouldAutoPlay}
            />
          ) : (
            <div
              ref={controller.mountRef}
              className={formatClassName('w-full h-full object-cover', isVslMode && 'pointer-events-none')}
            />
          )}
        </div>
      ) : (
        <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_35%),linear-gradient(135deg,#0a0a0b,#111827)]" />
      )}

      <SmartPoster
        visible={showPoster}
        imageUrl={smartPoster?.imageUrl}
        eyebrow={
          autoplayBlocked
            ? smartPoster?.eyebrow || 'Autoplay bloqueado'
            : smartPoster?.eyebrow || (isYoutubeLazyMode ? 'Smart Poster' : 'Universal Video Engine')
        }
        title={posterTitle}
        description={posterDescription}
        buttonText={smartPoster?.buttonText || 'Reproducir video'}
        onPlay={handlePosterPlay}
      />

      {shouldLoadPlayer && isMutedPreviewEnabled && showMutedPreviewOverlay ? (
        <MutedOverlay config={mutedPreview} onActivateSound={handleExitMutedPreview} />
      ) : null}

      {shouldLoadPlayer && isVslMode && isVslMuted && !showPoster ? <VslOverlay onUnmute={handleUnmute} /> : null}

      {shouldRenderGlobalClickLayer ? (
        <button
          type="button"
          className="absolute inset-0 z-40 cursor-pointer bg-transparent"
          onClick={handleGlobalClick}
          aria-label={isPlaying ? 'Pausar video' : 'Reproducir video'}
        />
      ) : null}

      {shouldRenderFakeProgress ? (
        <FakeProgressBar color={vslProgressBarColor} currentTime={currentTime} duration={duration} />
      ) : null}

      {shouldRenderVslPauseIndicator ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-[2px] pointer-events-none transition-all">
          <div className="rounded-full bg-black/40 p-6 md:p-8">
            <svg className="ml-2 h-12 w-12 text-white/70 md:h-16 md:w-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      ) : null}

      {shouldShowPauseOverlay ? (
        <div
          className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/50 backdrop-blur-md"
          onClick={handleResumeFromPauseOverlay}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleResumeFromPauseOverlay();
            }
          }}
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur">
            <Play className="h-10 w-10 fill-white text-white" />
          </span>
        </div>
      ) : null}

      {shouldRenderCustomControls ? (
        <PlayerControls
          currentTime={currentTime}
          duration={duration}
          isMuted={isMuted}
          isPlaying={isPlaying}
          onRestart={handleRestart}
          onSeek={handleSeek}
          onToggleMute={handleToggleMute}
          onTogglePlay={handleTogglePlay}
          variant={controlsVariant === 'vsl' ? 'standard' : controlsVariant}
        />
      ) : null}

      {!isProviderImplemented ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-6 text-center text-white">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">Provider pendiente</p>
            <p className="mt-2 text-sm text-white/80">
              {provider} quedó preparado en la factory, pero su adapter aún no está implementado.
            </p>
          </div>
        </div>
      ) : null}

      {callToAction?.enabled && showCta ? (
        <CallToActionOverlay callToAction={callToAction} onDismiss={handleDismissCta} />
      ) : null}
    </div>
  );
}
