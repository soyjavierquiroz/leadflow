"use client";

import { Rocket } from "lucide-react";
import { useState, useTransition } from "react";
import { memberOperationRequest } from "@/lib/member-operations";

type FunnelActivateButtonProps = {
  templateKey: string;
  disabled?: boolean;
  disabledLabel?: string;
};

export function FunnelActivateButton({
  templateKey,
  disabled = false,
  disabledLabel,
}: FunnelActivateButtonProps) {
  const [isActivated, setIsActivated] = useState(disabled);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-app-border bg-app-card px-3.5 py-2 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
      type="button"
      disabled={isPending || isActivated}
      onClick={() => {
        startTransition(async () => {
          await memberOperationRequest(
            `/funnel-arsenal/me/${encodeURIComponent(templateKey)}/enable`,
            { method: "POST" },
          );
          setIsActivated(true);
        });
      }}
    >
      <Rocket className="h-4 w-4" />
      {isActivated && disabledLabel
        ? disabledLabel
        : isActivated
          ? "Funnel activado"
          : isPending
            ? "Activando..."
            : "Activar Funnel"}
    </button>
  );
}
