import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { PublicBlockAdapter } from "@/components/public-funnel/adapters/public-block-adapters";
import {
  PublicPill,
  PublicSectionSurface,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import { PublicAnnouncementBanner } from "@/components/public-funnel/public-announcement-banner";
import { PublicRuntimeTracker } from "@/components/public-funnel/public-runtime-tracker";
import { StickyMediaGallery } from "@/components/public-funnel/sticky-media-gallery";
import { TrackedCta } from "@/components/public-funnel/tracked-cta";
import {
  normalizeRuntimeBlockType,
  parseRuntimeBlocks,
  toStepLabel,
} from "@/components/public-funnel/runtime-block-utils";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";

type FunnelRuntimePageProps = {
  runtime: PublicFunnelRuntimePayload;
  previewHost?: string;
};

export function FunnelRuntimePage({
  runtime,
  previewHost,
}: FunnelRuntimePageProps) {
  const parsedBlocks = parseRuntimeBlocks(runtime.currentStep.blocksJson);
  const blocks = parsedBlocks.blocks;
  const hasRenderableBlocks = blocks.length > 0;
  const isConversionPage = blocks.some(
    (block) => normalizeRuntimeBlockType(block.type) === "conversion_page_config",
  );
  const entryStepPath =
    runtime.steps.find((step) => step.isEntryStep)?.path ??
    runtime.currentStep.path;
  const progressValue = Math.max(
    1,
    Math.round((runtime.currentStep.position / runtime.steps.length) * 100),
  );
  const mediaAssetCount = [
    runtime.currentStep.mediaMap,
    runtime.funnel.mediaMap,
    runtime.funnel.template.mediaMap,
  ].reduce<number>((count, candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return count;
    }

    return Math.max(
      count,
      Object.keys(candidate as Record<string, unknown>).length,
    );
  }, 0);

  if (hasRenderableBlocks) {
    if (isConversionPage) {
      return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.10),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#ecfdf5_100%)]">
          <PublicRuntimeTracker runtime={runtime} previewHost={previewHost} />
          <div className="min-h-screen px-4 py-6 md:px-6 md:py-10">
            {blocks.map((block, index) => (
              <PublicBlockAdapter
                key={`${block.type}-${index}`}
                block={block}
                runtime={runtime}
                blocks={blocks}
                layoutVariant="single_column"
              />
            ))}
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen">
        <PublicRuntimeTracker runtime={runtime} previewHost={previewHost} />
        <PublicAnnouncementBanner blocks={blocks} />

        <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
          <div className="grid min-h-screen lg:grid-cols-2 lg:gap-0">
            <div className="hidden bg-black overflow-hidden lg:block lg:sticky lg:top-0 lg:h-screen">
              <StickyMediaGallery
                runtime={runtime}
                blocks={blocks}
                className="h-full pt-6 pb-48 lg:pt-8 lg:pb-56"
              />
            </div>

            <div className="min-h-screen bg-white px-6 pb-8 pt-0 text-slate-900 lg:px-20 lg:pb-12 lg:pt-4">
              <div className="mx-auto w-full max-w-[44rem] space-y-12">
                {blocks.map((block, index) => (
                  <PublicBlockAdapter
                    key={`${block.type}-${index}`}
                    block={block}
                    runtime={runtime}
                    blocks={blocks}
                    layoutVariant="sticky_media"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.16),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.14),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_45%,_#f8fafc_100%)] px-4 py-6 md:px-8 md:py-10">
      <PublicRuntimeTracker runtime={runtime} previewHost={previewHost} />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 md:gap-8">
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur md:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Leadflow Public Funnel
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <PublicPill>{runtime.domain.host}</PublicPill>
                  <PublicPill>{runtime.request.path}</PublicPill>
                  <PublicPill>
                    Template {runtime.funnel.template.name}
                  </PublicPill>
                  {parsedBlocks.compatibility.mode === "leadflow_compatible" ? (
                    <PublicPill tone="warm">JSON compatible</PublicPill>
                  ) : null}
                  {parsedBlocks.compatibility.presetId ? (
                    <PublicPill>
                      Preset {parsedBlocks.compatibility.presetId}
                    </PublicPill>
                  ) : null}
                  {previewHost ? (
                    <PublicPill tone="warm">previewHost={previewHost}</PublicPill>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={runtime.currentStep.stepType} />
                <PublicPill>Funnel {runtime.funnel.name}</PublicPill>
                <PublicPill>
                  Paso {runtime.currentStep.position} de {runtime.steps.length}
                </PublicPill>
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,_#0f172a_0%,_#14b8a6_55%,_#f59e0b_100%)]"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
        </section>

        <SectionHeader
          eyebrow="Frontend público v2"
          title={`${runtime.funnel.name} con mejor claridad comercial`}
          description={`Esta publicación mantiene el runtime JSON-driven actual, pero eleva lectura, contraste, espaciado y continuidad entre ${runtime.steps
            .map((step) => toStepLabel(step.stepType))
            .join(" -> ")}.`}
          actions={
            <>
              <TrackedCta
                publicationId={runtime.publication.id}
                currentStepId={runtime.currentStep.id}
                currentPath={runtime.request.path}
                href={entryStepPath}
                label="Ir al inicio"
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                action="entry_step"
              />
              {runtime.nextStep ? (
                <TrackedCta
                  publicationId={runtime.publication.id}
                  currentStepId={runtime.currentStep.id}
                  currentPath={runtime.request.path}
                  href={runtime.nextStep.path}
                  label="Ver siguiente paso"
                  className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  action="next_step"
                />
              ) : null}
            </>
          }
        />

        <section className="grid gap-4 lg:grid-cols-3">
          <KpiCard
            label="Publicación"
            value={runtime.publication.pathPrefix}
            hint="La misma resolución por host + path sigue activa, ahora con una shell más creíble y mejor ritmo visual."
          />
          <KpiCard
            label="Tracking"
            value={runtime.trackingProfile?.provider ?? "Pendiente"}
            hint="Seguimos emitiendo eventos del runtime sin alterar el modelo actual de publicación."
          />
          <KpiCard
            label="Handoff"
            value={runtime.handoff.buttonLabel ?? "Continuidad activa"}
            hint="La transición a reveal o WhatsApp sigue conectada, pero ahora se percibe mucho mejor para el usuario."
          />
        </section>

        {blocks.map((block, index) => (
          <PublicBlockAdapter
            key={`${block.type}-${index}`}
            block={block}
            runtime={runtime}
            blocks={blocks}
          />
        ))}

        <PublicSectionSurface id="funnel-details" className="md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Base del runtime
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Mismo motor, presentación más madura
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Esta capa no rehace el motor ni cambia el modelo de publicación.
                Organiza mejor la interfaz pública y deja una registry de
                adapters para absorber componentes reciclados después.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                `Dominio resuelto: ${runtime.domain.host}`,
                `Tracking profile: ${runtime.trackingProfile?.name ?? "sin perfil activo"}`,
                `Modo de handoff: ${runtime.handoff.mode ?? "sin modo definido"}`,
                mediaAssetCount > 0
                  ? `Media assets disponibles: ${mediaAssetCount}`
                  : parsedBlocks.compatibility.mediaDictionaryKeys.length > 0
                    ? `Media dictionary: ${parsedBlocks.compatibility.mediaDictionaryKeys.length} assets`
                    : "Media dictionary: no definido",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </PublicSectionSurface>
      </div>
    </main>
  );
}
