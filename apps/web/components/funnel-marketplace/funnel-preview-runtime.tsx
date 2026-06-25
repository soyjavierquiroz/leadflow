import Link from "next/link";
import { ArrowLeft, Eye, LockKeyhole } from "lucide-react";
import { PublicBlockAdapter } from "@/components/public-funnel/adapters/public-block-adapters";
import { FunnelThemeProvider } from "@/components/public-funnel/FunnelThemeProvider";
import { parseRuntimeBlocks } from "@/components/public-funnel/runtime-block-utils";
import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";

type FunnelPreviewRuntimeProps = {
  runtime: PublicFunnelRuntimePayload;
  backHref: string;
};

export function FunnelPreviewRuntime({
  runtime,
  backHref,
}: FunnelPreviewRuntimeProps) {
  const parsedBlocks = parseRuntimeBlocks(runtime.currentStep.blocksJson ?? []);
  const blocks = parsedBlocks.blocks;

  return (
    <FunnelThemeProvider runtime={runtime}>
      <div className="min-h-screen bg-app-bg">
        <header className="sticky top-0 z-30 border-b border-app-border bg-app-bg/92 px-4 py-3 backdrop-blur md:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={backHref}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-app-border bg-app-card text-app-text-muted transition hover:border-app-border-strong hover:bg-app-surface-muted hover:text-app-text"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-semibold text-app-text-soft">
                  <Eye className="h-3.5 w-3.5" />
                  Funnel Preview Runtime
                </p>
                <h1 className="truncate text-base font-semibold text-app-text">
                  {runtime.funnel.name}
                </h1>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-3 py-2 text-xs font-semibold text-app-text-muted">
              <LockKeyhole className="h-3.5 w-3.5" />
              Solo lectura: sin leads, tracking, WhatsApp, IA ni publicación
            </div>
          </div>
        </header>

        <main className="bg-white">
          <div className="pointer-events-none min-h-screen">
            {blocks.length > 0 ? (
              blocks.map((block, index) => (
                <PublicBlockAdapter
                  key={`${block.type}-${index}`}
                  block={block}
                  runtime={runtime}
                  blocks={blocks}
                  layoutVariant="single_column"
                />
              ))
            ) : (
              <section className="mx-auto flex min-h-[70vh] max-w-4xl flex-col justify-center px-6 py-16 text-slate-900">
                <p className="text-sm font-semibold uppercase text-slate-500">
                  Master Funnel
                </p>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                  {runtime.funnel.name}
                </h2>
                <p className="mt-4 text-lg leading-8 text-slate-600">
                  Este Master Funnel aún no tiene bloques renderizables para
                  preview.
                </p>
              </section>
            )}
          </div>
        </main>
      </div>
    </FunnelThemeProvider>
  );
}

