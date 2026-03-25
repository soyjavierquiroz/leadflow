import type { ReactNode } from "react";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-5 rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)] md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-3 md:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
