import type { ReactNode } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  CircleDot,
  Flag,
  XCircle,
} from "lucide-react";
import type {
  FlowNode,
  FunnelLintIssue,
} from "../../../../../packages/shared/funnel-lint/src";

type StepCardProps = {
  node: FlowNode;
  issues: FunnelLintIssue[];
  isActive: boolean;
  connectionSummary?: string | null;
  slugEditor?: ReactNode;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const normalizeRole = (value: string) => value.trim().toLowerCase();

const roleStyles = {
  entry: {
    accent: "bg-blue-500",
    icon: CircleDot,
    iconClassName: "text-blue-300 bg-blue-500/15 ring-blue-500/20",
  },
  offer: {
    accent: "bg-amber-500",
    icon: BadgeDollarSign,
    iconClassName: "text-amber-300 bg-amber-500/15 ring-amber-500/20",
  },
  terminal: {
    accent: "bg-rose-500",
    icon: Flag,
    iconClassName: "text-rose-300 bg-rose-500/15 ring-rose-500/20",
  },
  default: {
    accent: "bg-slate-400",
    icon: CircleDot,
    iconClassName: "text-slate-300 bg-slate-700/80 ring-slate-600/60",
  },
} as const;

const getRoleStyle = (role: string) => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "entry") {
    return roleStyles.entry;
  }

  if (
    normalizedRole === "offer" ||
    normalizedRole === "upsell" ||
    normalizedRole === "downsell"
  ) {
    return roleStyles.offer;
  }

  if (normalizedRole === "terminal" || normalizedRole === "thank_you") {
    return roleStyles.terminal;
  }

  return roleStyles.default;
};

const getStepTitle = (node: FlowNode) => {
  const title = node.meta?.title?.trim();
  return title || node.slug || node.stepId;
};

export function StepCard({
  node,
  issues,
  isActive,
  connectionSummary,
  slugEditor,
}: StepCardProps) {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;
  const hasErrors = errorCount > 0;
  const hasWarnings = warningCount > 0;
  const roleStyle = getRoleStyle(String(node.role));
  const RoleIcon = roleStyle.icon;

  return (
    <article
      className={cx(
        "group relative overflow-hidden rounded-lg border bg-white text-left shadow-lg shadow-slate-200/50 transition dark:bg-slate-800 dark:shadow-slate-950/20",
        "hover:border-slate-400 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/95",
        isActive && "border-cyan-400/70 ring-2 ring-cyan-400/20",
        !isActive && !hasErrors && "border-slate-200 dark:border-white/10",
        hasErrors && "border-red-400/80 ring-1 ring-red-500/20",
      )}
      aria-current={isActive ? "step" : undefined}
    >
      <span
        className={cx(
          "absolute inset-y-0 left-0 w-1",
          hasErrors ? "bg-red-500" : roleStyle.accent,
        )}
        aria-hidden="true"
      />

      <div className="flex min-w-0 items-start gap-3 px-4 py-3 pl-5">
        <span
          className={cx(
            "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ring-1",
            hasErrors
              ? "bg-red-500/15 text-red-300 ring-red-500/20"
              : roleStyle.iconClassName,
          )}
          aria-hidden="true"
        >
          <RoleIcon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {getStepTitle(node)}
              </h3>
              <p className="mt-1 truncate text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                {node.stepType}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {hasErrors ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-300">
                  <XCircle className="h-3.5 w-3.5" />
                  {errorCount}
                </span>
              ) : null}

              {hasWarnings ? (
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300"
                  title={`${warningCount} warning${warningCount === 1 ? "" : "s"}`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </div>
          </div>

          {slugEditor ? (
            <div className="mt-2">{slugEditor}</div>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <span className="truncate text-xs text-slate-500 dark:text-slate-400">{node.slug}</span>
              {isActive ? (
                <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-cyan-200">
                  Editando
                </span>
              ) : null}
            </div>
          )}

          {connectionSummary ? (
            <p className="mt-2 truncate text-[0.72rem] font-medium text-slate-500 dark:text-slate-400">
              {"Salida -> "}
              {connectionSummary}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
