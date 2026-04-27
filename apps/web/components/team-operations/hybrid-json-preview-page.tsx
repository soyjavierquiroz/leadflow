"use client";

import { useSearchParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { HybridJsonLivePreview } from "@/components/team-operations/hybrid-json-live-preview";
import {
  emptyHybridJsonPreviewDraft,
  readHybridJsonPreviewDraft,
} from "@/components/team-operations/hybrid-json-preview-state";

const hasObjectSettingsJson = (
  value: unknown,
): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function HybridJsonPreviewPage() {
  const searchParams = useSearchParams();
  const draftKey = searchParams.get("draftKey")?.trim() ?? "";
  const [draft, setDraft] = useState(emptyHybridJsonPreviewDraft);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!draftKey) {
      setDraft(emptyHybridJsonPreviewDraft);
      setErrorMessage("Falta el identificador de borrador.");
      return;
    }

    const syncDraft = () => {
      startTransition(() => {
        const nextDraft = readHybridJsonPreviewDraft(draftKey);
        const hasStoredDraft =
          nextDraft.blocks !== emptyHybridJsonPreviewDraft.blocks ||
          Object.keys(nextDraft.media).length > 0 ||
          nextDraft.theme !== emptyHybridJsonPreviewDraft.theme ||
          (hasObjectSettingsJson(nextDraft.settingsJson)
            ? Object.keys(
                nextDraft.settingsJson as Record<string, unknown>,
              ).length > 0
            : false);

        setDraft(nextDraft);
        setErrorMessage(
          hasStoredDraft
            ? null
            : "No encontramos un borrador activo para esta vista previa.",
        );
      });
    };

    syncDraft();

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== draftKey) {
        return;
      }

      syncDraft();
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [draftKey]);

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,var(--app-accent-soft),transparent_28%),linear-gradient(180deg,var(--app-bg-elevated)_0%,var(--app-bg)_100%)] px-4 py-5 text-app-text md:px-6 md:py-6">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <div className="w-full rounded-[2rem] border border-app-warning-border bg-app-card p-8 shadow-[var(--ai-panel-shadow)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-warning-text">
              Vista previa aislada
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-app-text">
              {errorMessage}
            </h1>
            <p className="mt-4 text-sm leading-7 text-app-text-muted">
              Vuelve al editor del funnel y lanza la vista previa desde el botón dedicado para abrir una ventana con el borrador correcto.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,var(--app-accent-soft),transparent_28%),linear-gradient(180deg,var(--app-bg-elevated)_0%,var(--app-bg)_100%)] px-4 py-5 text-app-text md:px-6 md:py-6">
      <HybridJsonLivePreview
        blocksText={draft.blocks}
        mediaMap={draft.media}
        themeId={draft.theme}
        settingsJson={draft.settingsJson as any}
      />
    </div>
  );
}
