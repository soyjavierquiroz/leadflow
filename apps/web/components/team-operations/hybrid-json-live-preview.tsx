"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { LayoutTemplate, Monitor, Smartphone } from "lucide-react";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { BlockDefinition } from "@/components/blocks/BlockRenderer";
import type { JsonValue } from "@/lib/public-funnel-runtime.types";

const sectionClassName =
  "rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-6";

const deviceButtonClassName =
  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition";

const nonInteractivePreviewClassName =
  "[&_a]:pointer-events-none [&_button]:pointer-events-none [&_form]:pointer-events-none [&_input]:pointer-events-none [&_select]:pointer-events-none [&_textarea]:pointer-events-none";

type HybridJsonLivePreviewProps = {
  blocksText: string;
  mediaMap: Record<string, string>;
  themeId?: string;
  className?: string;
};

type PreviewDevice = "desktop" | "mobile";

export function HybridJsonLivePreview({
  blocksText,
  mediaMap,
  themeId = "default",
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
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Live Preview
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Render engine del funnel
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700">
            <LayoutTemplate className="h-3.5 w-3.5" />
            No interactivo
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={`${deviceButtonClassName} ${
                device === "desktop"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-transparent bg-transparent text-slate-600 hover:bg-white"
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
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-transparent bg-transparent text-slate-600 hover:bg-white"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Mobile
            </button>
          </div>

          <div className="text-right text-xs leading-5 text-slate-500">
            <p>{hasBlocks ? `${previewState.blocks.length} bloques activos` : "Sin bloques renderizables"}</p>
            <p>{Object.keys(deferredMediaMap).length} assets en el media dictionary</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] p-3">
        <div className="flex items-center justify-between rounded-[1.25rem] border border-slate-200 bg-white/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span>{device === "desktop" ? "Vista desktop" : "Vista mobile"}</span>
          <span>preview.leadflow.local</span>
        </div>

        <div className="mt-3 overflow-hidden rounded-[1.5rem] border border-slate-300 bg-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.20)]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-3 text-xs font-medium text-slate-400">
              /preview
            </span>
          </div>

          <div className="max-h-[72vh] overflow-auto bg-slate-100 p-3">
            <div
              className={`${
                device === "mobile"
                  ? "mx-auto max-w-[390px]"
                  : "w-full"
              }`}
            >
              <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
                {previewState.error ? (
                  <div className="flex min-h-[22rem] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18),_transparent_32%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-6 py-12 text-center">
                    <div className="max-w-sm space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                        Preview en espera
                      </p>
                      <p className="text-lg font-semibold text-slate-950">
                        {previewState.error}
                      </p>
                      <p className="text-sm leading-6 text-slate-600">
                        Sigue escribiendo en CodeMirror. El preview se actualizará apenas el JSON vuelva a ser válido.
                      </p>
                    </div>
                  </div>
                ) : !hasBlocks ? (
                  <div className="flex min-h-[22rem] items-center justify-center bg-white px-6 py-12 text-center">
                    <div className="max-w-sm space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                        Preview listo
                      </p>
                      <p className="text-lg font-semibold text-slate-950">
                        Agrega bloques al array para renderizar el funnel.
                      </p>
                      <p className="text-sm leading-6 text-slate-600">
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
