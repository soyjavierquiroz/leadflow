import { AssignedSponsorReveal } from "@/components/public-funnel/assigned-sponsor-reveal";
import {
  buildCtaClassName,
  PublicChecklistItem,
  PublicEyebrow,
  PublicPill,
  PublicQuoteCard,
  PublicSectionSurface,
  PublicStatCard,
  cx,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import { PublicCaptureForm } from "@/components/public-funnel/public-capture-form";
import { TrackedCta } from "@/components/public-funnel/tracked-cta";
import { UrgencyTimerBlock } from "@/components/public-funnel/urgency-timer-block";
import { WhatsappHandoffCta } from "@/components/public-funnel/whatsapp-handoff-cta";
import type {
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";
import {
  asFaqItems,
  asFeatureItems,
  asMediaItem,
  asMetricItems,
  asNumber,
  asOfferItems,
  asString,
  asStringArray,
  asTestimonialItems,
  extractImageFromMap,
  normalizeLeadCaptureFormBlock,
  normalizeRuntimeBlockType,
  resolveCtaHref,
  toStepLabel,
} from "@/components/public-funnel/runtime-block-utils";

type PublicBlockAdapterProps = {
  block: RuntimeBlock;
  runtime: PublicFunnelRuntimePayload;
  blocks: RuntimeBlock[];
};

function HeroBlockAdapter({
  block,
  runtime,
  blocks,
}: PublicBlockAdapterProps) {
  const variant = asString(block.variant, "leadflow_signal");
  const title = asString(block.title, runtime.funnel.name);
  const description = asString(
    block.description,
    "Una experiencia pública más clara, más confiable y mejor preparada para convertir en móvil.",
  );
  const eyebrow = asString(block.eyebrow, runtime.funnel.name);
  const accent = asString(block.accent, "Funnel listo para convertir");
  const metrics = asMetricItems(block.metrics);
  const proofItems = asStringArray(block.proofItems);
  const hasCaptureBlock = blocks.some(
    (item) => normalizeRuntimeBlockType(item.type) === "lead_capture_form",
  );
  const media =
    asMediaItem(block.media, title) ??
    extractImageFromMap(
      runtime.currentStep.mediaMap,
      ["heroImage", "coverImage", "image"],
      title,
    );
  const heroMetrics =
    metrics.length > 0
      ? metrics
      : [
          {
            label: "Ruta activa",
            value: runtime.publication.pathPrefix,
            description: "Publicación resuelta por host + path.",
          },
          {
            label: "Continuidad",
            value: runtime.handoff.buttonLabel ?? "WhatsApp listo",
            description: "El handoff mantiene su contrato actual.",
          },
          {
            label: "Paso actual",
            value: `${runtime.currentStep.position}/${runtime.steps.length}`,
            description: toStepLabel(runtime.currentStep.stepType),
          },
        ];
  const heroProof =
    proofItems.length > 0
      ? proofItems
      : [
          "Copy más claro para entender la propuesta sin fricción técnica.",
          "Captura y handoff con continuidad visible en cada step.",
          "Jerarquía visual sólida para desktop y mobile.",
        ];
  const primaryCtaHref =
    asString(block.primaryCtaHref) ||
    (hasCaptureBlock ? "#public-capture-form" : runtime.nextStep?.path) ||
    runtime.currentStep.path;
  const primaryCtaLabel = asString(
    block.primaryCtaLabel,
    hasCaptureBlock ? "Quiero dejar mis datos" : "Continuar",
  );
  const secondaryCtaHref =
    asString(block.secondaryCtaHref) ||
    runtime.previousStep?.path ||
    runtime.steps.find((step) => step.isEntryStep)?.path ||
    runtime.currentStep.path;
  const secondaryCtaLabel = asString(
    block.secondaryCtaLabel,
    runtime.currentStep.isEntryStep ? "Ver detalles del funnel" : "Volver al inicio",
  );

  return (
    <PublicSectionSurface
      tone="brand"
      className={cx(
        "md:p-10",
        variant === "opportunity" ? "border-amber-300/30" : "",
      )}
    >
      <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-stretch">
        <div className="flex flex-col justify-between">
          <div>
            <PublicEyebrow>{eyebrow}</PublicEyebrow>
            <div className="mt-5 flex flex-wrap gap-2">
              <PublicPill tone="brand">
                {variant === "opportunity"
                  ? "Oportunidad"
                  : toStepLabel(runtime.currentStep.stepType)}
              </PublicPill>
              <PublicPill tone="brand">{runtime.domain.host}</PublicPill>
              <PublicPill tone="brand">
                {variant === "opportunity"
                  ? "Ruta de oportunidad"
                  : `Paso ${runtime.currentStep.position} de ${runtime.steps.length}`}
              </PublicPill>
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
              {description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <TrackedCta
                publicationId={runtime.publication.id}
                currentStepId={runtime.currentStep.id}
                currentPath={runtime.request.path}
                href={primaryCtaHref}
                label={primaryCtaLabel}
                className={buildCtaClassName("primary")}
                action={hasCaptureBlock ? "scroll_to_capture" : "hero_primary"}
              />
              <TrackedCta
                publicationId={runtime.publication.id}
                currentStepId={runtime.currentStep.id}
                currentPath={runtime.request.path}
                href={secondaryCtaHref}
                label={secondaryCtaLabel}
                className={cx(
                  buildCtaClassName("secondary"),
                  "border-white/20 bg-white/8 text-white hover:bg-white/14",
                )}
                action="hero_secondary"
              />
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {heroMetrics.map((item) => (
              <PublicStatCard
                key={`${item.label}-${item.value}`}
                label={item.label}
                value={item.value}
                description={item.description}
                tone="brand"
              />
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/7 p-5 backdrop-blur">
          {media ? (
            <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.src}
                alt={media.alt}
                className="h-64 w-full object-cover md:h-72"
              />
            </div>
          ) : null}
          <div className={cx("grid gap-4", media ? "mt-5" : "")}>
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">
                {accent}
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                {variant === "opportunity"
                  ? "Este hero prioriza momentum comercial y transición rápida hacia la captura."
                  : "La historia del funnel ahora se entiende completa: promesa, prueba, captura, confirmación y continuidad."}
              </p>
            </div>
            <div className="grid gap-3">
              {heroProof.map((item) => (
                <PublicChecklistItem key={item}>{item}</PublicChecklistItem>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PublicSectionSurface>
  );
}

function HookAndPromiseBlockAdapter({
  block,
  runtime,
}: PublicBlockAdapterProps) {
  const eyebrow = asString(block.eyebrow, "Hook & Promise");
  const hook = asString(
    block.hook,
    asString(block.title, "Atrae atención con una propuesta clara"),
  );
  const promise = asString(
    block.promise,
    asString(
      block.description,
      "Bloque comercial diseñado para abrir el funnel con claridad, tensión positiva y continuidad hacia la captura.",
    ),
  );
  const points = asStringArray(block.items);
  const ctaHref =
    asString(block.href) ||
    runtime.steps.find((step) => step.isEntryStep)?.path ||
    runtime.currentStep.path;
  const ctaLabel = asString(block.label, "Quiero ver cómo funciona");

  return (
    <PublicSectionSurface tone="brand">
      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div>
          <PublicEyebrow>{eyebrow}</PublicEyebrow>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            {hook}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
            {promise}
          </p>
          <div className="mt-7">
            <TrackedCta
              publicationId={runtime.publication.id}
              currentStepId={runtime.currentStep.id}
              currentPath={runtime.request.path}
              href={ctaHref}
              label={ctaLabel}
              className={buildCtaClassName("primary")}
              action={asString(block.action) || "hook_primary"}
            />
          </div>
        </div>

        <div className="grid gap-3">
          {(points.length > 0
            ? points
            : [
                "Copy directo para abrir interés sin rodeos.",
                "Promesa alineada al siguiente paso del funnel.",
                "Bloque pensado para presets comerciales futuros.",
              ]
          ).map((item) => (
            <PublicChecklistItem key={item}>{item}</PublicChecklistItem>
          ))}
        </div>
      </div>
    </PublicSectionSurface>
  );
}

function TextBlockAdapter({ block, runtime, blocks }: PublicBlockAdapterProps) {
  const title = asString(block.title);
  const description = asString(block.description, asString(block.body));
  const variant = asString(block.variant, asString(block.layout));

  if (variant === "social_proof") {
    return (
      <SocialProofBlockAdapter block={block} runtime={runtime} blocks={blocks} />
    );
  }

  if (variant === "feature_grid") {
    return (
      <FeatureGridBlockAdapter block={block} runtime={runtime} blocks={blocks} />
    );
  }

  const items = asFeatureItems(block.items);

  return (
    <PublicSectionSurface>
      <div className="max-w-3xl">
        <PublicEyebrow tone="neutral">Valor explicado sin ruido</PublicEyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-600">
          {description ||
            "La experiencia pública conserva el contrato del runtime pero ordena mejor el mensaje para que el valor se entienda más rápido."}
        </p>
      </div>
      {items.length > 0 ? (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map((item, index) => (
            <article
              key={`${item.title}-${index}`}
              className="rounded-[1.6rem] border border-slate-200 bg-white p-5"
            >
              <PublicEyebrow tone="neutral" className="text-teal-700">
                {item.eyebrow ?? `Punto ${index + 1}`}
              </PublicEyebrow>
              <h3 className="mt-3 text-lg font-semibold text-slate-950">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {item.description ||
                  "Bloque listo para comunicar beneficios, fricción reducida y siguiente paso comercial."}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
          Este bloque sigue siendo JSON-driven. Lo que cambia en v2 es la
          composición visual: mejor espaciado, más contraste y una lectura más
          clara entre secciones.
        </div>
      )}
    </PublicSectionSurface>
  );
}

function UrgencyTimerBlockAdapter({ block }: PublicBlockAdapterProps) {
  return (
    <UrgencyTimerBlock
      eyebrow={asString(block.eyebrow) || undefined}
      headline={asString(block.headline, asString(block.title, "Cierre próximo"))}
      subheadline={
        asString(block.subheadline, asString(block.description)) || undefined
      }
      expiresAt={
        asString(
          block.expires_at,
          asString(block.expiresAt, asString(block.deadline)),
        ) || undefined
      }
      durationMinutes={
        asNumber(block.duration_minutes, asNumber(block.durationMinutes, 0)) || undefined
      }
    />
  );
}

function VideoBlockAdapter({ block, runtime }: PublicBlockAdapterProps) {
  const title = asString(block.title, "Vista guiada");
  const caption = asString(block.caption);
  const embedUrl = asString(block.embedUrl);
  const bullets = asStringArray(block.items);

  if (!embedUrl) {
    return null;
  }

  const checklist =
    bullets.length > 0
      ? bullets
      : [
          "Demuestra la propuesta antes de pedir datos.",
          "Da contexto al valor sin forzar texto largo.",
          "Refuerza confianza con una pieza visual central.",
        ];

  return (
    <PublicSectionSurface>
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <PublicEyebrow tone="neutral">Prueba visual</PublicEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          {caption ? (
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              {caption}
            </p>
          ) : null}
          <div className="mt-6 overflow-hidden rounded-[1.8rem] border border-slate-200 bg-slate-950 shadow-inner">
            <div className="aspect-video">
              <iframe
                className="h-full w-full"
                src={embedUrl}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
          <PublicEyebrow tone="neutral">Qué refuerza este bloque</PublicEyebrow>
          <p className="mt-3 text-lg font-semibold text-slate-950">
            Una pieza media ya no se siente como relleno: acompaña la decisión y
            sostiene el siguiente paso del funnel.
          </p>
          <div className="mt-6 grid gap-3">
            {checklist.map((item) => (
              <PublicChecklistItem key={item}>{item}</PublicChecklistItem>
            ))}
          </div>
          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-4">
            <p className="text-sm leading-6 text-slate-700">
              Paso conectado: {toStepLabel(runtime.currentStep.stepType)} sobre{" "}
              {runtime.request.path}.
            </p>
          </div>
        </div>
      </div>
    </PublicSectionSurface>
  );
}

function CtaBlockAdapter({ block, runtime }: PublicBlockAdapterProps) {
  const title = asString(block.title, "Continuar en el funnel");
  const description = asString(
    block.description,
    "Un CTA claro para empujar el siguiente movimiento sin romper el tracking ni la navegación actual.",
  );
  const href = resolveCtaHref(block, runtime);
  const label = asString(block.label, "Continuar");
  const variant =
    asString(block.variant) === "secondary" ? "secondary" : "primary";
  const highlights = asStringArray(block.items);
  const items =
    highlights.length > 0
      ? highlights
      : [
          runtime.nextStep
            ? `Siguiente step: ${toStepLabel(runtime.nextStep.stepType)}`
            : "La acción se mantiene en el step actual.",
          "Seguimos emitiendo tracking al hacer click.",
          "El runtime conserva el mismo contrato de navegación.",
        ];

  return (
    <PublicSectionSurface className="md:p-10">
      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div>
          <PublicEyebrow tone="neutral">CTA principal</PublicEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            {description}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <TrackedCta
              publicationId={runtime.publication.id}
              currentStepId={runtime.currentStep.id}
              currentPath={runtime.request.path}
              href={href}
              label={label}
              className={buildCtaClassName(variant)}
              action={asString(block.action) || null}
            />
            {runtime.previousStep ? (
              <TrackedCta
                publicationId={runtime.publication.id}
                currentStepId={runtime.currentStep.id}
                currentPath={runtime.request.path}
                href={runtime.previousStep.path}
                label="Revisar paso anterior"
                className={buildCtaClassName("secondary")}
                action="previous_step"
              />
            ) : null}
          </div>
        </div>

        <div className="grid gap-3">
          {items.map((item) => (
            <PublicChecklistItem key={item}>{item}</PublicChecklistItem>
          ))}
        </div>
      </div>
    </PublicSectionSurface>
  );
}

function FaqBlockAdapter({ block }: PublicBlockAdapterProps) {
  const variant = asString(block.variant, "accordion");
  const title = asString(block.title, "Preguntas frecuentes");
  const items = asFaqItems(block.items);

  return (
    <PublicSectionSurface>
      <div className="max-w-3xl">
        <PublicEyebrow tone="neutral">
          {variant === "accordion" ? "FAQ accordion" : "Confianza y objeciones"}
        </PublicEyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
      </div>
      <div className="mt-8 space-y-3">
        {items.map((item) => (
          <details
            key={item.question}
            className="group rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5 open:bg-white"
          >
            <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">
              {item.question}
            </summary>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
          </details>
        ))}
      </div>
    </PublicSectionSurface>
  );
}

function SocialProofBlockAdapter({ block }: PublicBlockAdapterProps) {
  const variant = asString(block.variant, "metrics_trust");
  const title = asString(block.title, "Prueba social");
  const description = asString(
    block.description,
    "Bloque preparado para absorber métricas, logos, resultados o señales de confianza sin tocar el renderer base.",
  );
  const metrics = asMetricItems(block.metrics ?? block.items);
  const testimonials = asTestimonialItems(block.testimonials);
  const featureItems = asFeatureItems(block.items);
  const fallbackMetrics = [
    {
      label: "Legibilidad",
      value: "v2",
      description: "Más claridad en móvil y mejor ritmo entre bloques.",
    },
    {
      label: "Contrato",
      value: "JSON-driven",
      description: "La presentación cambia, el runtime no se rompe.",
    },
    {
      label: "Handoff",
      value: "Visible",
      description: "La continuidad comercial ahora se percibe mejor.",
    },
  ];

  return (
    <PublicSectionSurface>
      <div className="max-w-3xl">
        <PublicEyebrow tone="neutral">Social proof adapter</PublicEyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {(metrics.length > 0 ? metrics : fallbackMetrics).map((item) => (
          <PublicStatCard
            key={`${item.label}-${item.value}`}
            label={item.label}
            value={item.value}
            description={item.description}
          />
        ))}
      </div>
      {variant === "risk_reversal" && featureItems.length > 0 ? (
        <div className="mt-8 grid gap-3">
          {featureItems.map((item) => (
            <PublicChecklistItem key={item.title}>{item.title}</PublicChecklistItem>
          ))}
        </div>
      ) : null}
      {testimonials.length > 0 ? (
        <div
          className={cx(
            "mt-8 grid gap-4",
            variant === "testimonials_focus" ? "lg:grid-cols-3" : "lg:grid-cols-2",
          )}
        >
          {testimonials.map((item) => (
            <PublicQuoteCard
              key={`${item.author}-${item.quote}`}
              quote={item.quote}
              author={item.author}
              detail={[item.role, item.company].filter(Boolean).join(" · ")}
            />
          ))}
        </div>
      ) : null}
    </PublicSectionSurface>
  );
}

function TestimonialsBlockAdapter({ block }: PublicBlockAdapterProps) {
  const title = asString(block.title, "Testimonios");
  const description = asString(
    block.description,
    "Adapter listo para piezas recicladas de quotes, social proof narrativo o casos cortos.",
  );
  const testimonials = asTestimonialItems(block.items ?? block.testimonials);

  return (
    <PublicSectionSurface>
      <div className="max-w-3xl">
        <PublicEyebrow tone="neutral">Testimonials adapter</PublicEyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {testimonials.map((item) => (
          <PublicQuoteCard
            key={`${item.author}-${item.quote}`}
            quote={item.quote}
            author={item.author}
            detail={[item.role, item.company].filter(Boolean).join(" · ")}
          />
        ))}
      </div>
    </PublicSectionSurface>
  );
}

function FeatureGridBlockAdapter({ block }: PublicBlockAdapterProps) {
  const title = asString(block.title, "Bloques de valor");
  const description = asString(
    block.description,
    "La capa de adapters ya puede desacoplar secciones de features del contrato bruto del runtime.",
  );
  const items = asFeatureItems(block.items);

  return (
    <PublicSectionSurface>
      <div className="max-w-3xl">
        <PublicEyebrow tone="neutral">Feature grid adapter</PublicEyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {items.map((item, index) => (
          <article
            key={`${item.title}-${index}`}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-5"
          >
            <PublicEyebrow tone="neutral">
              {item.eyebrow ?? `Feature ${index + 1}`}
            </PublicEyebrow>
            <h3 className="mt-3 text-lg font-semibold text-slate-950">
              {item.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {item.description ||
                "Listo para absorber componentes reciclados con copy, íconos o bullets propios."}
            </p>
          </article>
        ))}
      </div>
    </PublicSectionSurface>
  );
}

function MediaBlockAdapter({ block }: PublicBlockAdapterProps) {
  const title = asString(block.title, "Media block");
  const description = asString(
    block.description,
    "Adapter preparado para piezas con imagen, demo visual o assets importados.",
  );
  const media = asMediaItem(block, title) ?? asMediaItem(block.media, title);
  const bullets = asStringArray(block.items);

  if (!media) {
    return null;
  }

  return (
    <PublicSectionSurface>
      <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.src}
            alt={media.alt}
            className="h-72 w-full object-cover md:h-[26rem]"
          />
        </div>
        <div>
          <PublicEyebrow tone="neutral">Media adapter</PublicEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
          {media.caption ? (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              {media.caption}
            </p>
          ) : null}
          {bullets.length > 0 ? (
            <div className="mt-6 grid gap-3">
              {bullets.map((item) => (
                <PublicChecklistItem key={item}>{item}</PublicChecklistItem>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </PublicSectionSurface>
  );
}

function OfferBlockAdapter({ block, runtime }: PublicBlockAdapterProps) {
  const variant = asString(block.variant, "offer_stack");
  const title = asString(block.title, "Oferta");
  const description = asString(
    block.description,
    "Base visual para pricing, bundles u offers reciclables sin romper el renderer.",
  );
  const price = asString(block.price, asString(block.value));
  const note = asString(block.priceNote, asString(block.note));
  const items = asOfferItems(block.items);
  const ctaHref = asString(block.href) || runtime.currentStep.path;
  const ctaLabel = asString(block.label, "Quiero esta oferta");

  return (
    <PublicSectionSurface tone="warm">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <PublicEyebrow tone="warm">Offer adapter</PublicEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-700">{description}</p>
          {items.length > 0 ? (
            <div className="mt-6 grid gap-3">
              {items.map((item) => (
                <PublicChecklistItem key={item.title} accent="warm">
                  <span className="font-semibold text-slate-900">{item.title}</span>
                  {item.description ? ` · ${item.description}` : ""}
                </PublicChecklistItem>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.8rem] border border-amber-200 bg-white p-6">
          <PublicPill tone="warm">
            {variant === "offer_stack"
              ? "Offer stack"
              : "Lista para pricing y bundles"}
          </PublicPill>
          <p className="mt-5 text-4xl font-semibold tracking-tight text-slate-950">
            {price || "Personalizable"}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {note ||
              "Este adapter puede envolver componentes reciclados con precio, beneficios y CTA propio."}
          </p>
          <div className="mt-6">
            <TrackedCta
              publicationId={runtime.publication.id}
              currentStepId={runtime.currentStep.id}
              currentPath={runtime.request.path}
              href={ctaHref}
              label={ctaLabel}
              className={buildCtaClassName("primary")}
              action={asString(block.action) || "offer_cta"}
            />
          </div>
        </div>
      </div>
    </PublicSectionSurface>
  );
}

function ThankYouBlockAdapter({ block, runtime }: PublicBlockAdapterProps) {
  const title = asString(block.title, "Gracias");
  const description = asString(
    block.description,
    "Tu información ya quedó registrada y el siguiente paso del handoff está listo.",
  );

  return (
    <PublicSectionSurface tone="success">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <PublicEyebrow tone="success">
            {asString(block.eyebrow, "Confirmación")}
          </PublicEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
            {description}
          </p>
          <div className="mt-7 grid gap-3">
            {[
              "Guardamos tu lead en la publicación activa.",
              "Resolvimos el assignment y mantuvimos contexto de sesión.",
              "Dejamos visible la continuidad del handoff para no perder impulso.",
            ].map((item) => (
              <PublicChecklistItem key={item} accent="success">
                {item}
              </PublicChecklistItem>
            ))}
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-emerald-200 bg-white p-5">
          <PublicEyebrow tone="success">Qué pasa ahora</PublicEyebrow>
          <div className="mt-5 grid gap-4">
            <PublicStatCard
              label="Paso actual"
              value={toStepLabel(runtime.currentStep.stepType)}
              description="Confirmación visible y conectada al reveal."
              tone="success"
            />
            <PublicStatCard
              label="Continuidad"
              value={runtime.handoff.buttonLabel ?? "Seguimiento activo"}
              description="El CTA final ya conserva el modo de handoff resuelto."
              tone="success"
            />
            <PublicStatCard
              label="Ruta"
              value={runtime.request.path}
              description="La publicación sigue resolviendo la misma navegación."
              tone="success"
            />
          </div>
        </div>
      </div>
    </PublicSectionSurface>
  );
}

function ThankYouRevealBlockAdapter(props: PublicBlockAdapterProps) {
  const variant = asString(props.block.variant, "confirmation_reveal");
  const title = asString(
    props.block.headline,
    asString(props.block.title, "Gracias, ya estás dentro"),
  );
  const description = asString(
    props.block.subheadline,
    asString(
      props.block.description,
      "Capturamos tu lead y ahora te mostramos quién continúa contigo dentro del flujo.",
    ),
  );
  const revealTitle = asString(
    props.block.reveal_headline,
    "Sponsor asignado en esta sesión",
  );
  const revealDescription = asString(
    props.block.reveal_subheadline,
    "El runtime usa el assignment real guardado en sesión para mostrar continuidad y handoff.",
  );

  return (
    <div className={cx("grid gap-6", variant === "confirmation_reveal" ? "" : "")}>
      <ThankYouBlockAdapter
        block={{
          ...props.block,
          title,
          description,
        }}
        runtime={props.runtime}
        blocks={props.blocks}
      />
      <AssignedSponsorReveal
        runtime={props.runtime}
        title={revealTitle}
        description={revealDescription}
      />
    </div>
  );
}

function WhatsappHandoffCtaBlockAdapter({
  block,
  runtime,
}: PublicBlockAdapterProps) {
  return (
    <WhatsappHandoffCta
      runtime={runtime}
      headline={asString(block.headline, asString(block.title, "Continuar por WhatsApp"))}
      subheadline={
        asString(block.subheadline, asString(block.description)) || undefined
      }
      buttonText={
        asString(block.button_text, asString(block.buttonText)) || undefined
      }
      helperText={
        asString(block.helper_text, asString(block.helperText)) || undefined
      }
      variant={asString(block.variant) || undefined}
    />
  );
}

export function PublicBlockAdapter({
  block,
  runtime,
  blocks,
}: PublicBlockAdapterProps) {
  switch (normalizeRuntimeBlockType(block.type)) {
    case "hero":
      return <HeroBlockAdapter block={block} runtime={runtime} blocks={blocks} />;
    case "hook_and_promise":
      return (
        <HookAndPromiseBlockAdapter
          block={block}
          runtime={runtime}
          blocks={blocks}
        />
      );
    case "urgency_timer":
      return (
        <UrgencyTimerBlockAdapter block={block} runtime={runtime} blocks={blocks} />
      );
    case "text":
      return <TextBlockAdapter block={block} runtime={runtime} blocks={blocks} />;
    case "video":
      return <VideoBlockAdapter block={block} runtime={runtime} blocks={blocks} />;
    case "cta":
      return <CtaBlockAdapter block={block} runtime={runtime} blocks={blocks} />;
    case "faq":
      return <FaqBlockAdapter block={block} runtime={runtime} blocks={blocks} />;
    case "lead_capture_form":
      return (
        <PublicCaptureForm
          publicationId={runtime.publication.id}
          currentStepId={runtime.currentStep.id}
          block={normalizeLeadCaptureFormBlock(block)}
        />
      );
    case "thank_you":
      return (
        <ThankYouBlockAdapter block={block} runtime={runtime} blocks={blocks} />
      );
    case "thank_you_reveal":
      return (
        <ThankYouRevealBlockAdapter
          block={block}
          runtime={runtime}
          blocks={blocks}
        />
      );
    case "sponsor_reveal_placeholder":
      return (
        <AssignedSponsorReveal
          runtime={runtime}
          title={asString(block.title, "Sponsor asignado")}
          description={asString(block.description) || undefined}
        />
      );
    case "social_proof":
      return (
        <SocialProofBlockAdapter block={block} runtime={runtime} blocks={blocks} />
      );
    case "testimonial":
    case "testimonials":
      return (
        <TestimonialsBlockAdapter
          block={block}
          runtime={runtime}
          blocks={blocks}
        />
      );
    case "feature_grid":
      return (
        <FeatureGridBlockAdapter
          block={block}
          runtime={runtime}
          blocks={blocks}
        />
      );
    case "media":
    case "image":
      return <MediaBlockAdapter block={block} runtime={runtime} blocks={blocks} />;
    case "offer_pricing":
      return <OfferBlockAdapter block={block} runtime={runtime} blocks={blocks} />;
    case "whatsapp_handoff_cta":
      return (
        <WhatsappHandoffCtaBlockAdapter
          block={block}
          runtime={runtime}
          blocks={blocks}
        />
      );
    default:
      return null;
  }
}
