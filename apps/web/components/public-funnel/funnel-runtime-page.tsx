import Link from "next/link";
import { AssignedSponsorReveal } from "@/components/public-funnel/assigned-sponsor-reveal";
import { PublicCaptureForm } from "@/components/public-funnel/public-capture-form";
import { PublicRuntimeTracker } from "@/components/public-funnel/public-runtime-tracker";
import { TrackedCta } from "@/components/public-funnel/tracked-cta";
import type {
  JsonValue,
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";

type FunnelRuntimePageProps = {
  runtime: PublicFunnelRuntimePayload;
  previewHost?: string;
};

const asRecord = (
  value: JsonValue | undefined,
): Record<string, JsonValue> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, JsonValue>;
};

const asString = (value: JsonValue | undefined, fallback = "") => {
  return typeof value === "string" ? value : fallback;
};

const asStringArray = (value: JsonValue | undefined) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const asBlockArray = (value: JsonValue | undefined) => {
  if (!value || typeof value !== "object" || !("blocks" in value)) {
    return [] as RuntimeBlock[];
  }

  const blocks = (value as { blocks?: JsonValue }).blocks;
  if (!Array.isArray(blocks)) {
    return [] as RuntimeBlock[];
  }

  return blocks.reduce<RuntimeBlock[]>((accumulator, block) => {
    if (
      block &&
      typeof block === "object" &&
      !Array.isArray(block) &&
      typeof (block as { type?: unknown }).type === "string"
    ) {
      accumulator.push(block as RuntimeBlock);
    }

    return accumulator;
  }, []);
};

const asFaqItems = (value: JsonValue | undefined) => {
  if (!Array.isArray(value)) {
    return [] as { question: string; answer: string }[];
  }

  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      const question = asString(record.question);
      const answer = asString(record.answer);
      if (!question || !answer) {
        return null;
      }

      return { question, answer };
    })
    .filter((item): item is { question: string; answer: string } =>
      Boolean(item),
    );
};

const resolveCtaHref = (
  block: RuntimeBlock,
  runtime: PublicFunnelRuntimePayload,
) => {
  const directHref = asString(block.href);
  if (directHref) {
    return directHref;
  }

  const action = asString(block.action);
  if (action === "next_step") {
    return runtime.nextStep?.path ?? runtime.currentStep.path;
  }

  if (action === "entry_step") {
    return (
      runtime.steps.find((step) => step.isEntryStep)?.path ??
      runtime.currentStep.path
    );
  }

  return runtime.currentStep.path;
};

const toStepLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());

function BlockRenderer({
  block,
  runtime,
}: {
  block: RuntimeBlock;
  runtime: PublicFunnelRuntimePayload;
}) {
  const title = asString(block.title);
  const description = asString(block.description);

  switch (block.type) {
    case "hero": {
      const eyebrow = asString(block.eyebrow, runtime.funnel.name);
      const accent = asString(block.accent, "Signal");
      return (
        <section className="grid gap-8 rounded-[2.5rem] border border-white/15 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.24),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_28%),linear-gradient(135deg,_rgba(2,6,23,0.98)_0%,_rgba(15,23,42,0.94)_48%,_rgba(17,24,39,0.98)_100%)] p-8 text-white shadow-[0_36px_110px_rgba(15,23,42,0.34)] md:grid-cols-[1.2fr_0.8fr] md:p-12">
          <div className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-300">
                {eyebrow}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                  {toStepLabel(runtime.currentStep.stepType)}
                </span>
                <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                  {runtime.domain.host}
                </span>
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
                {title || runtime.funnel.name}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
                {description ||
                  "Leadflow convierte el runtime público en una experiencia más clara, más creíble y más orientada a conversión."}
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                  Publicación
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {runtime.publication.pathPrefix}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                  Tracking
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {runtime.trackingProfile?.provider ?? "Pendiente"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                  Handoff
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {runtime.handoff.buttonLabel ?? "Continuidad activa"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/7 p-6 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
              {eyebrow}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              {accent}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              Esta experiencia ya muestra estructura real de producto: mensaje,
              captura, thank-you y reveal conectados con tracking y handoff.
            </p>
            <div className="mt-5 grid gap-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/30 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">
                  Lo que vive aquí
                </p>
                <p className="mt-2 text-sm leading-6 text-white">
                  Copy más claro, CTA con jerarquía visible, mejor espaciado y
                  una lectura pública menos técnica.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/30 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">
                  Qué sigue
                </p>
                <p className="mt-2 text-sm leading-6 text-white">
                  La navegación del funnel sigue usando el mismo runtime y las
                  mismas rutas; lo que mejora es cómo se presenta el valor.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-teal-300/20 bg-teal-400/10 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-teal-200">
                  Señal comercial
                </p>
                <p className="mt-2 text-sm leading-6 text-white">
                  Funnel visible, legible y listo para validar captación sin
                  esperar un rediseño completo de templates.
                </p>
              </div>
            </div>
          </div>
        </section>
      );
    }

    case "text": {
      const items = asStringArray(block.items);
      return (
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            {description || asString(block.body)}
          </p>
          {items.length > 0 ? (
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {items.map((item, index) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,_#f8fafc_0%,_#ffffff_100%)] px-4 py-4 text-sm text-slate-700"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700">
                    Punto {index + 1}
                  </p>
                  <p className="mt-2 font-medium">{item}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-700">
              La experiencia pública mantiene el mismo contenido del runtime, pero con mejor jerarquía para que se lea y se entienda más rápido.
            </div>
          )}
        </section>
      );
    }

    case "video": {
      const embedUrl = asString(block.embedUrl);
      const caption = asString(block.caption);
      if (!embedUrl) {
        return null;
      }

      return (
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                {title}
              </h2>
              {caption ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {caption}
                </p>
              ) : null}
            </div>
            <div className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white">
              Demo guiada
            </div>
          </div>
          <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-950 shadow-inner">
            <div className="aspect-video">
              <iframe
                className="h-full w-full"
                src={embedUrl}
                title={title || "Leadflow funnel video"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </section>
      );
    }

    case "cta": {
      const href = resolveCtaHref(block, runtime);
      const label = `${asString(block.label, "Continuar")} →`;
      const variant = asString(block.variant, "primary");
      const classes =
        variant === "secondary"
          ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
          : "bg-slate-950 text-white hover:bg-slate-800";

      return (
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
                Siguiente movimiento
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {title || "Continuar en el funnel"}
              </h2>
              {description ? (
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {description}
                </p>
              ) : null}
            </div>

            {/^https?:\/\//.test(href) ? (
              <TrackedCta
                publicationId={runtime.publication.id}
                currentStepId={runtime.currentStep.id}
                currentPath={runtime.request.path}
                href={href}
                label={label}
                className={`inline-flex w-fit items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ${classes}`}
                action={asString(block.action) || null}
              />
            ) : (
              <TrackedCta
                publicationId={runtime.publication.id}
                currentStepId={runtime.currentStep.id}
                currentPath={runtime.request.path}
                href={href}
                label={label}
                className={`inline-flex w-fit items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition ${classes}`}
                action={asString(block.action) || null}
              />
            )}
          </div>
        </section>
      );
    }

    case "faq": {
      const items = asFaqItems(block.items);
      return (
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            {title || "FAQ"}
          </h2>
          <div className="mt-6 space-y-3">
            {items.map((item) => (
              <details
                key={item.question}
                className="group rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      );
    }

    case "form_placeholder": {
      const fields = asStringArray(block.fields);
      return (
        <PublicCaptureForm
          publicationId={runtime.publication.id}
          currentStepId={runtime.currentStep.id}
          fields={fields}
          title={title || "Formulario de captura"}
          description={description}
        />
      );
    }

    case "thank_you": {
      return (
        <section className="rounded-[2rem] border border-emerald-200 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.18),_transparent_30%),linear-gradient(180deg,_rgba(236,253,245,0.96)_0%,_rgba(209,250,229,0.92)_100%)] p-8 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
            {asString(block.eyebrow, "Gracias")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
            {description}
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              "Capturamos tu información y la asociamos a la publicación activa.",
              "Resolvemos assignment con el sponsor o siguiente paso correspondiente.",
              "Mostramos el reveal y el CTA de continuidad cuando aplica.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[1.5rem] border border-emerald-200 bg-white/80 px-4 py-4 text-sm leading-6 text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      );
    }

    case "sponsor_reveal_placeholder": {
      return (
        <AssignedSponsorReveal
          runtime={runtime}
          title={title || "Sponsor asignado"}
          description={description}
        />
      );
    }

    default:
      return null;
  }
}

export function FunnelRuntimePage({
  runtime,
  previewHost,
}: FunnelRuntimePageProps) {
  const blocks = asBlockArray(runtime.currentStep.blocksJson);
  const entryStepPath =
    runtime.steps.find((step) => step.isEntryStep)?.path ??
    runtime.currentStep.path;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.14),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_55%,_#f8fafc_100%)] px-4 py-6 md:px-8 md:py-10">
      <PublicRuntimeTracker runtime={runtime} previewHost={previewHost} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/85 px-5 py-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Leadflow Public Funnel
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {runtime.domain.host} · {runtime.request.path}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span className="rounded-full bg-slate-950 px-3 py-2 text-white">
                {toStepLabel(runtime.currentStep.stepType)}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-700">
                Paso {runtime.currentStep.position} de {runtime.steps.length}
              </span>
              {previewHost ? (
                <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-2 text-amber-800">
                  previewHost={previewHost}
                </span>
              ) : null}
              <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-700">
                Template {runtime.funnel.template.name}
              </span>
            </div>
          </div>
        </section>

        {blocks.map((block, index) => (
          <BlockRenderer
            key={asString(block.key, `${block.type}-${index}`)}
            block={block}
            runtime={runtime}
          />
        ))}

        <section className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Detras de esta experiencia
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Template
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {runtime.funnel.template.name}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {runtime.funnel.template.funnelType}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Tracking
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {runtime.trackingProfile?.name ?? "Sin perfil"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {runtime.trackingProfile?.provider ?? "Pendiente"}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <TrackedCta
                publicationId={runtime.publication.id}
                currentStepId={runtime.currentStep.id}
                currentPath={runtime.request.path}
                href={entryStepPath}
                label="Volver al inicio"
                className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                action="entry_step"
              />
              {runtime.nextStep ? (
                <TrackedCta
                  publicationId={runtime.publication.id}
                  currentStepId={runtime.currentStep.id}
                  currentPath={runtime.request.path}
                  href={runtime.nextStep.path}
                  label="Continuar"
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  action="next_step"
                />
              ) : null}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/80 bg-slate-950 p-8 text-white shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Ruta del funnel
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Cada paso sigue corriendo sobre el mismo runtime; esta vista solo
              hace más clara la transición entre entrada, captura, gracias y
              handoff.
            </p>
            <div className="mt-5 space-y-3">
              {runtime.steps.map((step) => {
                const isCurrent = step.id === runtime.currentStep.id;
                return (
                  <Link
                    key={step.id}
                    href={step.path}
                    className={`block rounded-[1.5rem] border px-4 py-4 transition ${
                      isCurrent
                        ? "border-teal-300 bg-teal-400/10 text-white"
                        : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      {toStepLabel(step.stepType)}
                    </p>
                    <p className="mt-2 text-base font-semibold">{step.path}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
