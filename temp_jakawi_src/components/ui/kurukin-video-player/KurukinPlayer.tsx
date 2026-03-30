import { useEffect, useRef, useState } from 'react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { usePlayerStore } from './store'
import type { KurukinPlayerProps, OverlayPosition } from './types'

const POSITION_CLASSES: Record<OverlayPosition, string> = {
  center: 'items-center justify-center',
  'top-left': 'items-start justify-start p-6',
  'top-right': 'items-start justify-end p-6',
  'bottom-left': 'items-end justify-start p-6',
  'bottom-right': 'items-end justify-end p-6',
}

const ASPECT_RATIO_CLASSES: Record<NonNullable<KurukinPlayerProps['aspectRatio']>, string> = {
  video: 'aspect-video',
  standard: 'aspect-[4/3]',
  square: 'aspect-square',
  portrait: 'aspect-[9/16]',
  '3:4': 'aspect-[3/4]',
  auto: 'aspect-auto',
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72c0 .77.83 1.25 1.5.86l10.5-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
    </svg>
  )
}

function VolumeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
      <path d="M5 5h6" />
      <path d="M5 19h14V9" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  )
}

export function KurukinPlayer({
  provider,
  videoId,
  aspectRatio = 'video',
  autoPlay = false,
  mutedPreview = { enabled: false, overlayPosition: 'center' },
  lazyLoadYoutube,
  loop = false,
  callToAction,
  hideYoutubeUi,
  onPlay,
  onEnded,
}: KurukinPlayerProps) {
  const mediaRef = useRef<HTMLElement | null>(null)
  const playerRef = useRef<Plyr | null>(null)

  const mutedPreviewConfig =
    typeof mutedPreview === 'boolean'
      ? { enabled: mutedPreview, overlayPosition: 'center' as OverlayPosition }
      : {
          enabled: Boolean(mutedPreview?.enabled),
          overlayImageUrl: mutedPreview?.overlayImageUrl,
          overlayPosition: mutedPreview?.overlayPosition || 'center',
          buttonText: mutedPreview?.buttonText,
          fallbackColor: mutedPreview?.fallbackColor,
          fallbackText1: mutedPreview?.fallbackText1,
          fallbackText2: mutedPreview?.fallbackText2,
        }

  const isMutedPreviewEnabled = Boolean(mutedPreviewConfig.enabled)
  const isYoutubeLazyMode = provider === 'youtube' && Boolean(lazyLoadYoutube) && !isMutedPreviewEnabled
  const shouldApplyYoutubeUiHack = provider === 'youtube' && Boolean(hideYoutubeUi)
  const overlayPosition = mutedPreviewConfig.overlayPosition || 'center'
  const aspectClass = ASPECT_RATIO_CLASSES[aspectRatio] || ASPECT_RATIO_CLASSES.video

  const [shouldLoadPlayer, setShouldLoadPlayer] = useState(!isYoutubeLazyMode)
  const [shouldAutoplay, setShouldAutoplay] = useState(false)
  const [showMutedPreviewOverlay, setShowMutedPreviewOverlay] = useState(isMutedPreviewEnabled)
  const [ctaTriggered, setCtaTriggered] = useState(false)
  const [imageError, setImageError] = useState(false)

  const {
    isReady,
    isPlaying,
    inMutedPreview,
    showLazyCover: shouldShowLazyCover,
    currentTime,
    showCta,
    setIsReady,
    setIsPlaying,
    setIsMuted,
    setCurrentTime,
    setInMutedPreview,
    setShowLazyCover,
    setShowCta,
  } = usePlayerStore()

  useEffect(() => {
    const lazyMode = provider === 'youtube' && Boolean(lazyLoadYoutube) && !mutedPreviewConfig.enabled

    setShouldLoadPlayer(!lazyMode)
    setShouldAutoplay(false)
    setShowMutedPreviewOverlay(Boolean(mutedPreviewConfig.enabled))
    setCtaTriggered(false)

    setShowLazyCover(lazyMode)
    setInMutedPreview(Boolean(mutedPreviewConfig.enabled))
    setShowCta(false)
    setCurrentTime(0)
    setIsReady(false)
    setIsPlaying(false)
    setIsMuted(Boolean(mutedPreviewConfig.enabled))
  }, [
    provider,
    videoId,
    lazyLoadYoutube,
    mutedPreviewConfig.enabled,
    setCurrentTime,
    setInMutedPreview,
    setIsMuted,
    setIsPlaying,
    setIsReady,
    setShowCta,
    setShowLazyCover,
  ])

  useEffect(() => {
    setImageError(false)
  }, [mutedPreviewConfig.overlayImageUrl])

  useEffect(() => {
    if (!shouldLoadPlayer || !mediaRef.current) {
      return
    }

    if (playerRef.current) {
      playerRef.current.destroy()
      playerRef.current = null
    }

    const plyrRatio =
      aspectRatio === 'standard'
        ? '4:3'
        : aspectRatio === 'portrait'
          ? '9:16'
          : aspectRatio === '3:4'
            ? '3:4'
            : aspectRatio === 'square'
              ? '1:1'
              : '16:9'

    const youtubeOptions = {
      noCookie: true,
      rel: 0,
      showinfo: 0,
      playsinline: 1,
      vq: 'hd1080',
      modestbranding: hideYoutubeUi ? 1 : 0,
      iv_load_policy: hideYoutubeUi ? 3 : 1,
      loop: loop ? 1 : 0,
      ...(loop ? { playlist: videoId } : {}),
    }

    const options: Plyr.Options = {
      ratio: plyrRatio,
      autoplay: autoPlay || shouldAutoplay || isMutedPreviewEnabled,
      muted: isMutedPreviewEnabled,
      clickToPlay: true,
      loop: {
        active: Boolean(loop),
      },
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
      youtube: youtubeOptions as Plyr.Options['youtube'],
    }

    const player = new Plyr(mediaRef.current, options)
    playerRef.current = player

    player.on('ready', () => {
      setIsReady(true)
      setIsMuted(player.muted)

      if (isMutedPreviewEnabled) {
        player.muted = true
        void Promise.resolve(player.play()).catch(() => undefined)
      }

      if (shouldAutoplay || autoPlay) {
        void Promise.resolve(player.play()).catch(() => undefined)
      }
    })

    player.on('playing', () => {
      setIsPlaying(true)
      if (!isMutedPreviewEnabled) {
        onPlay?.()
      }
    })

    player.on('pause', () => {
      setIsPlaying(false)
    })

    player.on('timeupdate', () => {
      setCurrentTime(player.currentTime)
    })

    player.on('ended', () => {
      setIsPlaying(false)
      onEnded?.()
    })

    player.on('volumechange', () => {
      setIsMuted(player.muted)
    })

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [
    aspectRatio,
    hideYoutubeUi,
    isMutedPreviewEnabled,
    loop,
    autoPlay,
    setCurrentTime,
    setIsMuted,
    setIsPlaying,
    setIsReady,
    onPlay,
    onEnded,
    shouldAutoplay,
    shouldLoadPlayer,
  ])

  useEffect(() => {
    if (!callToAction?.enabled || ctaTriggered || showCta || showMutedPreviewOverlay) {
      return
    }

    if (currentTime >= callToAction.displayAtSeconds) {
      setCtaTriggered(true)
      setShowCta(true)
      playerRef.current?.pause()
    }
  }, [callToAction, ctaTriggered, currentTime, setShowCta, showCta, showMutedPreviewOverlay])

  const handleLoadYoutube = () => {
    setShouldLoadPlayer(true)
    setShouldAutoplay(true)
    setShowLazyCover(false)
    onPlay?.()
  }

  const handleExitMutedPreview = () => {
    const player = playerRef.current
    if (!player) {
      return
    }

    player.currentTime = 0
    player.muted = false
    player.loop = Boolean(loop)

    setShowMutedPreviewOverlay(false)
    setInMutedPreview(false)
    setIsMuted(false)
    setIsPlaying(true)
    onPlay?.()

    void Promise.resolve(player.play()).catch(() => undefined)
  }

  const handleDismissCta = () => {
    setShowCta(false)
    void Promise.resolve(playerRef.current?.play()).catch(() => undefined)
  }

  const handleResumeFromPauseOverlay = () => {
    onPlay?.()
    void Promise.resolve(playerRef.current?.play()).catch(() => undefined)
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl bg-black ${aspectClass} ${
        shouldApplyYoutubeUiHack ? '[&_iframe]:scale-[1.45] [&_iframe]:origin-center' : ''
      }`}
    >
      {isYoutubeLazyMode && !shouldLoadPlayer ? (
        <button
          type="button"
          onClick={handleLoadYoutube}
          className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800 transition hover:from-zinc-800 hover:to-zinc-700"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent_65%)]" />
          <div className="relative z-10 flex flex-col items-center gap-3 text-white">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/30 backdrop-blur">
              <PlayIcon className="h-10 w-10 fill-white" />
            </span>
            <span className="text-base font-semibold tracking-wide">Cargar video</span>
          </div>
        </button>
      ) : (
        <div className="h-full w-full">
          {provider === 'html5' ? (
            <video
              ref={(node) => {
                mediaRef.current = node
              }}
              className="h-full w-full"
              controls
              playsInline
            >
              <source src={videoId} />
            </video>
          ) : (
            <div
              ref={(node) => {
                mediaRef.current = node
              }}
              data-plyr-provider={provider}
              data-plyr-embed-id={videoId}
            />
          )}
        </div>
      )}

      {shouldLoadPlayer && isMutedPreviewEnabled && showMutedPreviewOverlay ? (
        <button
          type="button"
          onClick={handleExitMutedPreview}
          className={`absolute inset-0 z-20 flex bg-black/30 ${POSITION_CLASSES[overlayPosition]}`}
        >
          {mutedPreviewConfig.overlayImageUrl && !imageError ? (
            <img
              src={mutedPreviewConfig.overlayImageUrl}
              alt="Activar sonido"
              className="h-auto w-auto max-h-full max-w-full object-contain drop-shadow-2xl transition-transform duration-300 hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-2 backdrop-blur-md drop-shadow-2xl md:p-3">
              <div
                className="flex h-10 w-10 animate-pulse items-center justify-center rounded-full md:h-12 md:w-12"
                style={{
                  backgroundColor: mutedPreviewConfig.fallbackColor || '#f39c12',
                  boxShadow: `0 0 15px ${mutedPreviewConfig.fallbackColor || '#f39c12'}80`,
                }}
              >
                <VolumeIcon className="h-5 w-5 text-white md:h-6 md:w-6" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-extrabold leading-none tracking-wide text-white drop-shadow-md md:text-base">
                  {mutedPreviewConfig.fallbackText1 || 'CLICK PARA'}
                </span>
                <span className="mt-1 text-sm font-extrabold leading-none tracking-wide text-white drop-shadow-md md:text-base">
                  {mutedPreviewConfig.fallbackText2 || 'ACTIVAR SONIDO'}
                </span>
              </div>
            </div>
          )}
        </button>
      ) : null}

      {!isPlaying && isReady && !inMutedPreview && !showCta && !shouldShowLazyCover ? (
        <div
          className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/50 backdrop-blur-md"
          onClick={handleResumeFromPauseOverlay}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              handleResumeFromPauseOverlay()
            }
          }}
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur">
            <PlayIcon className="h-10 w-10 fill-white text-white" />
          </span>
        </div>
      ) : null}

      {callToAction?.enabled && showCta ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-6">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-zinc-950/95 p-6 text-center text-white shadow-2xl">
            {callToAction.isDismissible ? (
              <button
                type="button"
                onClick={handleDismissCta}
                className="absolute right-3 top-3 rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            ) : null}
            <h3 className="text-2xl font-bold leading-tight">{callToAction.headline}</h3>
            <a
              href={callToAction.buttonUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-base font-semibold text-black transition hover:bg-emerald-400"
            >
              {callToAction.buttonText}
              <ExternalLinkIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      ) : null}
    </div>
  )
}
