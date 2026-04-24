import type { ReactNode } from "react";

type EmptyStateProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  align?: "center" | "left";
};

export function EmptyState({
  eyebrow = "Espacio listo para empezar",
  title,
  description,
  action,
  align = "center",
}: EmptyStateProps) {
  const isCentered = align === "center";

  return (
    <div
      className={`rounded-[1.9rem] border border-dashed border-app-border bg-[radial-gradient(circle_at_top,var(--app-accent-soft),transparent_38%),linear-gradient(180deg,var(--app-surface)_0%,var(--app-card)_100%)] p-8 shadow-[0_18px_45px_rgba(15,23,42,0.05)] ${
        isCentered ? "text-center" : "text-left"
      }`}
    >
      <div
        className={`flex ${isCentered ? "justify-center" : "justify-start"}`}
      >
        <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.6rem] border border-app-border bg-app-card shadow-[0_16px_35px_rgba(15,23,42,0.08)]">
          <span className="absolute inset-x-3 bottom-3 h-1 rounded-full bg-app-border" />
          <span className="absolute left-4 top-6 h-5 w-1.5 rounded-full bg-teal-500" />
          <span className="absolute left-7 top-4 h-7 w-1.5 rounded-full bg-app-text" />
          <span className="absolute left-10 top-8 h-3 w-1.5 rounded-full bg-sky-500" />
        </div>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.26em] text-app-text-soft">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-lg font-semibold text-app-text">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-app-text-muted">{description}</p>
      {action ? (
        <div
          className={`mt-5 flex ${isCentered ? "justify-center" : "justify-start"}`}
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}
