import { cx } from "@/components/public-funnel/adapters/public-funnel-primitives";

type TrustAuthorityItem = {
  label: string;
  meta?: string;
};

type TrustAuthorityBarProps = {
  items: TrustAuthorityItem[];
  className?: string;
};

export function TrustAuthorityBar({
  items,
  className,
}: TrustAuthorityBarProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={cx(
        "border-y border-slate-800/90 py-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-3 text-center lg:justify-start">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.meta ?? ""}`}
            className="min-w-[9rem] rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 shadow-xl shadow-black/20"
          >
            <p className="text-lg font-black uppercase tracking-[0.28em] text-white">
              {item.label}
            </p>
            {item.meta ? (
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {item.meta}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
