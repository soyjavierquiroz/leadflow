import { Play, Volume2 } from 'lucide-react';

interface VslOverlayProps {
  onUnmute: () => void;
}

export function VslOverlay({ onUnmute }: VslOverlayProps) {
  return (
    <button
      type="button"
      onClick={onUnmute}
      aria-label="Activar sonido"
      className="group absolute inset-0 z-50 cursor-pointer"
    >
      <span
        className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-left shadow-[0_10px_28px_rgba(0,0,0,0.22)] ring-1 ring-white/10 backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5" style={{ color: '#f5c96b' }}>
          <Volume2 className="h-4 w-4 animate-pulse" fill="currentColor" />
        </span>
        <span className="text-[11px] font-light uppercase tracking-[0.14em] sm:text-xs" style={{ color: '#f5c96b' }}>
          CLIC PARA ACTIVAR SONIDO
        </span>
      </span>

      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span
          className="flex h-28 w-28 items-center justify-center rounded-full ring-1 ring-white/10 backdrop-blur-[2px] transition-transform duration-200 ease-out motion-safe:group-hover:scale-105 sm:h-32 sm:w-32"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', color: 'rgba(255, 255, 255, 0.15)' }}
        >
          <Play className="ml-1 h-14 w-14 fill-current drop-shadow-[0_8px_18px_rgba(0,0,0,0.18)] sm:h-16 sm:w-16" />
        </span>
      </span>
    </button>
  );
}
