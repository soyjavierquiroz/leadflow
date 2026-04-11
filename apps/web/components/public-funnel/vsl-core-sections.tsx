import { Check, ChevronDown, Quote, X } from "lucide-react";

import {
  FunnelEyebrow,
  PublicSectionSurface,
  RichHeadline,
  cx,
  flatBlockTitleClassName,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import { resolveLeadflowBlockMedia } from "@/components/public-funnel/leadflow-media-resolver";
import type {
  JsonValue,
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";

export type VslChecklistItem = {
  text: string;
  itemIconType?: "cross" | "check";
};

export type VslSocialProofGridItem = {
  quote?: string;
  author?: string;
  role?: string;
  company?: string;
  headshotKey?: string;
  screenshotKey?: string;
};

export type VslFaqAccordionItem = {
  question: string;
  answer: string;
  defaultOpen?: boolean;
};

type VslSectionBaseProps = {
  runtime: PublicFunnelRuntimePayload;
  block?: RuntimeBlock;
  leadflowMetadata?: JsonValue;
};

export type VslAuthorityBioSectionProps = VslSectionBaseProps & {
  isBoxed?: boolean;
  eyebrow?: string;
  headline?: string;
  expertName?: string;
  expertTitle?: string;
  expertCredentials?: string;
  bioParagraphs?: string[];
  signatureCaption?: string;
  expertHeadshotKey?: string;
  signatureKey?: string;
  mediaPosition?: "left" | "right";
};

export type VslQualificationChecklistSectionProps = {
  isBoxed?: boolean;
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  goodFitTitle?: string;
  badFitTitle?: string;
  goodFitItems?: VslChecklistItem[];
  badFitItems?: VslChecklistItem[];
};

export type VslSocialProofGridSectionProps = VslSectionBaseProps & {
  isBoxed?: boolean;
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  testimonials?: VslSocialProofGridItem[];
};

export type VslFaqAccordionSectionProps = {
  isBoxed?: boolean;
  eyebrow?: string;
  headline?: string;
  items?: VslFaqAccordionItem[];
};

const defaultAuthorityBioParagraphs = [
  "Hola, soy Russell Brunson. Durante años estuve obsesionado con una sola pregunta: ¿por qué algunas ofertas convierten casi de inmediato mientras otras, incluso siendo buenas, se quedan ignoradas?",
  "Después de gastar millones de dólares comprando tráfico, construyendo funnels y estudiando campañas ganadoras, descubrí que la diferencia casi nunca está en tener más información. Está en contar la historia correcta, en el orden correcto, de una forma que haga que la gente se vea a sí misma dentro del resultado.",
  "Eso es lo que vas a ver en esta VSL: un proceso claro para mover a la persona desde la curiosidad, a la creencia, y de la creencia a la acción. No necesitas más ruido; necesitas el mensaje que haga clic.",
];

const defaultGoodFitItems: VslChecklistItem[] = [
  { text: "Quieres una explicación clara antes de tomar una decisión." },
  { text: "Valoras frameworks probados en campañas reales." },
  { text: "Buscas avanzar rápido, pero con contexto y criterio." },
];

const defaultBadFitItems: VslChecklistItem[] = [
  { text: "Solo quieres tácticas aisladas sin entender la estrategia." },
  { text: "Esperas resultados sin implementar ni medir." },
  { text: "Prefieres seguir improvisando en lugar de ordenar tu mensaje." },
];

const defaultSocialProofItems: VslSocialProofGridItem[] = [
  {
    quote:
      "La narrativa dejó de sentirse genérica. La VSL empezó a filtrar mejor y llegaban leads mucho más conscientes.",
    author: "Mariana P.",
    role: "Consultora de crecimiento",
    company: "Scale Operators",
  },
  {
    quote:
      "Lo que más cambió fue la claridad. El prospecto ya entendía por qué debía actuar antes de hablar con nosotros.",
    author: "Javier R.",
    role: "Founder",
    company: "Pipeline Crew",
  },
];

const defaultFaqItems: VslFaqAccordionItem[] = [
  {
    question: "¿Necesito experiencia previa con funnels o VSLs?",
    answer:
      "No. La estructura está diseñada para que entiendas el porqué detrás de cada bloque y puedas adaptarlo sin depender de tecnicismos.",
    defaultOpen: true,
  },
  {
    question: "¿Esto sirve si ya tengo tráfico pero convierto poco?",
    answer:
      "Sí. De hecho, suele ser el caso ideal: no necesitas más visitas, sino una historia más creíble y una secuencia que elimine objeciones antes del CTA.",
  },
  {
    question: "¿Qué pasa si mi mercado es distinto?",
    answer:
      "La arquitectura se adapta por ángulo, prueba y oferta. Lo que se mantiene es la psicología del orden del mensaje.",
  },
];

function resolveMediaFromKey(
  props: VslSectionBaseProps,
  candidateKey: string | undefined,
  fallbackAlt: string,
) {
  if (!candidateKey?.trim()) {
    return null;
  }

  return resolveLeadflowBlockMedia({
    runtime: props.runtime,
    block: props.block,
    fallbackAlt,
    candidate: candidateKey,
    leadflowMetadata: props.leadflowMetadata,
  });
}

function renderInitialsFallback(label: string) {
  const initials = label
    .split(/\s+/)
    .map((token) => token.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-full min-h-[20rem] w-full items-center justify-center rounded-[2rem] border border-white/60 bg-white/70">
      <span className="font-headline text-5xl font-black tracking-[-0.06em] text-slate-400">
        {initials || "LF"}
      </span>
    </div>
  );
}

export function VslAuthorityBioSection({
  isBoxed = false,
  runtime,
  block,
  leadflowMetadata,
  eyebrow = "Quien soy yo para ayudarte con esto",
  headline = "Hola, soy Russell Brunson...",
  expertName = "Russell Brunson",
  expertTitle = "Emprendedor, autor y constructor de funnels",
  expertCredentials = "Creador de campañas, libros y entrenamientos usados por miles de negocios para vender con claridad.",
  bioParagraphs = defaultAuthorityBioParagraphs,
  signatureCaption = "Con aprecio,",
  expertHeadshotKey,
  signatureKey,
  mediaPosition = "left",
}: VslAuthorityBioSectionProps) {
  const sectionProps = { runtime, block, leadflowMetadata };
  const headshot = resolveMediaFromKey(
    sectionProps,
    expertHeadshotKey,
    `${expertName} headshot`,
  );
  const signature = resolveMediaFromKey(
    sectionProps,
    signatureKey,
    `${expertName} signature`,
  );
  const isMediaRight = mediaPosition === "right";
  const safeParagraphs = bioParagraphs.filter((paragraph) => paragraph.trim());

  if (!headline.trim() && safeParagraphs.length === 0) {
    return null;
  }

  return (
    <PublicSectionSurface isBoxed={isBoxed} surfaceSlot="authority-bio" variant="flat">
      <div>
        <div
          className={cx(
            "grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center",
            isMediaRight ? "lg:grid-cols-[1.22fr_0.78fr]" : "",
          )}
        >
          <div className={cx(isMediaRight ? "lg:order-2" : "")}>
            <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/70 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
              <div className="overflow-hidden rounded-[1.6rem] bg-white">
                {headshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={headshot.src}
                    alt={headshot.alt}
                    loading="lazy"
                    className="h-full min-h-[20rem] w-full object-cover"
                  />
                ) : (
                  renderInitialsFallback(expertName)
                )}
              </div>
              <div className="mt-5 rounded-[1.5rem] border border-white/70 bg-white/80 px-5 py-4">
                <p className="font-headline text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">
                  Autoridad
                </p>
                <p className="mt-2 font-headline text-2xl font-black tracking-tight [color:var(--theme-section-authority-bio-expert-name)]">
                  {expertName}
                </p>
                <p className="mt-2 font-subheadline text-base font-semibold text-slate-700">
                  {expertTitle}
                </p>
                {expertCredentials ? (
                  <p className="mt-3 font-body text-sm leading-6 text-slate-600">
                    {expertCredentials}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className={cx("min-w-0", isMediaRight ? "lg:order-1" : "")}>
            <FunnelEyebrow>{eyebrow}</FunnelEyebrow>
            <h2
              className={cx(
                "mt-4",
                flatBlockTitleClassName,
                "[color:var(--theme-section-authority-bio-text)]",
              )}
            >
              <RichHeadline text={headline} />
            </h2>
            <div className="mt-6 space-y-5">
              {safeParagraphs.map((paragraph, index) => (
                <p
                  key={`${paragraph.slice(0, 24)}-${index}`}
                  className="font-body text-lg leading-8 [color:var(--theme-section-authority-bio-text)]"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            {signature || signatureCaption ? (
              <div className="mt-8">
                {signatureCaption ? (
                  <p className="font-subheadline text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {signatureCaption}
                  </p>
                ) : null}
                {signature ? (
                  <div className="mt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signature.src}
                      alt={signature.alt}
                      loading="lazy"
                      className="h-14 w-auto object-contain"
                    />
                  </div>
                ) : (
                  <p className="font-headline mt-3 text-2xl font-black italic [color:var(--theme-section-authority-bio-expert-name)]">
                    {expertName}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PublicSectionSurface>
  );
}

function QualificationColumn({
  title,
  items,
  defaultIcon,
}: {
  title: string;
  items: VslChecklistItem[];
  defaultIcon: "check" | "cross";
}) {
  const safeItems = items.filter((item) => item.text.trim());

  if (safeItems.length === 0) {
    return null;
  }

  return (
    <div className="p-1">
      <h3 className="font-headline text-xl font-black tracking-tight [color:var(--theme-section-qualification-text)]">
        {title}
      </h3>
      <div className="mt-5 space-y-4">
        {safeItems.map((item, index) => {
          const iconType = item.itemIconType ?? defaultIcon;
          const iconColor =
            iconType === "cross"
              ? "var(--theme-section-qualification-cross-color)"
              : "var(--theme-section-qualification-check-color)";

          return (
            <div
              key={`${item.text.slice(0, 24)}-${index}`}
              className="flex items-start gap-4"
            >
              <span
                className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                style={{
                  color: iconColor,
                  borderColor: `color-mix(in srgb, ${iconColor} 35%, white)`,
                  background: `color-mix(in srgb, ${iconColor} 12%, white)`,
                }}
              >
                {iconType === "cross" ? (
                  <X className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <p className="font-body text-base leading-7 [color:var(--theme-section-qualification-text)]">
                {item.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function VslQualificationChecklistSection({
  isBoxed = false,
  eyebrow = "Filtro de audiencia",
  headline = "Esta presentacion esta disenada para un perfil muy especifico",
  subheadline = "Cuanto mejor encajes con este marco, mas rapido entenderas por que funciona y si deberias avanzar ahora.",
  goodFitTitle = "PARA QUIEN ES",
  badFitTitle = "PARA QUIEN NO ES",
  goodFitItems = defaultGoodFitItems,
  badFitItems = defaultBadFitItems,
}: VslQualificationChecklistSectionProps) {
  const safeGoodFitItems = goodFitItems.filter((item) => item.text.trim());
  const safeBadFitItems = badFitItems.filter((item) => item.text.trim());

  if (!headline.trim() && safeGoodFitItems.length === 0 && safeBadFitItems.length === 0) {
    return null;
  }

  return (
    <PublicSectionSurface isBoxed={isBoxed} surfaceSlot="qualification" variant="flat">
      <div>
        <div className="max-w-3xl">
          <FunnelEyebrow>{eyebrow}</FunnelEyebrow>
          <h2
            className={cx(
              "mt-4",
              flatBlockTitleClassName,
              "[color:var(--theme-section-qualification-text)]",
            )}
          >
            <RichHeadline text={headline} />
          </h2>
          {subheadline ? (
            <p className="mt-4 font-body text-lg leading-8 [color:var(--theme-section-qualification-text)] opacity-90">
              {subheadline}
            </p>
          ) : null}
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <QualificationColumn
            title={goodFitTitle}
            items={safeGoodFitItems}
            defaultIcon="check"
          />
          <QualificationColumn
            title={badFitTitle}
            items={safeBadFitItems}
            defaultIcon="cross"
          />
        </div>
      </div>
    </PublicSectionSurface>
  );
}

export function VslSocialProofGridSection({
  isBoxed = false,
  runtime,
  block,
  leadflowMetadata,
  eyebrow = "Prueba social",
  headline = "Lo que pasa cuando el mensaje correcto encuentra al prospecto correcto",
  subheadline = "Un muro de validacion visual y narrativa para reducir escepticismo sin interrumpir la historia principal.",
  testimonials = defaultSocialProofItems,
}: VslSocialProofGridSectionProps) {
  const safeTestimonials = testimonials.filter((item) => {
    return Boolean(
      item.quote?.trim() ||
        item.author?.trim() ||
        item.screenshotKey?.trim() ||
        item.headshotKey?.trim(),
    );
  });

  if (!headline.trim() && safeTestimonials.length === 0) {
    return null;
  }

  return (
    <PublicSectionSurface
      isBoxed={isBoxed}
      surfaceSlot="social-proof-grid"
      variant="flat"
    >
      <div>
        <div className="max-w-3xl">
          <FunnelEyebrow>{eyebrow}</FunnelEyebrow>
          <h2
            className={cx(
              "mt-4",
              flatBlockTitleClassName,
              "[color:var(--theme-section-social-proof-grid-text)]",
            )}
          >
            <RichHeadline text={headline} />
          </h2>
          {subheadline ? (
            <p className="mt-4 font-body text-lg leading-8 [color:var(--theme-section-social-proof-grid-text)] opacity-90">
              {subheadline}
            </p>
          ) : null}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {safeTestimonials.map((item, index) => {
            const screenshot = resolveMediaFromKey(
              { runtime, block, leadflowMetadata },
              item.screenshotKey,
              item.author?.trim() || `Screenshot testimonial ${index + 1}`,
            );
            const headshot = resolveMediaFromKey(
              { runtime, block, leadflowMetadata },
              item.headshotKey,
              item.author?.trim() || `Headshot testimonial ${index + 1}`,
            );
            const detail = [item.role, item.company].filter(Boolean).join(" · ");

            if (screenshot) {
              return (
                <article
                  key={`${item.screenshotKey ?? "shot"}-${index}`}
                  className="overflow-hidden rounded-[1.8rem] border p-3 shadow-[0_14px_38px_rgba(15,23,42,0.06)] md:col-span-2 [background:var(--theme-section-social-proof-grid-testimonial-bg)] [border-color:var(--theme-section-social-proof-grid-testimonial-border)]"
                >
                  <div className="overflow-hidden rounded-[1.25rem] border border-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screenshot.src}
                      alt={screenshot.alt}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {item.author || detail ? (
                    <div className="px-3 pb-2 pt-4">
                      {item.author ? (
                        <p className="font-headline text-base font-black [color:var(--theme-section-social-proof-grid-text)]">
                          {item.author}
                        </p>
                      ) : null}
                      {detail ? (
                        <p className="mt-1 font-body text-sm text-slate-500">
                          {detail}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            }

            return (
              <article
                key={`${item.author ?? item.quote ?? "quote"}-${index}`}
                className="flex h-full flex-col rounded-[1.8rem] border px-5 py-5 shadow-[0_14px_38px_rgba(15,23,42,0.06)] [background:var(--theme-section-social-proof-grid-testimonial-bg)] [border-color:var(--theme-section-social-proof-grid-testimonial-border)]"
              >
                <Quote
                  aria-hidden="true"
                  className="h-8 w-8 [color:var(--theme-brand-trust)]"
                />
                {item.quote ? (
                  <p className="mt-4 font-body text-[1.03rem] leading-8 [color:var(--theme-section-social-proof-grid-text)]">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                ) : null}
                <div className="mt-6 flex items-center gap-4">
                  {headshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={headshot.src}
                      alt={headshot.alt}
                      loading="lazy"
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 font-headline text-sm font-black text-slate-500">
                      {(item.author ?? "LF")
                        .split(/\s+/)
                        .map((token) => token.charAt(0))
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div>
                    {item.author ? (
                      <p className="font-headline text-base font-black [color:var(--theme-section-social-proof-grid-text)]">
                        {item.author}
                      </p>
                    ) : null}
                    {detail ? (
                      <p className="mt-1 font-body text-sm text-slate-500">
                        {detail}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </PublicSectionSurface>
  );
}

export function VslFaqAccordionSection({
  isBoxed = false,
  eyebrow = "Preguntas frecuentes",
  headline = "Resolvamos las objeciones antes de que se conviertan en friccion",
  items = defaultFaqItems,
}: VslFaqAccordionSectionProps) {
  const safeItems = items.filter(
    (item) => item.question.trim() && item.answer.trim(),
  );

  if (!headline.trim() && safeItems.length === 0) {
    return null;
  }

  return (
    <PublicSectionSurface isBoxed={isBoxed} surfaceSlot="faq-accordion" variant="flat">
      <div>
        <div className="max-w-3xl">
          <FunnelEyebrow>{eyebrow}</FunnelEyebrow>
          <h2
            className={cx(
              "mt-4",
              flatBlockTitleClassName,
              "[color:var(--theme-section-faq-accordion-text-headline)]",
            )}
          >
            <RichHeadline text={headline} />
          </h2>
        </div>

        <div className="mt-8">
          {safeItems.map((item, index) => (
            <details
              key={`${item.question}-${index}`}
              open={item.defaultOpen ?? index === 0}
              className="group border-b py-5 [border-color:var(--theme-section-faq-accordion-divider)]"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                <span className="font-subheadline text-lg font-semibold [color:var(--theme-section-faq-accordion-text-headline)]">
                  {item.question}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <p className="font-body mt-4 max-w-3xl text-base text-[var(--theme-text-body)] opacity-90">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </PublicSectionSurface>
  );
}
