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
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "draft":
    case "captured":
    case "pending":
    case "pending_dns":
    case "pending_validation":
    case "due_today":
    case "first_contact":
    case "high_intent_close":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "paused":
    case "archived":
    case "lost":
    case "unscheduled":
    case "lost_recycle":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "reassigned":
    case "active_nurture":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "cold":
    case "cold_reengage":
    case "overdue":
    case "error":
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "warm":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "hot":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700";
    default:
      return "border-slate-200 bg-white text-slate-700";
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
