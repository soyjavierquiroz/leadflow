import { AssignedSponsorReveal } from "@/components/public-funnel/assigned-sponsor-reveal";
import { ParadigmShift } from "@/components/blocks/paradigm-shift";
import { X } from "lucide-react";
import {
  buildCtaClassName,
  flatBlockTitleClassName,
  FunnelEyebrow,
  PublicChecklistItem,
  PublicQuoteCard,
  RichHeadline,
  PublicSectionSurface,
  PublicStatCard,
  cx,
  heroHookPrimaryButtonClassName,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import { ConversionPage } from "@/components/public-funnel/conversion-page";
import {
  LeadCaptureModal,
  type LeadCaptureModalConfig,
} from "@/components/public-funnel/lead-capture-modal";
import { PublicCaptureForm } from "@/components/public-funnel/public-capture-form";
import {
  RecycledFaqAccordionSection,
  RecycledFinalCtaSection,
  RecycledHeroSection,
  RecycledOfferStackSection,
  RecycledSocialProofSection,
  RecycledVideoSection,
} from "@/components/public-funnel/recycled/compatible-commercial-sections";
import { FaqSocialProof } from "@/components/public-funnel/faq-social-proof";
import { resolveLeadflowBlockMedia } from "@/components/public-funnel/leadflow-media-resolver";
import { JakawiHookAndPromiseSection } from "@/components/public-funnel/recycled/jakawi-hook-and-promise-section";
import { TrackedCta } from "@/components/public-funnel/tracked-cta";
import { UrgencyTimerBlock } from "@/components/public-funnel/urgency-timer-block";
import { StickyConversionBar } from "@/components/public-funnel/sticky-conversion-bar";
import { WhatsappHandoffCta } from "@/components/public-funnel/whatsapp-handoff-cta";
import type {
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";
import {
  asFaqItems,
  asFeatureItems,
  asMediaItem,
  asMediaItems,
  asMetricItems,
  asNumber,
  asOfferItems,
  asRecord,
  asString,
  asStringArray,
  asTestimonialItems,
  extractImageFromMap,
  normalizeLeadCaptureFormBlock,
  normalizeRuntimeBlockType,
  resolveCtaHref,
  toStepLabel,
} from "@/components/public-funnel/runtime-block-utils";
import { PublicGrandSlamOfferBlock } from "@/components/public-funnel/public-grand-slam-offer-block";
import { JakawiUniqueMechanismSection } from "@/components/public-funnel/recycled/jakawi-unique-mechanism-section";

type PublicBlockAdapterProps = {
  block: RuntimeBlock;
  runtime: PublicFunnelRuntimePayload;
  blocks: RuntimeBlock[];
  layoutVariant?: "single_column" | "sticky_media";
};

const authorityReferenceCatalog = {
  PDR: {
    label: "PDR",
    meta: "Physicians' Desk Reference",
  },
  CPS: {
    label: "CPS",
    meta: "Compendium of Pharmaceuticals",
  },
} as const;

function inferAuthorityItemsFromBlocks(blocks: RuntimeBlock[]) {
  const serialized = JSON.stringify(blocks).toUpperCase();

  return Object.entries(authorityReferenceCatalog)
    .filter(([token]) => serialized.includes(token))
    .map(([, item]) => item);
}

function resolveLeadCaptureModalConfig(
  leadCaptureConfigBlock: RuntimeBlock | null,
): LeadCaptureModalConfig | null {
  const modalConfigRecord = leadCaptureConfigBlock
    ? asRecord(leadCaptureConfigBlock.modal_config)
    : null;
  const modalFieldsRecord = modalConfigRecord
    ? asRecord(modalConfigRecord.fields)
    : null;
  const modalNameFieldRecord =
    (modalFieldsRecord ? asRecord(modalFieldsRecord.name) : null) ??
    (modalConfigRecord ? asRecord(modalConfigRecord.name_fields) : null);
  const modalPhoneFieldRecord =
    (modalFieldsRecord ? asRecord(modalFieldsRecord.phone) : null) ??
    (modalConfigRecord ? asRecord(modalConfigRecord.phone_fields) : null);
  const modalCtaButtonRecord = modalConfigRecord
    ? asRecord(modalConfigRecord.cta_button)
    : null;

  if (
    !modalConfigRecord ||
    (!modalNameFieldRecord && !modalPhoneFieldRecord && !modalCtaButtonRecord)
  ) {
    return null;
  }

  return {
    title: asString(modalConfigRecord.title, "Casi listo..."),
    description: asString(
      modalConfigRecord.description,
      "Déjanos tus datos para continuar con la siguiente etapa.",
    ),
    defaultCountry: asString(modalConfigRecord.default_country, "BO"),
    nameLabel: asString(modalNameFieldRecord?.label, "Nombre"),
    namePlaceholder: asString(
      modalNameFieldRecord?.placeholder,
      "Escribe tu nombre completo",
    ),
    nameErrorMessage: asString(
      modalNameFieldRecord?.error_msg,
      "Por favor, ingresa tu nombre.",
    ),
    phoneLabel: asString(modalPhoneFieldRecord?.label, "WhatsApp"),
    phonePlaceholder: asString(
      modalPhoneFieldRecord?.placeholder,
      "Tu número de WhatsApp",
    ),
    phoneErrorMessage: asString(
      modalPhoneFieldRecord?.error_msg,
      "Por favor, ingresa un número válido",
    ),
    ctaText: asString(
      modalCtaButtonRecord?.text,
      asString(modalConfigRecord.cta_text, "Continuar"),
    ),
    ctaSubtext: asString(
      modalCtaButtonRecord?.subtext,
      asString(modalConfigRecord.cta_subtext),
    ),
    successRedirect: asString(
      leadCaptureConfigBlock?.success_redirect,
      asString(modalConfigRecord.success_redirect),
    ),
  };
}

function HeroBlockAdapter({ block, runtime, blocks }: PublicBlockAdapterProps) {
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
    runtime.currentStep.isEntryStep
      ? "Ver detalles del funnel"
      : "Volver al inicio",
  );

  return (
    <RecycledHeroSection
      variant={variant}
      eyebrow={eyebrow}
      pills={[
        {
          label:
            variant === "opportunity"
              ? "Oportunidad"
              : toStepLabel(runtime.currentStep.stepType),
          tone: "brand",
        },
        { label: runtime.domain.host, tone: "brand" },
        {
          label:
            variant === "opportunity"
              ? "Ruta de oportunidad"
              : `Paso ${runtime.currentStep.position} de ${runtime.steps.length}`,
          tone: "brand",
        },
      ]}
      title={title}
      description={description}
      primaryCta={
        <TrackedCta
          publicationId={runtime.publication.id}
          currentStepId={runtime.currentStep.id}
          currentPath={runtime.request.path}
          href={primaryCtaHref}
          label={primaryCtaLabel}
          className={buildCtaClassName("primary")}
          action={hasCaptureBlock ? "scroll_to_capture" : "hero_primary"}
        />
      }
      secondaryCta={
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
      }
      metrics={heroMetrics}
      media={media}
      accent={accent}
      narrative={
        variant === "opportunity"
          ? "Este hero prioriza momentum comercial y transición rápida hacia la captura."
          : "La historia del funnel ahora se entiende completa: promesa, prueba, captura, confirmación y continuidad."
      }
      proofItems={heroProof}
    />
  );
}

function HookAndPromiseBlockAdapter({
  block,
  runtime,
  blocks,
  layoutVariant = "single_column",
}: PublicBlockAdapterProps) {
  const content =
    typeof block.content === "object" &&
    block.content !== null &&
    !Array.isArray(block.content)
      ? (block.content as Record<string, unknown>)
      : null;
  const eyebrow =
    asString(content?.top_bar as never) ||
    asString(block.eyebrow_text) ||
    asString(block.eyebrow, "Hook & Promise");
  const headline =
    asString(content?.headline as never) ||
    asString(block.headline) ||
    asString(
      block.hook,
      asString(block.title, "Atrae atención con una propuesta clara"),
    );
  const subheadline =
    asString(content?.subheadline as never) ||
    asString(block.subheadline) ||
    asString(
      block.promise,
      asString(
        block.description,
        "Bloque comercial diseñado para abrir el funnel con claridad, tensión positiva y continuidad hacia la captura.",
      ),
    );
  const proofHeader =
    asString(content?.proof_header as never) ||
    asString(block.proof_header) ||
    asString(block.proofHeader);
  const proofPoints = asStringArray(
    (content?.proof_points as never) ?? block.proof_points ?? block.proofPoints,
  ).filter(Boolean);
  const proofPointsHeader = proofHeader ? "" : (proofPoints[0] ?? "");
  const proofPointsBullets = proofHeader ? proofPoints : proofPoints.slice(1);
  const bullets = (
    proofPointsBullets.length > 0
      ? proofPointsBullets
      : asStringArray(
          block.primary_benefit_bullets ??
            block.highlights ??
            block.benefits ??
            block.bullets ??
            block.items,
        )
  ).filter(Boolean);
  const trustBadges = asStringArray(block.trust_badges).filter(Boolean);
  const hookLeadIn =
    asString(content?.hook_text as never) ||
    asString(block.hook_text) ||
    asString(block.hookText);
  const authorityText = asString(
    block.authority_text,
    asString(block.authorityText),
  );
  const authorityFooter = asString(
    block.authority_footer,
    asString(block.authorityFooter, authorityText),
  );
  const authorityItems = [
    ...asStringArray(
      block.trust_authority_items ??
        block.authority_items ??
        block.authority_logos ??
        block.authority_badges,
    ).map((item) => ({ label: item })),
  ].filter(
    (item, index, collection) =>
      item.label.trim() &&
      collection.findIndex((candidate) => candidate.label === item.label) ===
        index,
  );
  const inferredAuthorityItems =
    authorityItems.length > 0
      ? authorityItems
      : inferAuthorityItemsFromBlocks(blocks);
  const hasCaptureBlock = blocks.some(
    (item) => normalizeRuntimeBlockType(item.type) === "lead_capture_form",
  );
  const leadCaptureConfigBlock =
    blocks.find(
      (item) => normalizeRuntimeBlockType(item.type) === "lead_capture_config",
    ) ?? null;
  const leadCaptureFormBlock =
    blocks.find(
      (item) => normalizeRuntimeBlockType(item.type) === "lead_capture_form",
    ) ?? null;
  const normalizedLeadCaptureFormBlock = leadCaptureFormBlock
    ? normalizeLeadCaptureFormBlock(leadCaptureFormBlock)
    : null;
  const ctaHref =
    asString(block.href) ||
    (hasCaptureBlock ? "#public-capture-form" : runtime.nextStep?.path) ||
    runtime.currentStep.path;
  const ctaLabel =
    asString(block.label) ||
    asString(content?.cta_button_text as never) ||
    asString(
      block.cta_text,
      asString(
        block.primary_cta_text,
        hasCaptureBlock ? "Quiero dejar mis datos" : "Quiero ver cómo funciona",
      ),
    );
  const ctaHelperText =
    asString(content?.cta_footer as never) ||
    asString(block.cta_microcopy) ||
    asString(block.ctaMicrocopy) ||
    asString(block.cta_filter) ||
    asString(block.helper_text) ||
    asString(block.ctaFilter) ||
    asString(block.helperText) ||
    asString(block.footer_note, asString(block.footerNote));
  const ctaLeadIn =
    asString(content?.cta_lead_in as never) ||
    asString(block.cta_lead_in) ||
    asString(block.ctaLeadIn);
  const ctaAnimation =
    typeof block.cta_animation === "object" &&
    block.cta_animation !== null &&
    !Array.isArray(block.cta_animation)
      ? (block.cta_animation as Record<string, unknown>)
      : null;
  const hasPulseScaleCta =
    layoutVariant === "sticky_media" ||
    asString(ctaAnimation?.type as never) === "pulse-scale";
  const bodyCopy =
    asString(content?.body_copy as never) ||
    asString(
      block.body_copy,
      asString(
        block.bodyCopy,
        asString(block.footer_note, asString(block.footerNote)),
      ),
    );
  const urgencyBox = (content?.urgency_box as unknown) ?? block.urgency_box;
  const urgencyText =
    typeof urgencyBox === "object" &&
    urgencyBox !== null &&
    !Array.isArray(urgencyBox)
      ? asString(
          (urgencyBox as Record<string, unknown>).text as never,
          asString((urgencyBox as Record<string, unknown>).main as never),
        )
      : asString(
          block.urgency_box,
          asString(
            block.urgency_text,
            asString(block.urgencyText, asString(block.note)),
          ),
        );
  const urgencyMechanism =
    typeof urgencyBox === "object" &&
    urgencyBox !== null &&
    !Array.isArray(urgencyBox)
      ? asString((urgencyBox as Record<string, unknown>).mechanism as never)
      : "";
  const media = resolveLeadflowBlockMedia({
    runtime,
    block,
    fallbackAlt: headline,
    candidate: block.media,
    preferBlockKeys: [
      "hero_image_url",
      "heroImageUrl",
      "image_url",
      "imageUrl",
      "image_key",
      "imageKey",
      "media_key",
      "mediaKey",
      "asset_key",
      "assetKey",
    ],
    fallbackMapKeys: ["hero", "product_box"],
    leadflowMetadata:
      block.leadflow_metadata ?? block.metadata ?? runtime.funnel.settingsJson,
  });
  const modalConfig = resolveLeadCaptureModalConfig(leadCaptureConfigBlock);

  return (
    <JakawiHookAndPromiseSection
      variant={layoutVariant === "sticky_media" ? "flat" : "default"}
      eyebrow={asString(
        block.top_bar,
        asString(content?.top_bar as never, eyebrow),
      )}
      hookLeadIn={hookLeadIn || undefined}
      headline={headline}
      authorityText={authorityText || undefined}
      authorityFooter={authorityFooter || undefined}
      subheadline={subheadline}
      bodyCopy={bodyCopy || undefined}
      proofHeader={proofPointsHeader || proofHeader || undefined}
      bullets={bullets}
      trustBadges={trustBadges}
      authorityItems={inferredAuthorityItems}
      urgencyText={urgencyText || undefined}
      urgencyMechanism={urgencyMechanism || undefined}
      priceAnchorText={asString(block.price_anchor_text)}
      priceMainText={asString(block.price_main_text)}
      media={media}
      hideDesktopMedia={layoutVariant === "sticky_media"}
      cta={
        <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
          {layoutVariant === "sticky_media" && ctaLeadIn ? (
            <span className="mb-3 block text-base font-bold text-slate-700">
              {ctaLeadIn}
            </span>
          ) : null}
          {modalConfig ? (
            <LeadCaptureModal
              publicationId={runtime.publication.id}
              currentStepId={runtime.currentStep.id}
              triggerLabel={ctaLabel}
              triggerSubtext={ctaHelperText || undefined}
              triggerClassName={
                layoutVariant === "sticky_media"
                  ? cx(
                      heroHookPrimaryButtonClassName,
                      "mx-auto flex min-h-16 w-full items-center justify-center px-8 text-center text-base leading-5 sm:w-auto sm:min-w-[22rem]",
                      hasPulseScaleCta
                        ? "[animation:lf-cta-pulse-scale_2.6s_ease-in-out_infinite] transform-gpu motion-reduce:animate-none"
                        : "",
                    )
                  : buildCtaClassName("primary")
              }
              triggerAction={asString(block.action) || "hook_primary"}
              modalConfig={modalConfig}
              sourceChannel={
                normalizedLeadCaptureFormBlock?.settings.sourceChannel
              }
              tags={normalizedLeadCaptureFormBlock?.settings.tags}
            />
          ) : (
            <TrackedCta
              publicationId={runtime.publication.id}
              currentStepId={runtime.currentStep.id}
              currentPath={runtime.request.path}
              href={ctaHref}
              label={ctaLabel}
              subtext={ctaHelperText || undefined}
              className={
                layoutVariant === "sticky_media"
                  ? cx(
                      heroHookPrimaryButtonClassName,
                      "mx-auto flex min-h-16 w-full items-center justify-center px-8 text-center text-base leading-5 sm:w-auto sm:min-w-[22rem]",
                      hasPulseScaleCta
                        ? "[animation:lf-cta-pulse-scale_2.6s_ease-in-out_infinite] transform-gpu motion-reduce:animate-none"
                        : "",
                    )
                  : buildCtaClassName("primary")
              }
              action={asString(block.action) || "hook_primary"}
            />
          )}
          {layoutVariant === "sticky_media" && !ctaHelperText ? (
            <p className="mb-10 mt-2 text-center text-xs text-slate-500">
              {ctaHelperText ||
                "Te contactaremos con la siguiente etapa disponible para tu caso."}
            </p>
          ) : null}
        </div>
      }
    />
  );
}

function normalizeStepByStepItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ title?: string; description?: string }>;
  }

  const items = value.map((item) => {
    if (typeof item === "string") {
      return { description: item.trim() || undefined };
    }

    const record = asRecord(item);
    if (!record) {
      return null;
    }

    const title = asString(
      record.step_title,
      asString(record.title, asString(record.label)),
    );
    const description = asString(
      record.step_text,
      asString(
        record.description,
        asString(record.text, asString(record.content, asString(record.body))),
      ),
    );

    return title || description
      ? {
          title: title || undefined,
          description: description || undefined,
        }
      : null;
  });

  return items.filter((item): item is NonNullable<(typeof items)[number]> =>
    Boolean(item),
  );
}

function toUniqueMechanismSteps(value: RuntimeBlock["how_it_works_steps"]) {
  if (!Array.isArray(value)) {
    return [] as Array<{ title?: string; text?: string }>;
  }

  const items = value.map((item) => {
    const record = asRecord(item);
    if (!record) {
      return null;
    }

    const title = asString(record.step_title, asString(record.title));
    const text = asString(record.step_text, asString(record.text));

    return title || text
      ? { title: title || undefined, text: text || undefined }
      : null;
  });

  return items.filter((item): item is NonNullable<(typeof items)[number]> =>
    Boolean(item),
  );
}

function toUniqueMechanismPairs(value: RuntimeBlock["feature_benefit_pairs"]) {
  if (!Array.isArray(value)) {
    return [] as Array<{ feature?: string; benefit?: string }>;
  }

  const items = value.map((item) => {
    const record = asRecord(item);
    if (!record) {
      return null;
    }

    const feature = asString(record.feature);
    const benefit = asString(record.benefit);

    return feature || benefit
      ? { feature: feature || undefined, benefit: benefit || undefined }
      : null;
  });

  return items.filter((item): item is NonNullable<(typeof items)[number]> =>
    Boolean(item),
  );
}

function toEmbedUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("youtube.com/embed/")) {
    return trimmed;
  }

  const youtubeMatch = trimmed.match(/[?&]v=([^&]+)/);
  if (youtubeMatch?.[1]) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  const shortYoutubeMatch = trimmed.match(/youtu\.be\/([^?&/]+)/);
  if (shortYoutubeMatch?.[1]) {
    return `https://www.youtube.com/embed/${shortYoutubeMatch[1]}`;
  }

  const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch?.[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return trimmed;
}

function isDirectVideoUrl(rawUrl: string) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(rawUrl);
}

function UniqueMechanismBlockAdapter({
  block,
  runtime,
  layoutVariant = "single_column",
}: PublicBlockAdapterProps) {
  const headline = asString(block.headline, asString(block.title));
  const mechanismName = asString(block.mechanism_name);
  const steps = toUniqueMechanismSteps(block.how_it_works_steps);
  const pairs = toUniqueMechanismPairs(block.feature_benefit_pairs);
  const fallbackAlt = headline || mechanismName || "Mecanismo único";
  const media = resolveLeadflowBlockMedia({
    runtime,
    block,
    fallbackAlt,
    candidate: block.media_url ?? block.media,
    preferBlockKeys: [
      "media_url",
      "mediaUrl",
      "image_url",
      "imageUrl",
      "image_key",
      "imageKey",
      "media_key",
      "mediaKey",
      "asset_key",
      "assetKey",
    ],
    fallbackMapKeys: ["product_box", "hero"],
    leadflowMetadata:
      block.leadflow_metadata ?? block.metadata ?? runtime.funnel.settingsJson,
  });
  const embedUrl = toEmbedUrl(asString(block.demo_video_url));
  const mediaNode =
    embedUrl && isDirectVideoUrl(embedUrl) ? (
      <video
        src={embedUrl}
        controls
        playsInline
        className="h-full min-h-[280px] w-full object-cover"
      />
    ) : embedUrl ? (
      <iframe
        src={embedUrl}
        title={fallbackAlt}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="min-h-[280px] w-full"
      />
    ) : null;

  if (!headline && !mechanismName && steps.length === 0 && pairs.length === 0) {
    return null;
  }

  return (
    <JakawiUniqueMechanismSection
      variant={layoutVariant === "sticky_media" ? "flat" : "default"}
      headline={headline || undefined}
      mechanismName={mechanismName || undefined}
      steps={steps}
      pairs={pairs}
      media={media}
      mediaNode={mediaNode}
      hideDesktopMedia={layoutVariant === "sticky_media"}
    />
  );
}

function TextBlockAdapter({ block, runtime, blocks }: PublicBlockAdapterProps) {
  const title = asString(block.title);
  const description = asString(block.description, asString(block.body));
  const variant = asString(block.variant, asString(block.layout));

  if (variant === "social_proof") {
    return (
      <SocialProofBlockAdapter
        block={block}
        runtime={runtime}
        blocks={blocks}
      />
    );
  }

  if (variant === "feature_grid") {
    return (
      <FeatureGridBlockAdapter
        block={block}
        runtime={runtime}
        blocks={blocks}
      />
    );
  }

  const items = asFeatureItems(block.items);

  return (
    <PublicSectionSurface>
      <div className="max-w-3xl">
        <FunnelEyebrow>Valor explicado sin ruido</FunnelEyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          <RichHeadline text={title} />
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
              <FunnelEyebrow contentClassName="text-teal-700">
                {item.eyebrow ?? `Punto ${index + 1}`}
              </FunnelEyebrow>
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

function StepByStepBlockAdapter({
  block,
  layoutVariant = "single_column",
}: PublicBlockAdapterProps) {
  const title = asString(block.headline, asString(block.title, "Paso a paso"));
  const eyebrow = asString(block.eyebrow, asString(block.badge));
  const description = asString(
    block.description,
    asString(block.subheadline, asString(block.body)),
  );
  const items = normalizeStepByStepItems(
    block.steps ?? block.items ?? block.sequence ?? block.cards,
  );

  if (items.length === 0 && !title && !description) {
    return null;
  }

  return (
    <PublicSectionSurface
      variant={layoutVariant === "sticky_media" ? "flat" : "default"}
      className={layoutVariant === "sticky_media" ? "py-6 md:py-8" : ""}
    >
      <div className="space-y-6">
        <div className="max-w-3xl">
          {eyebrow ? (
            <FunnelEyebrow
              contentClassName={layoutVariant === "sticky_media" ? "text-slate-500" : ""}
            >
              {eyebrow}
            </FunnelEyebrow>
          ) : null}
          <h2
            className={cx(
              "mt-3",
              layoutVariant === "sticky_media"
                ? flatBlockTitleClassName
                : "text-3xl font-semibold tracking-tight text-slate-950",
            )}
          >
            <RichHeadline text={title} />
          </h2>
          {description ? (
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>

        {items.length > 0 ? (
          <div className="grid gap-4">
            {items.map((item, index) => (
              <article
                key={`${item.title || item.description}-${index}`}
                className={cx(
                  "rounded-[1.6rem] border px-5 py-5",
                  layoutVariant === "sticky_media"
                    ? "border-slate-200/80 bg-white shadow-[var(--jakawi-shadow-card)]"
                    : "border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.05)]",
                )}
              >
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-black text-amber-700">
                    {index + 1}
                  </span>
                  <div>
                    {item.title ? (
                      <h3 className="text-base font-bold leading-snug text-slate-950">
                        {item.title}
                      </h3>
                    ) : null}
                    {item.description ? (
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </PublicSectionSurface>
  );
}

function ParadigmShiftBlockAdapter({ block }: PublicBlockAdapterProps) {
  return (
    <ParadigmShift
      problemHeadline={asString(block.problemHeadline)}
      problemText={asString(block.problemText)}
      problemStatement={asString(block.problemStatement)}
      transitionMarker={asString(block.transitionMarker)}
      solutionText={asString(block.solutionText)}
      variant={asString(block.variant) || undefined}
    />
  );
}

function UrgencyTimerBlockAdapter({
  block,
  layoutVariant = "single_column",
}: PublicBlockAdapterProps) {
  return (
    <UrgencyTimerBlock
      eyebrow={asString(block.eyebrow) || undefined}
      headline={
        asString(
          block.prefix_text,
          asString(block.headline, asString(block.title, "Cierre próximo")),
        ) || "Cierre próximo"
      }
      subheadline={
        asString(
          block.main_text,
          asString(block.subheadline, asString(block.description)),
        ) || undefined
      }
      expiresAt={
        asString(
          block.expires_at,
          asString(block.expiresAt, asString(block.deadline)),
        ) || undefined
      }
      durationMinutes={
        asNumber(block.duration_minutes, asNumber(block.durationMinutes, 0)) ||
        undefined
      }
      variant={layoutVariant === "sticky_media" ? "flat" : "default"}
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
    <RecycledVideoSection
      sectionId={asString(block.key) || undefined}
      eyebrow="Prueba visual"
      title={title}
      caption={caption || undefined}
      embedUrl={embedUrl}
      checklist={checklist}
      helperPill="Video block compatible"
      footer={`Paso conectado: ${toStepLabel(runtime.currentStep.stepType)} sobre ${runtime.request.path}.`}
    />
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
  const eyebrow =
    asString(block.variant) === "final_cta" ? "Final CTA" : "CTA principal";

  if (asString(block.variant) === "final_cta") {
    return (
      <RecycledFinalCtaSection
        eyebrow={eyebrow}
        title={title}
        description={description}
        highlights={items}
        primaryCta={
          <TrackedCta
            publicationId={runtime.publication.id}
            currentStepId={runtime.currentStep.id}
            currentPath={runtime.request.path}
            href={href}
            label={label}
            className={buildCtaClassName("primary")}
            action={asString(block.action) || null}
          />
        }
        secondaryCta={
          runtime.previousStep ? (
            <TrackedCta
              publicationId={runtime.publication.id}
              currentStepId={runtime.currentStep.id}
              currentPath={runtime.request.path}
              href={runtime.previousStep.path}
              label="Revisar paso anterior"
              className={cx(
                buildCtaClassName("secondary"),
                "border-white/20 bg-white/8 text-white hover:bg-white/14",
              )}
              action="previous_step"
            />
          ) : undefined
        }
      />
    );
  }

  return (
    <PublicSectionSurface className="md:p-10">
      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <div>
          <FunnelEyebrow>{eyebrow}</FunnelEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            <RichHeadline text={title} />
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

function FaqBlockAdapter({
  block,
  layoutVariant = "single_column",
}: PublicBlockAdapterProps) {
  const variant = asString(block.variant, "accordion");
  const title = asString(
    block.headline,
    asString(block.title, "Preguntas frecuentes"),
  );
  const items = asFaqItems(block.items ?? block.faqs);

  if (variant === "social_proof" || variant === "objection_stack") {
    return (
      <FaqSocialProof
        eyebrow={asString(block.eyebrow, "Objeciones frecuentes")}
        title={title}
        items={items.length > 0 ? items : undefined}
        variant={layoutVariant === "sticky_media" ? "flat" : "default"}
      />
    );
  }

  return (
    <RecycledFaqAccordionSection
      eyebrow={
        variant === "accordion" ? "FAQ accordion" : "Confianza y objeciones"
      }
      title={title}
      items={items}
      variant={layoutVariant === "sticky_media" ? "flat" : "default"}
    />
  );
}

function SocialProofBlockAdapter({
  block,
  layoutVariant = "single_column",
}: PublicBlockAdapterProps) {
  const variant = asString(block.variant, "metrics_trust");
  const title = asString(
    block.headline,
    asString(block.title, "Prueba social"),
  );
  const description = asString(
    block.subheadline,
    asString(
      block.description,
      "Bloque preparado para absorber métricas, logos, resultados o señales de confianza sin tocar el renderer base.",
    ),
  );
  const metrics = asMetricItems(block.metrics ?? block.items);
  const testimonials = asTestimonialItems(
    block.testimonials ?? block.reviews ?? block.items,
  );
  const featureItems = asFeatureItems(block.items);
  const logos = asMediaItems(block.logos, title);
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
    <RecycledSocialProofSection
      variant={variant}
      surfaceVariant={layoutVariant === "sticky_media" ? "flat" : "default"}
      eyebrow="Social proof adapter"
      title={title}
      description={description}
      metrics={metrics.length > 0 ? metrics : fallbackMetrics}
      testimonials={testimonials}
      checklist={featureItems}
      logos={logos}
    />
  );
}

function RiskReversalBlockAdapter({
  block,
  runtime,
}: PublicBlockAdapterProps) {
  const title = asString(
    block.headline,
    asString(block.title, "Compra protegida"),
  );
  const description = asString(
    block.guarantee_body,
    asString(
      block.description,
      "Reduce el riesgo percibido y deja claro que la compra está respaldada.",
    ),
  );
  const bullets = asStringArray(block.guarantee_bullets ?? block.items).filter(
    Boolean,
  );
  const ctaTarget =
    resolveCtaHref(block, {
      containerKeys: ["cta_button", "cta"],
      labelKeys: ["section_cta_text", "cta_text", "primary_cta_text"],
    }) ?? null;
  const sectionCtaText = asString(
    block.section_cta_text,
    asString(ctaTarget?.label),
  );
  const subtext = asString(
    block.section_cta_subtext,
    asString(
      asRecord(block.cta_button)?.subtext,
      asString(block.cta_subtext),
    ),
  );
  const ctaHref = ctaTarget?.href || runtime.nextStep?.path || runtime.currentStep.path;
  const resolvedBullets =
    bullets.length > 0
      ? bullets
      : [
          "No necesitas ser experto para dar el siguiente paso.",
          "No necesitas tener todo resuelto antes de avanzar.",
          "No necesitas asumir un riesgo extra para probarlo.",
        ];

  return (
    <PublicSectionSurface
      className="border-2 border-dashed px-6 py-10 text-center [background:var(--theme-section-guarantee-section-bg)] [border-color:var(--theme-brand-trust)] [border-radius:var(--theme-section-guarantee-section-radius)] [box-shadow:var(--theme-section-guarantee-section-shadow)] md:px-10 md:py-12"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <h2 className="text-4xl font-black leading-tight tracking-tight [color:var(--theme-section-guarantee-section-headline-color)] md:text-5xl">
          <RichHeadline text={title} className="font-black" />
        </h2>
        <div className="mt-4 text-lg leading-8 opacity-90 [color:var(--theme-section-guarantee-section-text-color)] md:text-xl">
          <RichHeadline
            text={description}
            className="font-body"
            fontClassName="font-body"
          />
        </div>
        <div className="mt-8 inline-flex flex-col items-start text-left">
          <p className="text-lg font-bold [color:var(--theme-section-guarantee-section-headline-color)]">
            {asString(block.guarantee_duration_text, "No necesitas:")}
          </p>
          <ul className="mt-4 flex flex-col items-start gap-4">
            {resolvedBullets.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border [background:color-mix(in_srgb,var(--theme-action-urgency)_10%,white)] [border-color:color-mix(in_srgb,var(--theme-action-urgency)_26%,white)] [color:var(--theme-action-urgency)]">
                  <X className="h-4 w-4" />
                </span>
                <span className="font-body text-base leading-7 [color:var(--theme-section-guarantee-section-text-color)]">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {sectionCtaText && (
          <div className="mt-10">
            <TrackedCta
              publicationId={runtime.publication.id}
              currentStepId={runtime.currentStep.id}
              currentPath={runtime.request.path}
              href={ctaHref}
              label={sectionCtaText}
              subtext={subtext}
              className={cx(
                buildCtaClassName("primary"),
                "mx-auto flex w-full min-h-16 items-center justify-center px-8 text-center text-base leading-5 sm:w-auto sm:min-w-[22rem]",
              )}
              action={ctaTarget?.action || "risk_reversal_cta"}
            />
          </div>
        )}
      </div>
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
        <FunnelEyebrow>Testimonials adapter</FunnelEyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          <RichHeadline text={title} />
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
        <FunnelEyebrow>Feature grid adapter</FunnelEyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          <RichHeadline text={title} />
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {items.map((item, index) => (
          <article
            key={`${item.title}-${index}`}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-5"
          >
            <FunnelEyebrow>
              {item.eyebrow ?? `Feature ${index + 1}`}
            </FunnelEyebrow>
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
          <FunnelEyebrow>Media adapter</FunnelEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            <RichHeadline text={title} />
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            {description}
          </p>
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
    <RecycledOfferStackSection
      variant={variant}
      eyebrow="Offer adapter"
      title={title}
      description={description}
      items={items}
      price={price || undefined}
      note={note || undefined}
      cta={
        <TrackedCta
          publicationId={runtime.publication.id}
          currentStepId={runtime.currentStep.id}
          currentPath={runtime.request.path}
          href={ctaHref}
          label={ctaLabel}
          className={buildCtaClassName("primary")}
          action={asString(block.action) || "offer_cta"}
        />
      }
    />
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
          <FunnelEyebrow contentClassName="border-emerald-200 bg-white text-emerald-700">
            {asString(block.eyebrow, "Confirmación")}
          </FunnelEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            <RichHeadline text={title} />
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
          <FunnelEyebrow contentClassName="border-emerald-200 bg-white text-emerald-700">
            Qué pasa ahora
          </FunnelEyebrow>
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
    <div
      className={cx("grid gap-6", variant === "confirmation_reveal" ? "" : "")}
    >
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
      headline={asString(
        block.headline,
        asString(block.title, "Continuar por WhatsApp"),
      )}
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

function ConversionPageBlockAdapter({
  block,
  runtime,
}: PublicBlockAdapterProps) {
  const content = asRecord(block.content) ?? block;
  const fallbackAdvisor = asRecord(content.fallback_advisor);
  const redirectDelayValue = content.redirect_delay ?? content.redirectDelay;

  return (
    <ConversionPage
      runtime={runtime}
      headline={asString(
        content.headline,
        "¡Tu evaluación está lista! Te presentamos a tu asesor asignado.",
      )}
      subheadline={asString(content.subheadline) || undefined}
      ctaText={asString(content.cta_text) || undefined}
      whatsappMessage={asString(content.whatsapp_message) || undefined}
      redirectDelay={
        typeof redirectDelayValue === "number" ? redirectDelayValue : null
      }
      fallbackAdvisor={{
        name: asString(fallbackAdvisor?.name, "Equipo Leadflow"),
        phone: asString(fallbackAdvisor?.phone) || null,
        photoUrl: asString(fallbackAdvisor?.photo_url) || null,
        bio:
          asString(
            fallbackAdvisor?.bio,
            "Especialista en Protocolos de Recuperación",
          ) || null,
        whatsappUrl: null,
      }}
    />
  );
}

function StickyConversionBarBlockAdapter({
  block,
  runtime,
  blocks,
}: PublicBlockAdapterProps) {
  const hasCaptureBlock = blocks.some(
    (item) => normalizeRuntimeBlockType(item.type) === "lead_capture_form",
  );
  const leadCaptureConfigBlock =
    blocks.find(
      (item) => normalizeRuntimeBlockType(item.type) === "lead_capture_config",
    ) ?? null;
  const leadCaptureFormBlock =
    blocks.find(
      (item) => normalizeRuntimeBlockType(item.type) === "lead_capture_form",
    ) ?? null;
  const normalizedLeadCaptureFormBlock = leadCaptureFormBlock
    ? normalizeLeadCaptureFormBlock(leadCaptureFormBlock)
    : null;
  const modalConfig = resolveLeadCaptureModalConfig(leadCaptureConfigBlock);
  const action = asString(
    block.action,
    modalConfig
      ? "open_lead_capture_modal"
      : hasCaptureBlock
        ? "scroll_to_capture"
        : "sticky_conversion_bar",
  );
  const href =
    asString(block.href) ||
    (hasCaptureBlock ? "#public-capture-form" : runtime.nextStep?.path) ||
    runtime.currentStep.path;

  return (
    <StickyConversionBar
      publicationId={runtime.publication.id}
      currentStepId={runtime.currentStep.id}
      currentPath={runtime.request.path}
      desktopText={asString(
        block.desktopText,
        asString(
          block.desktop_text,
          "Activa tu siguiente paso antes de salir de esta página.",
        ),
      )}
      desktopButtonText={asString(
        block.desktopButtonText,
        asString(block.desktop_button_text, "Continuar ahora"),
      )}
      mobileButtonText={asString(
        block.mobileButtonText,
        asString(block.mobile_button_text, "Continuar ahora"),
      )}
      triggerOffsetPixels={asNumber(
        block.triggerOffsetPixels,
        asNumber(block.trigger_offset_pixels, 320),
      )}
      actionConfig={
        modalConfig
          ? {
              kind: "modal",
              modalConfig,
              action,
              sourceChannel:
                normalizedLeadCaptureFormBlock?.settings.sourceChannel,
              tags: normalizedLeadCaptureFormBlock?.settings.tags,
            }
          : {
              kind: "link",
              href,
              action,
            }
      }
    />
  );
}

export function PublicBlockAdapter({
  block,
  runtime,
  blocks,
  layoutVariant = "single_column",
}: PublicBlockAdapterProps) {
  try {
    switch (normalizeRuntimeBlockType(block.type)) {
      case "announcement":
      case "lead_capture_config":
        return null;
      case "hero":
        return (
          <HeroBlockAdapter
            block={block}
            runtime={runtime}
            blocks={blocks}
            layoutVariant={layoutVariant}
          />
        );
      case "hook_and_promise":
        return (
          <HookAndPromiseBlockAdapter
            block={block}
            runtime={runtime}
            blocks={blocks}
            layoutVariant={layoutVariant}
          />
        );
      case "unique_mechanism":
        return (
          <UniqueMechanismBlockAdapter
            block={block}
            runtime={runtime}
            blocks={blocks}
            layoutVariant={layoutVariant}
          />
        );
      case "urgency_timer":
        return (
          <UrgencyTimerBlockAdapter
            block={block}
            runtime={runtime}
            blocks={blocks}
            layoutVariant={layoutVariant}
          />
        );
      case "text":
        return (
          <TextBlockAdapter block={block} runtime={runtime} blocks={blocks} />
        );
      case "step_by_step":
        return (
          <StepByStepBlockAdapter
            block={block}
            runtime={runtime}
            blocks={blocks}
            layoutVariant={layoutVariant}
          />
        );
      case "paradigm_shift":
        return (
          <ParadigmShiftBlockAdapter
            block={block}
            runtime={runtime}
            blocks={blocks}
            layoutVariant={layoutVariant}
          />
        );
      case "video":
        return (
          <VideoBlockAdapter block={block} runtime={runtime} blocks={blocks} />
        );
      case "cta":
        return (
          <CtaBlockAdapter block={block} runtime={runtime} blocks={blocks} />
        );
      case "faq":
      case "faq_social_proof":
        return (
          <FaqBlockAdapter
            block={block}
            runtime={runtime}
            blocks={blocks}
            layoutVariant={layoutVariant}
          />
        );
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
          <ThankYouBlockAdapter
            block={block}
            runtime={runtime}
            blocks={blocks}
          />
        );
      case "thank_you_reveal":
        return (
          <ThankYouRevealBlockAdapter
            block={block}
            runtime={runtime}
            blocks={blocks}
          />
        );
      case "conversion_page_config":
        return (
          <ConversionPageBlockAdapter
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
          <SocialProofBlockAdapter
            block={block}
            runtime={runtime}
            blocks={blocks}
            layoutVariant={layoutVariant}
          />
        );
      case "risk_reversal":
        return (
          <RiskReversalBlockAdapter
            block={block}
            runtime={runtime}
            blocks={blocks}
            layoutVariant={layoutVariant}
          />
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
        return (
          <MediaBlockAdapter block={block} runtime={runtime} blocks={blocks} />
        );
      case "offer_pricing":
        return (
          <OfferBlockAdapter block={block} runtime={runtime} blocks={blocks} />
        );
      case "grand_slam_offer":
        return (
          <PublicGrandSlamOfferBlock
            block={block}
            runtime={runtime}
            blocks={blocks}
            hideDesktopMedia={layoutVariant === "sticky_media"}
            variant={layoutVariant === "sticky_media" ? "flat" : "default"}
          />
        );
      case "whatsapp_handoff_cta":
        return (
          <WhatsappHandoffCtaBlockAdapter
            block={block}
            runtime={runtime}
            blocks={blocks}
          />
        );
      case "sticky_conversion_bar":
        return (
          <StickyConversionBarBlockAdapter
            block={block}
            runtime={runtime}
            blocks={blocks}
          />
        );
      default:
        return null;
    }
  } catch (error) {
    console.error("[public-funnel] Failed to render block", {
      blockType: block?.type ?? "unknown",
      layoutVariant,
      error,
    });

    return null;
  }
}
