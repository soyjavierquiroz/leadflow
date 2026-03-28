type ValueStackSummaryProps = {
  title?: string;
  items: string[];
};

export function ValueStackSummary({
  title = "Lo que obtendras hoy",
  items,
}: ValueStackSummaryProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-[1.6rem] border border-slate-800 bg-slate-900/50 px-5 py-5">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-100">
        {title}
      </p>
      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-black text-emerald-400">
              ✓
            </span>
            <p className="text-sm font-medium leading-6 text-slate-200">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
