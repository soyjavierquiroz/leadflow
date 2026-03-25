type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92)_0%,_rgba(248,250,252,0.92)_100%)] p-8 text-center shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
        LF
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
