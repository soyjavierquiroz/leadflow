"use client";

import { Leaf, Megaphone } from "lucide-react";

export type LeadTrafficLayer = "DIRECT" | "PAID_WHEEL" | "ORGANIC";

type LeadSourceBadgeProps = {
  trafficLayer?: LeadTrafficLayer | null;
  originAdWheelName?: string | null;
};

export function LeadSourceBadge({
  trafficLayer,
  originAdWheelName,
}: LeadSourceBadgeProps) {
  const isPaidWheel = trafficLayer === "PAID_WHEEL";
  const label = isPaidWheel
    ? `Campaña: ${originAdWheelName ?? "Rueda publicitaria"}`
    : "Orgánico";
  const Icon = isPaidWheel ? Megaphone : Leaf;

  return (
    <span
      className={`inline-flex max-w-64 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        isPaidWheel
          ? "border-app-warning-border bg-app-warning-bg text-app-warning-text shadow-[0_0_28px_rgba(245,158,11,0.14)]"
          : "border-app-accent/35 bg-app-accent-soft text-app-accent"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
