"use client";

import { startTransition, useEffect, useState } from "react";
import { HybridJsonLivePreview } from "@/components/team-operations/hybrid-json-live-preview";
import {
  emptyHybridJsonPreviewDraft,
  HYBRID_JSON_PREVIEW_STORAGE_KEY,
  readHybridJsonPreviewDraft,
} from "@/components/team-operations/hybrid-json-preview-state";

export function HybridJsonPreviewPage() {
  const [draft, setDraft] = useState(emptyHybridJsonPreviewDraft);

  useEffect(() => {
    const syncDraft = () => {
      startTransition(() => {
        setDraft(readHybridJsonPreviewDraft());
      });
    };

    syncDraft();

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== HYBRID_JSON_PREVIEW_STORAGE_KEY
      ) {
        return;
      }

      syncDraft();
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.18),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] px-4 py-5 md:px-6 md:py-6">
      <HybridJsonLivePreview
        blocksText={draft.blocks}
        mediaMap={draft.media}
      />
    </div>
  );
}
