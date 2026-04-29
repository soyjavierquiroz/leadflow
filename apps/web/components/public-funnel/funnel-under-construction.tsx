import type { PublicFunnelRuntimePayload } from "@/lib/public-funnel-runtime.types";

type FunnelUnderConstructionProps = {
  runtime: PublicFunnelRuntimePayload;
};

export function FunnelUnderConstruction({
  runtime,
}: FunnelUnderConstructionProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] px-4 py-12 text-slate-950">
      <section className="w-full max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
          Leadflow
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
          Esta experiencia esta en construccion
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600">
          Estamos revisando el cableado de conversion antes de volver a publicar
          este funnel.
        </p>
        <div className="mx-auto mt-8 grid max-w-md gap-2 text-sm text-slate-500">
          <span>{runtime.domain.host}</span>
          <span>{runtime.publication.pathPrefix}</span>
        </div>
      </section>
    </main>
  );
}
