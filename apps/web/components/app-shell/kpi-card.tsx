type KpiCardProps = {
  label: string;
  value: string;
  hint: string;
};

export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <article className="w-full rounded-[1.75rem] border border-app-border bg-[linear-gradient(180deg,var(--app-surface)_0%,var(--app-card)_100%)] p-5 text-left shadow-[0_20px_50px_rgba(15,23,42,0.07)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
        {label}
      </p>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-app-text">
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-app-text-muted">{hint}</p>
      <div className="mt-4 h-1.5 w-14 rounded-full bg-[linear-gradient(90deg,_#0f172a_0%,_#14b8a6_100%)]" />
    </article>
  );
}
