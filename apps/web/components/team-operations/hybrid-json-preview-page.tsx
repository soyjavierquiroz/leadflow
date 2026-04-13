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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.18),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] px-4 py-5 md:px-6 md:py-6">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <div className="w-full rounded-[2rem] border border-amber-300 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
              Vista previa aislada
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              {errorMessage}
            </h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Vuelve al editor del funnel y lanza la vista previa desde el botón dedicado para abrir una ventana con el borrador correcto.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.18),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] px-4 py-5 md:px-6 md:py-6">
      <HybridJsonLivePreview
        blocksText={draft.blocks}
        mediaMap={draft.media}
        themeId={draft.theme}
        settingsJson={draft.settingsJson as any}
      />
    </div>
  );
}
