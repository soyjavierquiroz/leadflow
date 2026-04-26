type StatusBadgeProps = {
  value: string | null | undefined;
};

const toneByValue = (value: string) => {
  switch (value) {
    case "active":
    case "assigned":
    case "accepted":
    case "available":
    case "upcoming":
    case "won_handoff":
      return "border-app-success-border bg-app-success-bg text-app-success-text";
    case "draft":
    case "captured":
    case "pending":
    case "pending_dns":
    case "pending_validation":
    case "recreate_required":
    case "due_today":
    case "first_contact":
    case "high_intent_close":
      return "border-app-warning-border bg-app-warning-bg text-app-warning-text";
    case "paused":
    case "suspended":
    case "archived":
    case "lost":
    case "unscheduled":
    case "lost_recycle":
      return "border-app-border bg-app-surface-muted text-app-text-muted";
    case "reassigned":
    case "active_nurture":
      return "border-app-accent bg-app-accent-soft text-app-accent";
    case "stagnant":
      return "border-app-warning-border bg-app-warning-bg text-app-warning-text";
    case "orphaned":
      return "border-app-danger-border bg-app-danger-bg text-app-danger-text";
    case "cold":
    case "cold_reengage":
    case "overdue":
    case "error":
    case "failed":
    case "legacy":
      return "border-app-danger-border bg-app-danger-bg text-app-danger-text";
    case "primary":
      return "border-app-border bg-app-surface text-app-text";
    case "warm":
      return "border-app-warning-border bg-app-warning-bg text-app-warning-text";
    case "hot":
      return "border-app-accent bg-app-accent-soft text-app-accent";
    default:
      return "border-app-border bg-app-surface-muted text-app-text-muted";
  }
};

const toLabel = (value: string | null | undefined) => {
  if (!value) {
    return "Sin estado";
  }

  return value
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const normalized = value?.trim().toLowerCase() ?? "";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneByValue(
        normalized,
      )}`}
    >
      {toLabel(value)}
    </span>
  );
}
