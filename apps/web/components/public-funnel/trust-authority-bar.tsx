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
        "border-y border-slate-800 py-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-center lg:justify-start">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.meta ?? ""}`}
            className="min-w-[8rem] text-slate-400"
          >
            <p className="text-sm font-black uppercase tracking-[0.22em] text-slate-300">
              {item.label}
            </p>
            {item.meta ? (
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {item.meta}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
