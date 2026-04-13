type KpiCardProps = {
  label: string;
  value: string;
  hint: string;
};

export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <article className="w-full rounded-[1.75rem] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,1)_0%,_rgba(248,250,252,0.96)_100%)] p-5 text-left shadow-[0_20px_50px_rgba(15,23,42,0.07)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{hint}</p>
      <div className="mt-4 h-1.5 w-14 rounded-full bg-[linear-gradient(90deg,_#0f172a_0%,_#14b8a6_100%)]" />
    </article>
  );
}
