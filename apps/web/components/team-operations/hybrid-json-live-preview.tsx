"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { LayoutTemplate, Monitor, Smartphone } from "lucide-react";
import { PublicBlockAdapter } from "@/components/public-funnel/adapters/public-block-adapters";
import { PublicAnnouncementBanner } from "@/components/public-funnel/public-announcement-banner";
import { StickyMediaGallery } from "@/components/public-funnel/sticky-media-gallery";
import { PublicRuntimeLeadSubmitProvider } from "@/components/public-runtime/public-runtime-lead-submit-provider";
import {
  normalizeRuntimeBlockType,
  parseRuntimeBlocks,
} from "@/components/public-funnel/runtime-block-utils";
import type {
  JsonValue,
  PublicFunnelRuntimePayload,
} from "@/lib/public-funnel-runtime.types";
import type { MediaRow } from "@/components/team-operations/hybrid-json-media-editor";

const sectionClassName =
  "rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-6";

const deviceButtonClassName =
  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition";

const nonInteractivePreviewClassName =
  "[&_a]:pointer-events-none [&_button]:pointer-events-none [&_form]:pointer-events-none [&_input]:pointer-events-none [&_select]:pointer-events-none [&_textarea]:pointer-events-none";

const previewHost = "preview.leadflow.local";
const previewPath = "/preview";

type HybridJsonLivePreviewProps = {
  blocksText: string;
  mediaRows: MediaRow[];
};

type PreviewDevice = "desktop" | "mobile";

const buildMediaMap = (rows: MediaRow[]) =>
  rows.reduce<Record<string, string>>((accumulator, row) => {
    const key = row.key.trim();
    const value = row.value.trim();
    if (!key || !value) {
      return accumulator;
    }

    accumulator[key] = value;
    return accumulator;
  }, {});

const inferPreviewStepType = (blocks: JsonValue[]) => {
  const hasLeadCaptureBlock = blocks.some((block) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      return false;
    }

    const type =
      "type" in block && typeof block.type === "string" ? block.type : "";

    return normalizeRuntimeBlockType(type) === "lead_capture_form";
  });

  return hasLeadCaptureBlock ? "capture_step" : "landing_page";
};

const buildPreviewRuntime = (
  blocks: JsonValue[],
  mediaMap: Record<string, string>,
): PublicFunnelRuntimePayload => {
  const stepType = inferPreviewStepType(blocks);
  const currentStep = {
    id: "preview-step",
    slug: "preview",
    path: previewPath,
    stepType,
    position: 1,
    isEntryStep: true,
    isConversionStep: stepType === "capture_step",
    blocksJson: blocks,
    mediaMap,
    settingsJson: {},
  };

  return {
    request: {
      host: previewHost,
      path: previewPath,
      publicationPathPrefix: previewPath,
      relativeStepPath: previewPath,
    },
    domain: {
      id: "preview-domain",
      host: previewHost,
      normalizedHost: previewHost,
      domainType: "preview",
      isPrimary: true,
      canonicalHost: null,
      redirectToPrimary: false,
    },
    publication: {
      id: "preview-publication",
      pathPrefix: previewPath,
      isPrimary: true,
      trackingProfileId: null,
      handoffStrategyId: null,
    },
    funnel: {
      id: "preview-funnel",
      name: "Live Preview Funnel",
      code: "live-preview-funnel",
      status: "draft",
      settingsJson: {},
      mediaMap,
      template: {
        id: "preview-template",
        code: "live-preview-template",
        name: "Live Preview Template",
        version: 1,
        funnelType: "hybrid",
        blocksJson: blocks,
        mediaMap,
        settingsJson: {},
        allowedOverridesJson: {},
      },
    },
    trackingProfile: null,
    handoffStrategy: null,
    handoff: {
      mode: null,
      channel: null,
      buttonLabel: "Preview no interactivo",
      autoRedirect: false,
      autoRedirectDelayMs: null,
      messageTemplate: null,
    },
    currentStep,
    nextStep: {
      id: "preview-next-step",
      slug: "preview-next",
      path: `${previewPath}/next`,
      stepType: "thank_you_step",
    },
    previousStep: null,
    steps: [currentStep],
  };
};

export function HybridJsonLivePreview({
  blocksText,
  mediaRows,
}: HybridJsonLivePreviewProps) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const deferredBlocksText = useDeferredValue(blocksText);
  const deferredMediaRows = useDeferredValue(mediaRows);

  const mediaMap = useMemo(
    () => buildMediaMap(deferredMediaRows),
    [deferredMediaRows],
  );

  const previewState = useMemo(() => {
    try {
      const parsedValue = JSON.parse(deferredBlocksText) as unknown;
      if (!Array.isArray(parsedValue)) {
        return {
          error: "Esperando JSON válido...",
          runtime: buildPreviewRuntime([], mediaMap),
          blocks: [],
        };
      }

      const jsonBlocks = parsedValue as JsonValue[];
      const parsedBlocks = parseRuntimeBlocks(jsonBlocks);

      return {
        error: null,
        runtime: buildPreviewRuntime(jsonBlocks, mediaMap),
        blocks: parsedBlocks.blocks,
      };
    } catch {
      return {
        error: "Esperando JSON válido...",
        runtime: buildPreviewRuntime([], mediaMap),
        blocks: [],
      };
    }
  }, [deferredBlocksText, mediaMap]);

  const hasBlocks = previewState.blocks.length > 0;
  const isConversionPage = previewState.blocks.some(
    (block) => normalizeRuntimeBlockType(block.type) === "conversion_page_config",
  );

  return (
    <section className={`${sectionClassName} xl:sticky xl:top-6`}>
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
            <p>{Object.keys(mediaMap).length} assets en el media dictionary</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] p-3">
        <div className="flex items-center justify-between rounded-[1.25rem] border border-slate-200 bg-white/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span>{device === "desktop" ? "Vista desktop" : "Vista mobile"}</span>
          <span>{previewHost}</span>
        </div>

        <div className="mt-3 overflow-hidden rounded-[1.5rem] border border-slate-300 bg-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.20)]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-3 text-xs font-medium text-slate-400">
              {previewPath}
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
                  <PublicRuntimeLeadSubmitProvider
                    hostname={previewHost}
                    path={previewPath}
                  >
                    <div className={nonInteractivePreviewClassName}>
                      <PublicAnnouncementBanner blocks={previewState.blocks} />

                      {device === "desktop" && !isConversionPage ? (
                        <div className="grid min-h-[44rem] lg:grid-cols-2 lg:gap-0">
                          <div className="overflow-hidden bg-black">
                            <StickyMediaGallery
                              runtime={previewState.runtime}
                              blocks={previewState.blocks}
                              className="h-full pt-6 pb-48 lg:pt-8 lg:pb-56"
                            />
                          </div>

                          <div className="bg-white px-6 pb-8 pt-4 text-slate-900 lg:px-12 lg:pb-12">
                            <div className="mx-auto w-full max-w-[44rem] space-y-12">
                              {previewState.blocks.map((block, index) => (
                                <PublicBlockAdapter
                                  key={`${block.type}-${index}`}
                                  block={block}
                                  runtime={previewState.runtime}
                                  blocks={previewState.blocks}
                                  layoutVariant="sticky_media"
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white px-4 py-6 text-slate-900 sm:px-6">
                          <div className="mx-auto w-full max-w-[44rem] space-y-10">
                            {previewState.blocks.map((block, index) => (
                              <PublicBlockAdapter
                                key={`${block.type}-${index}`}
                                block={block}
                                runtime={previewState.runtime}
                                blocks={previewState.blocks}
                                layoutVariant="single_column"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </PublicRuntimeLeadSubmitProvider>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
