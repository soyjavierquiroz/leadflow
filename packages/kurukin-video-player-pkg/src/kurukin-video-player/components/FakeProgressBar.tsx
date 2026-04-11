interface FakeProgressBarProps {
  color?: string;
  currentTime: number;
  duration: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPsychologicalProgress(currentTime: number, duration: number) {
  const safeCurrentTime = Number.isFinite(currentTime) ? Math.max(currentTime, 0) : 0;
  const safeDuration = duration > 0 ? duration : 1000;
  let progress = 0;

  if (safeCurrentTime <= 20) {
    progress = (safeCurrentTime / 20) * 30;
  } else if (safeCurrentTime <= safeDuration * 0.5) {
    const middlePhaseDuration = Math.max(safeDuration * 0.5 - 20, 1);
    progress = 30 + ((safeCurrentTime - 20) / middlePhaseDuration) * 40;
  } else {
    const finalPhaseDuration = Math.max(safeDuration * 0.5, 1);
    progress = 70 + ((safeCurrentTime - safeDuration * 0.5) / finalPhaseDuration) * 28;
  }

  return clamp(progress, 0, 98);
}

export function FakeProgressBar({ color, currentTime, duration }: FakeProgressBarProps) {
  const progress = getPsychologicalProgress(currentTime, duration);

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[60] h-[6px] w-full overflow-hidden bg-black/20" aria-hidden="true">
      <div
        className="h-full transition-all duration-300 ease-linear rounded-r-full"
        style={{
          width: `${progress}%`,
          backgroundColor: color || '#10b981',
        }}
      />
    </div>
  );
}
