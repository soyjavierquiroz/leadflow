import Link from 'next/link';
import type { JsonValue, PublicFunnelRuntimePayload, RuntimeBlock } from '@/lib/funnel-runtime';

type FunnelRuntimePageProps = {
  runtime: PublicFunnelRuntimePayload;
  previewHost?: string;
};

const asRecord = (value: JsonValue | undefined): Record<string, JsonValue> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, JsonValue>;
};

const asString = (value: JsonValue | undefined, fallback = '') => {
  return typeof value === 'string' ? value : fallback;
};

const asStringArray = (value: JsonValue | undefined) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === 'string');
};

const asBlockArray = (value: JsonValue | undefined) => {
  if (!value || typeof value !== 'object' || !('blocks' in value)) {
    return [] as RuntimeBlock[];
  }

  const blocks = (value as { blocks?: JsonValue }).blocks;
  if (!Array.isArray(blocks)) {
    return [] as RuntimeBlock[];
  }

  return blocks.reduce<RuntimeBlock[]>((accumulator, block) => {
    if (
      block &&
      typeof block === 'object' &&
      !Array.isArray(block) &&
      typeof (block as { type?: unknown }).type === 'string'
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
    .filter((item): item is { question: string; answer: string } => Boolean(item));
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
  if (action === 'next_step') {
    return runtime.nextStep?.path ?? runtime.currentStep.path;
  }

  if (action === 'entry_step') {
    return runtime.steps.find((step) => step.isEntryStep)?.path ?? runtime.currentStep.path;
  }

  return runtime.currentStep.path;
};

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
    case 'hero': {
      const eyebrow = asString(block.eyebrow, runtime.funnel.name);
      const accent = asString(block.accent, 'Signal');
      return (
        <section className="grid gap-8 rounded-[2rem] border border-white/10 bg-slate-950/90 p-8 text-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] md:grid-cols-[1.3fr_0.9fr] md:p-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-300">
              {eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
              {title || runtime.funnel.name}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              {description || 'Runtime publico JSON-driven para Leadflow.'}
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
              {accent}
            </p>
            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Dominio</p>
                <p className="mt-2 text-lg font-semibold text-white">{runtime.domain.host}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Publicacion</p>
                <p className="mt-2 text-lg font-semibold text-white">{runtime.publication.pathPrefix}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Tracking</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {runtime.trackingProfile?.provider ?? 'pending'}
                </p>
              </div>
            </div>
          </div>
        </section>
      );
    }

    case 'text': {
      const items = asStringArray(block.items);
      return (
        <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{description || asString(block.body)}</p>
          {items.length > 0 ? (
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      );
    }

    case 'video': {
      const embedUrl = asString(block.embedUrl);
      const caption = asString(block.caption);
      if (!embedUrl) {
        return null;
      }

      return (
        <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
              {caption ? <p className="mt-2 text-sm text-slate-600">{caption}</p> : null}
            </div>
            <div className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white">
              Video MVP
            </div>
          </div>
          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950 shadow-inner">
            <div className="aspect-video">
              <iframe
                className="h-full w-full"
                src={embedUrl}
                title={title || 'Leadflow funnel video'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </section>
      );
    }

    case 'cta': {
      const href = resolveCtaHref(block, runtime);
      const label = asString(block.label, 'Continuar');
      const variant = asString(block.variant, 'primary');
      const classes =
        variant === 'secondary'
          ? 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-100'
          : 'bg-slate-950 text-white hover:bg-slate-800';

      if (/^https?:\/\//.test(href)) {
        return (
          <a
            href={href}
            className={`inline-flex w-fit items-center rounded-full px-6 py-3 text-sm font-semibold transition ${classes}`}
          >
            {label}
          </a>
        );
      }

      return (
        <Link
          href={href}
          className={`inline-flex w-fit items-center rounded-full px-6 py-3 text-sm font-semibold transition ${classes}`}
        >
          {label}
        </Link>
      );
    }

    case 'faq': {
      const items = asFaqItems(block.items);
      return (
        <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title || 'FAQ'}</h2>
          <div className="mt-6 space-y-3">
            {items.map((item) => (
              <details key={item.question} className="group rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      );
    }

    case 'form_placeholder': {
      const fields = asStringArray(block.fields);
      return (
        <section className="rounded-[1.75rem] border border-teal-200 bg-teal-50/90 p-8 shadow-[0_18px_50px_rgba(13,148,136,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title || 'Formulario placeholder'}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">{description}</p>
            </div>
            <div className="rounded-full border border-teal-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
              Sin persistencia todavia
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {fields.map((field) => (
              <label key={field} className="grid gap-2 text-sm font-medium text-slate-700">
                {field}
                <input
                  className="rounded-2xl border border-teal-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                  placeholder={field}
                  disabled
                />
              </label>
            ))}
          </div>
        </section>
      );
    }

    case 'thank_you': {
      return (
        <section className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50/90 p-8 shadow-[0_18px_50px_rgba(16,185,129,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
            {asString(block.eyebrow, 'Gracias')}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">{description}</p>
        </section>
      );
    }

    case 'sponsor_reveal_placeholder': {
      return (
        <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-8 shadow-[0_18px_50px_rgba(245,158,11,0.12)]">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">{description}</p>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-700">Sponsor reveal placeholder</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Este espacio queda reservado para assignment, sponsor seleccionado o handoff segun la estrategia que conectemos despues.
            </p>
          </div>
        </section>
      );
    }

    default:
      return null;
  }
}

export function FunnelRuntimePage({ runtime, previewHost }: FunnelRuntimePageProps) {
  const blocks = asBlockArray(runtime.currentStep.blocksJson);
  const entryStepPath =
    runtime.steps.find((step) => step.isEntryStep)?.path ?? runtime.currentStep.path;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.16),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-slate-200/80 bg-white/80 px-5 py-3 shadow-sm backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Leadflow Runtime</p>
            <p className="mt-1 text-sm text-slate-700">
              {runtime.domain.host}
              {' · '}
              {runtime.request.path}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <span className="rounded-full bg-slate-950 px-3 py-2 text-white">
              {runtime.currentStep.stepType}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-700">
              Step {runtime.currentStep.position} / {runtime.steps.length}
            </span>
            {previewHost ? (
              <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-2 text-amber-800">
                previewHost={previewHost}
              </span>
            ) : null}
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
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Runtime Metadata</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Template</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{runtime.funnel.template.name}</p>
                <p className="mt-1 text-sm text-slate-600">{runtime.funnel.template.funnelType}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Tracking</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {runtime.trackingProfile?.name ?? 'Sin perfil'}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {runtime.trackingProfile?.provider ?? 'pending'}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={entryStepPath}
                className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Volver al entry step
              </Link>
              {runtime.nextStep ? (
                <Link
                  href={runtime.nextStep.path}
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Ir al siguiente step
                </Link>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200/80 bg-slate-950 p-8 text-white shadow-[0_18px_50px_rgba(15,23,42,0.2)]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Navegacion del Funnel</p>
            <div className="mt-5 space-y-3">
              {runtime.steps.map((step) => {
                const isCurrent = step.id === runtime.currentStep.id;
                return (
                  <Link
                    key={step.id}
                    href={step.path}
                    className={`block rounded-2xl border px-4 py-4 transition ${
                      isCurrent
                        ? 'border-teal-300 bg-teal-400/10 text-white'
                        : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{step.stepType}</p>
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
