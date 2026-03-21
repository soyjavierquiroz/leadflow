type StatusBadgeProps = {
  value: string | null | undefined;
};

const toneByValue = (value: string) => {
  switch (value) {
    case "active":
    case "assigned":
    case "accepted":
    case "available":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "draft":
    case "captured":
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "paused":
    case "archived":
    case "lost":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "reassigned":
      return "border-sky-200 bg-sky-50 text-sky-700";
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
