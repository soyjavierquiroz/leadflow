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
    <div className={cx("border-y border-slate-200 py-2", className)}>
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center lg:justify-start">
        {items.map((item, index) => (
          <div
            key={`${item.label}-${item.meta ?? ""}`}
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 md:text-xs"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/12 text-[10px] font-black text-emerald-600">
              +
            </span>
            <span className="font-black uppercase tracking-[0.16em] text-slate-900">
              {item.label}:
            </span>
            {item.meta ? <span>{item.meta}</span> : null}
            {index < items.length - 1 ? (
              <span
                aria-hidden="true"
                className="ml-1 inline-block h-3 w-px bg-slate-300"
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
