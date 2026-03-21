type KpiCardProps = {
  label: string;
  value: string;
  hint: string;
};

export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <article className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{hint}</p>
    </article>
  );
}
