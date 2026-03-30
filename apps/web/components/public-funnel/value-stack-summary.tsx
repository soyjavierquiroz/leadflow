export type ValueStackItem = {
  title: string;
  description?: string;
  valueText?: string;
  priceText?: string;
};

type ValueStackSummaryProps = {
  title?: string;
  items: Array<string | ValueStackItem>;
};

export function ValueStackSummary({
  title = "Lo que obtendras hoy",
  items,
}: ValueStackSummaryProps) {
  const normalizedItems = items
    .map((item) => {
      if (typeof item === "string") {
        return item.trim()
          ? {
              title: item.trim(),
              priceText: "Precio $0",
            }
          : null;
      }

      return item.title.trim() ? item : null;
    })
    .filter((item): item is ValueStackItem => Boolean(item));

  if (normalizedItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-[1.6rem] border border-slate-200 bg-slate-50 px-5 py-5">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-700">
        {title}
      </p>
      <div className="grid gap-4">
        {normalizedItems.map((item) => (
          <article
            key={`${item.title}-${item.valueText ?? item.priceText ?? ""}`}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-black text-emerald-500">
                ✓
              </span>
              <div className="min-w-0 space-y-3">
                <p className="text-base font-black uppercase tracking-[0.1em] text-slate-950">
                  {item.title}
                </p>
                {item.description ? (
                  <p className="text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                ) : null}
                <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                    {item.valueText || "Valor incluido"}
                  </span>
                  <span className="text-slate-400">/</span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                    {item.priceText || "Precio $0"}
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
