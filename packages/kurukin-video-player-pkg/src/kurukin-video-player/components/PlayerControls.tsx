import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

type PlayerControlsVariant = 'standard' | 'minimal';

interface PlayerControlsProps {
  currentTime: number;
  duration: number;
  isMuted: boolean;
  isPlaying: boolean;
  onRestart: () => void;
  onSeek: (seconds: number) => void;
  onToggleMute: () => void;
  onTogglePlay: () => void;
  variant?: PlayerControlsVariant;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const safeSeconds = Math.floor(seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function PlayerControls({
  currentTime,
  duration,
  isMuted,
  isPlaying,
  onRestart,
  onSeek,
  onToggleMute,
  onTogglePlay,
  variant = 'standard',
}: PlayerControlsProps) {
  const safeDuration = duration > 0 ? duration : Math.max(currentTime, 1);
  const isMinimal = variant === 'minimal';

  return (
    <div
      className={
        isMinimal
          ? 'kurukin-vsl-controls absolute inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-black/55 via-black/10 to-transparent px-4 pb-4 pt-10'
          : 'absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/82 via-black/38 to-transparent px-3 pb-3 pt-7'
      }
    >
      <div
        className={
          isMinimal
            ? 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-2.5 py-2 text-white backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.24)]'
            : 'rounded-2xl border border-white/10 bg-black/28 px-3 py-2.5 backdrop-blur-md'
        }
      >
        {!isMinimal ? (
          <input
            type="range"
            min={0}
            max={safeDuration}
            step={0.1}
            value={Math.min(currentTime, safeDuration)}
            onChange={(event) => onSeek(Number(event.target.value))}
            className="h-1 w-full cursor-pointer accent-white/90"
            aria-label="Buscar en el video"
          />
        ) : null}

        <div className={isMinimal ? 'flex items-center gap-2 text-white' : 'mt-2.5 flex flex-wrap items-center gap-2 text-white'}>
          <button
            type="button"
            onClick={onTogglePlay}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/10 transition hover:bg-white/15"
            aria-label={isPlaying ? 'Pausar video' : 'Reproducir video'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/10 transition hover:bg-white/15"
            aria-label={isMuted ? 'Activar sonido' : 'Silenciar video'}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {!isMinimal ? (
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/10 transition hover:bg-white/15"
              aria-label="Reiniciar video"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          ) : null}

          {!isMinimal ? (
            <div className="ml-auto text-xs font-medium text-white/72">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
