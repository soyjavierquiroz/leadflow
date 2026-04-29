"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, Rocket, Settings2 } from "lucide-react";

import type { PublicationRuntimeHealthStatus } from "@/store/usePublicationStore";

type PublicationStatus = "draft" | "published";

export type StepSelectorStep = {
  key: string;
  label: string;
  badge?: string | null;
};

type ZenModeShellProps = {
  funnelName: string;
  publicationStatus: PublicationStatus;
  runtimeHealthStatus: PublicationRuntimeHealthStatus;
  isPublishing?: boolean;
  publishDisabled?: boolean;
  onPublish: () => void;
  onOpenInspector: () => void;
  backHref?: string;
  backLabel?: string;
  stepSelector?: {
    activeKey: string;
    steps: StepSelectorStep[];
    disabled?: boolean;
    onChange: (key: string) => void;
  } | null;
  inspector?: ReactNode;
  children: ReactNode;
};

const statusStyles: Record<PublicationStatus, string> = {
  draft:
    "border-app-warning-border bg-app-warning-bg text-app-warning-text",
  published:
    "border-app-success-border bg-app-success-bg text-app-success-text",
};

const healthStyles: Record<PublicationRuntimeHealthStatus, string> = {
  healthy:
    "border-app-success-border bg-app-success-bg text-app-success-text",
  warning:
    "border-app-warning-border bg-app-warning-bg text-app-warning-text",
  broken: "border-app-danger-border bg-app-danger-bg text-app-danger-text",
};

const healthLabels: Record<PublicationRuntimeHealthStatus, string> = {
  healthy: "Runtime sano",
  warning: "Revisar runtime",
  broken: "Runtime roto",
};

export function ZenModeShell({
  funnelName,
  publicationStatus,
  runtimeHealthStatus,
  isPublishing = false,
  publishDisabled = false,
  onPublish,
  onOpenInspector,
  backHref,
  backLabel = "Volver",
  stepSelector,
  inspector,
  children,
}: ZenModeShellProps) {
  const safeFunnelName = funnelName.trim() || "Funnel sin nombre";

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/95 px-4 shadow-lg shadow-slate-200/50 backdrop-blur md:px-6 dark:border-white/10 dark:bg-slate-950/95 dark:shadow-slate-950/30">
        <div className="flex min-w-0 items-center gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-text-muted transition hover:border-app-border-strong hover:text-app-text"
              aria-label={backLabel}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : null}

          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-app-text-soft">
              Zen Builder
            </p>
            <h1 className="truncate text-base font-semibold text-app-text md:text-lg">
              {safeFunnelName}
            </h1>
          </div>
        </div>

        {stepSelector && stepSelector.steps.length > 1 ? (
          <StepSelector
            activeKey={stepSelector.activeKey}
            steps={stepSelector.steps}
            disabled={stepSelector.disabled}
            onChange={stepSelector.onChange}
          />
        ) : null}

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`hidden rounded-full border px-3 py-1 text-xs font-semibold capitalize md:inline-flex ${statusStyles[publicationStatus]}`}
          >
            {publicationStatus === "published" ? "Publicado" : "Draft"}
          </span>

          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${healthStyles[runtimeHealthStatus]}`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{healthLabels[runtimeHealthStatus]}</span>
          </span>

          <button
            type="button"
            onClick={onOpenInspector}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-text-muted transition hover:border-app-border-strong hover:text-app-text"
            aria-label="Abrir ajustes de publicación"
          >
            <Settings2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onPublish}
            disabled={publishDisabled || isPublishing}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-app-text px-4 py-2.5 text-sm font-semibold text-app-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Rocket className="h-4 w-4" />
            <span>{isPublishing ? "Publicando..." : "Publicar"}</span>
          </button>
        </div>
      </header>

      <main className="h-[calc(100vh-4rem)] overflow-y-auto overscroll-none">
        {children}
      </main>

      {inspector}
    </div>
  );
}

export function StepSelector({
  activeKey,
  steps,
  disabled = false,
  onChange,
}: {
  activeKey: string;
  steps: StepSelectorStep[];
  disabled?: boolean;
  onChange: (key: string) => void;
}) {
  return (
    <nav
      className="hidden min-w-0 flex-1 justify-center lg:flex"
      aria-label="Pasos del funnel"
    >
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-app-border bg-app-surface p-1">
        {steps.map((step) => {
          const isActive = step.key === activeKey;

          return (
            <button
              key={step.key}
              type="button"
              disabled={disabled || isActive}
              onClick={() => onChange(step.key)}
              className={`inline-flex min-w-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition disabled:cursor-default ${
                isActive
                  ? "bg-app-text text-app-bg shadow-sm"
                  : "text-app-text-muted hover:bg-app-card hover:text-app-text"
              }`}
            >
              <span className="truncate">{step.label}</span>
              {step.badge ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[0.65rem] ${
                    isActive
                      ? "bg-app-bg/15 text-app-bg"
                      : "bg-app-card text-app-text-soft"
                  }`}
                >
                  {step.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
