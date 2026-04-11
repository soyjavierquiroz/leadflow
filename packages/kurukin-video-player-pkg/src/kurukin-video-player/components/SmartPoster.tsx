import { Play } from 'lucide-react';

interface SmartPosterProps {
  imageUrl?: string;
  eyebrow?: string;
  title: string;
  description: string;
  buttonText: string;
  visible: boolean;
  onPlay: () => void;
}

export function SmartPoster({
  imageUrl,
  eyebrow,
  title,
  description,
  buttonText,
  visible,
  onPlay,
}: SmartPosterProps) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className={[
        'absolute inset-0 z-20 overflow-hidden transition duration-300',
        visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      ].join(' ')}
    >
      {imageUrl ? <img src={imageUrl} alt={title} className="absolute inset-0 h-full w-full object-cover" /> : null}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.25),transparent_45%),linear-gradient(135deg,rgba(9,9,11,0.88),rgba(9,9,11,0.96))]" />
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center text-white">
        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm">
          <Play className="ml-1 h-10 w-10 fill-white text-white" />
        </span>
        {eyebrow ? <span className="mt-6 text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300">{eyebrow}</span> : null}
        <h3 className="mt-3 max-w-2xl text-2xl font-bold md:text-3xl">{title}</h3>
        <p className="mt-3 max-w-xl text-sm text-white/80 md:text-base">{description}</p>
        <span className="mt-6 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-semibold backdrop-blur-sm">
          {buttonText}
        </span>
      </div>
    </button>
  );
}
