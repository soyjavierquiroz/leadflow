"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

type ModalShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
};

export function ModalShell({
  eyebrow = "Team Operations",
  title,
  description,
  onClose,
  children,
}: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 px-4 py-6 backdrop-blur-md dark:bg-slate-950/55">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-app-border bg-[linear-gradient(180deg,var(--app-surface)_0%,var(--app-card)_100%)] shadow-[0_32px_100px_rgba(15,23,42,0.24)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-app-border bg-[radial-gradient(circle_at_top_left,var(--app-accent-soft),_transparent_38%),linear-gradient(180deg,var(--app-surface)_0%,var(--app-card)_100%)] px-6 py-5 text-left">
          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-text-soft">
              {eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-app-text">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-app-text-muted">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-card text-app-text-muted transition hover:bg-app-surface-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
