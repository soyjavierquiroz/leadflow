"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { LayoutTemplate, Monitor, Smartphone } from "lucide-react";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { BlockDefinition } from "@/components/blocks/BlockRenderer";
import type { JsonValue } from "@/lib/public-funnel-runtime.types";

const sectionClassName =
  "rounded-[2rem] border border-app-border bg-app-card p-5 text-app-text shadow-[var(--ai-panel-shadow)] md:p-6";

const deviceButtonClassName =
  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition";

const nonInteractivePreviewClassName =
  "[&_a]:pointer-events-none [&_button]:pointer-events-none [&_form]:pointer-events-none [&_input]:pointer-events-none [&_select]:pointer-events-none [&_textarea]:pointer-events-none";

type HybridJsonLivePreviewProps = {
  blocksText: string;
  mediaMap: Record<string, string>;
  themeId?: string;
  settingsJson?: JsonValue;
  className?: string;
};

type PreviewDevice = "desktop" | "mobile";

export function HybridJsonLivePreview({
  blocksText,
  mediaMap,
  themeId = "default",
  settingsJson = {},
  className,
}: HybridJsonLivePreviewProps) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const deferredBlocksText = useDeferredValue(blocksText);
  const deferredMediaMap = useDeferredValue(mediaMap);

  const previewState = useMemo(() => {
    try {
      const parsedValue = JSON.parse(deferredBlocksText) as unknown;
      if (!Array.isArray(parsedValue)) {
        return {
          error: "Esperando JSON válido...",
          blocks: [],
        };
      }

      return {
        error: null,
        blocks: parsedValue as JsonValue[],
      };
    } catch {
      return {
        error: "Esperando JSON válido...",
        blocks: [],
      };
    }
  }, [deferredBlocksText]);

  const hasBlocks = previewState.blocks.length > 0;

  return (
    <section className={[sectionClassName, className].filter(Boolean).join(" ")}>
      <div className="flex flex-col gap-4 border-b border-app-border pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-text-soft">
              Live Preview
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-app-text">
              Render engine del funnel
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-app-surface-muted px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-app-text-muted">
            <LayoutTemplate className="h-3.5 w-3.5" />
            No interactivo
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-app-border bg-app-surface-muted p-1">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={`${deviceButtonClassName} ${
                device === "desktop"
                  ? "border-app-text bg-app-text text-app-bg"
                  : "border-transparent bg-transparent text-app-text-muted hover:bg-app-card"
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className={`${deviceButtonClassName} ${
                device === "mobile"
                  ? "border-app-text bg-app-text text-app-bg"
                  : "border-transparent bg-transparent text-app-text-muted hover:bg-app-card"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Mobile
            </button>
          </div>

          <div className="text-right text-xs leading-5 text-app-text-soft">
            <p>{hasBlocks ? `${previewState.blocks.length} bloques activos` : "Sin bloques renderizables"}</p>
            <p>{Object.keys(deferredMediaMap).length} assets en el media dictionary</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[1.75rem] border border-app-border bg-[linear-gradient(180deg,var(--app-surface-muted)_0%,var(--app-bg)_100%)] p-3">
        <div className="flex items-center justify-between rounded-[1.25rem] border border-app-border bg-app-card/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-soft">
          <span>{device === "desktop" ? "Vista desktop" : "Vista mobile"}</span>
          <span>preview.leadflow.local</span>
        </div>

        <div className="mt-3 overflow-hidden rounded-[1.5rem] border border-app-border bg-app-shell-bg shadow-[0_24px_80px_rgba(15,23,42,0.20)]">
          <div className="flex items-center gap-2 border-b border-app-shell-border px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-app-danger-text" />
            <span className="h-2.5 w-2.5 rounded-full bg-app-warning-text" />
            <span className="h-2.5 w-2.5 rounded-full bg-app-success-text" />
            <span className="ml-3 text-xs font-medium text-app-shell-muted">
              /preview
            </span>
          </div>

          <div className="max-h-[72vh] overflow-auto bg-app-bg p-3">
            <div
              className={`${
                device === "mobile"
                  ? "mx-auto max-w-[390px]"
                  : "w-full"
              }`}
            >
              <div className="overflow-hidden rounded-[1.5rem] border border-app-border bg-app-card">
                {previewState.error ? (
                  <div className="flex min-h-[22rem] items-center justify-center bg-[radial-gradient(circle_at_top,var(--app-accent-soft),transparent_32%),linear-gradient(180deg,var(--app-card)_0%,var(--app-surface-muted)_100%)] px-6 py-12 text-center">
                    <div className="max-w-sm space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-text-soft">
                        Preview en espera
                      </p>
                      <p className="text-lg font-semibold text-app-text">
                        {previewState.error}
                      </p>
                      <p className="text-sm leading-6 text-app-text-muted">
                        Sigue escribiendo en CodeMirror. El preview se actualizará apenas el JSON vuelva a ser válido.
                      </p>
                    </div>
                  </div>
                ) : !hasBlocks ? (
                  <div className="flex min-h-[22rem] items-center justify-center bg-app-card px-6 py-12 text-center">
                    <div className="max-w-sm space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-text-soft">
                        Preview listo
                      </p>
                      <p className="text-lg font-semibold text-app-text">
                        Agrega bloques al array para renderizar el funnel.
                      </p>
                      <p className="text-sm leading-6 text-app-text-muted">
                        El panel derecho reutiliza el runtime público y tomará imágenes del CDN bridge actual en cuanto existan.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className={nonInteractivePreviewClassName}>
                    <BlockRenderer
                      blocks={previewState.blocks as unknown as BlockDefinition[]}
                      mediaMap={deferredMediaMap}
                      themeId={themeId}
                      settingsJson={settingsJson}
                      template={{
                        id: "jakawi-premium",
                        code: "jakawi-premium",
                        name: "Jakawi Premium",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
