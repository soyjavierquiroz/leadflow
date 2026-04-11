import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import type { MutedPreviewConfig, OverlayPosition } from '../types';

const POSITION_CLASSES: Record<OverlayPosition, string> = {
  center: 'items-center justify-center',
  'top-left': 'items-start justify-start p-6',
  'top-right': 'items-start justify-end p-6',
  'bottom-left': 'items-end justify-start p-6',
  'bottom-right': 'items-end justify-end p-6',
};

interface MutedOverlayProps {
  config: MutedPreviewConfig;
  onActivateSound: () => void;
}

export function MutedOverlay({ config, onActivateSound }: MutedOverlayProps) {
  const [imageError, setImageError] = useState(false);
  const overlayPosition = config.overlayPosition || 'center';

  useEffect(() => {
    setImageError(false);
  }, [config.overlayImageUrl]);

  return (
    <button
      type="button"
      onClick={onActivateSound}
      className={`absolute inset-0 z-20 flex bg-black/30 ${POSITION_CLASSES[overlayPosition]}`}
    >
      {config.overlayImageUrl && !imageError ? (
        <img
          src={config.overlayImageUrl}
          alt={config.buttonText || 'Activar sonido'}
          className="h-auto w-auto max-h-full max-w-full object-contain drop-shadow-2xl transition-transform duration-300 hover:scale-105"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-left backdrop-blur-md">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full animate-pulse"
            style={{
              backgroundColor: config.fallbackColor || '#f39c12',
              boxShadow: `0 0 20px ${config.fallbackColor || '#f39c12'}66`,
            }}
          >
            <Volume2 className="h-6 w-6 text-white" fill="currentColor" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-extrabold tracking-[0.16em] text-white">
              {config.fallbackText1 || 'CLICK PARA'}
            </span>
            <span className="mt-1 text-sm font-extrabold tracking-[0.16em] text-white">
              {config.fallbackText2 || 'ACTIVAR SONIDO'}
            </span>
          </div>
        </div>
      )}
    </button>
  );
}
