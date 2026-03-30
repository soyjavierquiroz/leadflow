"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import {
  buildCtaClassName,
  cx,
  flatBlockTitleClassName,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import {
  ValueStackSummary,
  type ValueStackItem,
} from "@/components/public-funnel/value-stack-summary";
import { resolveLeadflowBlockMedia } from "@/components/public-funnel/leadflow-media-resolver";
import { PublicCaptureForm } from "@/components/public-funnel/public-capture-form";
import {
  asRecord,
  asString,
  normalizeLeadCaptureFormBlock,
  normalizeRuntimeBlockType,
} from "@/components/public-funnel/runtime-block-utils";
import type {
  PublicFunnelRuntimePayload,
  RuntimeBlock,
} from "@/lib/public-funnel-runtime.types";

type PublicGrandSlamOfferBlockProps = {
  block: RuntimeBlock;
  runtime: PublicFunnelRuntimePayload;
  blocks: RuntimeBlock[];
  hideDesktopMedia?: boolean;
  variant?: "default" | "flat";
};

type OfferLineItem = {
  name?: string;
  description?: string;
  valueText?: string;
};

const mapIncludedItems = (value: RuntimeBlock["what_is_included"]) => {
  if (!Array.isArray(value)) {
    return [] as OfferLineItem[];
  }

  const items = value.map((item) => {
    const record = asRecord(item);
    if (!record) {
      return null;
    }

    const nextItem = {
      name: asString(record.item_name, asString(record.title)) || undefined,
      description:
        asString(record.item_description, asString(record.description)) ||
        undefined,
      valueText: asString(record.item_value_text, asString(record.value)) || undefined,
    } satisfies OfferLineItem;

    return nextItem.name || nextItem.description || nextItem.valueText
      ? nextItem
      : null;
  });

  return items.filter(
    (item): item is NonNullable<(typeof items)[number]> => Boolean(item),
  );
};

const mapBonusItems = (value: RuntimeBlock["bonus_items"]) => {
  if (!Array.isArray(value)) {
    return [] as OfferLineItem[];
  }

  const items = value.map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      const nextItem = {
        name: asString(record.bonus_name, asString(record.title)) || undefined,
        description:
          asString(record.bonus_description, asString(record.description)) ||
          undefined,
      } satisfies OfferLineItem;

      return nextItem.name || nextItem.description ? nextItem : null;
    });

  return items.filter(
    (item): item is NonNullable<(typeof items)[number]> => Boolean(item),
  );
};

const toValueStackItems = (
  includedItems: OfferLineItem[],
  bonusItems: OfferLineItem[],
) => {
  const items = [...includedItems, ...bonusItems].reduce<ValueStackItem[]>(
    (collection, item) => {
      const title = item.name || item.description;
      if (!title?.trim()) {
        return collection;
      }

      const normalizedTitle = title.trim();
      const nextItem = {
        title: normalizedTitle,
        description:
          item.name && item.description && item.description !== item.name
            ? item.description
            : undefined,
        valueText: item.valueText || undefined,
        priceText: "Precio $0",
      } satisfies ValueStackItem;

      if (
        collection.some(
          (entry) =>
            entry.title === nextItem.title &&
            entry.valueText === nextItem.valueText,
        )
      ) {
        return collection;
      }

      collection.push(nextItem);
      return collection;
    },
    [],
  );

  return items;
};

function renderHighlightedText(text?: string) {
  if (!text) {
    return null;
  }

  const parts = text.split(/(\[\[.*?\]\])/g);

  return parts.map((part, index) => {
    if (part.startsWith("[[") && part.endsWith("]]")) {
      const content = part.slice(2, -2).trim();
      if (!content) {
        return null;
      }

      return (
        <mark
          key={`${content}-${index}`}
          className="rounded-sm bg-amber-200/85 px-1 py-0.5 text-slate-950"
        >
          {content}
        </mark>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export function PublicGrandSlamOfferBlock({
  block,
  runtime,
  blocks,
  hideDesktopMedia = false,
  variant = "default",
}: PublicGrandSlamOfferBlockProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const includedItems = useMemo(
    () => mapIncludedItems(block.what_is_included),
    [block.what_is_included],
  );
  const bonusItems = useMemo(
    () => mapBonusItems(block.bonus_items),
    [block.bonus_items],
  );
  const valueStackItems = useMemo(
    () => toValueStackItems(includedItems, bonusItems),
    [bonusItems, includedItems],
  );
  const priceStack = asRecord(block.price_stack);
  const offerName = asString(block.offer_name);
  const finalPriceText = asString(
    priceStack?.final_price_text,
    asString(block.final_price_text),
  );
  const savingsText = asString(
    priceStack?.savings_text,
    asString(block.savings_text),
  );
  const anchorPriceText = asString(
    priceStack?.anchor_price_text,
    asString(
      priceStack?.original_price_text,
      asString(block.price_anchor_text, asString(block.original_price_text)),
    ),
  );
  const ctaLabel = asString(block.primary_cta_text, "Aprovechar oferta");
  const captureBlock =
    blocks.find(
      (item) => normalizeRuntimeBlockType(item.type) === "lead_capture_form",
    ) ?? null;
  const normalizedOrderBlock = useMemo(
    () =>
      normalizeLeadCaptureFormBlock(
        captureBlock
          ? {
              ...captureBlock,
              variant: "compact_capture",
              eyebrow: offerName || "Formulario de pedido",
              headline:
                asString(block.primary_cta_text) ||
                "Completa tu pedido y activamos la oferta",
              subheadline:
                asString(block.headline) ||
                "Usamos el flujo estándar de captura de Leadflow para reservar tu pedido.",
              buttonText: ctaLabel,
            }
          : {
              type: "lead_capture_form",
              variant: "compact_capture",
              eyebrow: offerName || "Formulario de pedido",
              headline:
                asString(block.primary_cta_text) ||
                "Completa tu pedido y activamos la oferta",
              subheadline:
                asString(block.headline) ||
                "Reserva la oferta con el runtime estándar de Leadflow y continúa al siguiente paso cuando corresponda.",
              buttonText: ctaLabel,
              helper_text:
                "Déjanos tus datos y usamos el flujo estándar de Leadflow para capturar el pedido.",
              privacy_note:
                "Usamos esta información solo para procesar tu pedido dentro del funnel público.",
              success_mode: "next_step",
              fields: [
                {
                  name: "full_name",
                  label: "Nombre completo",
                  field_type: "text",
                  is_required: true,
                  placeholder: "Tu nombre completo",
                  autocomplete: "name",
                  width: "full",
                },
                {
                  name: "phone",
                  label: "WhatsApp",
                  field_type: "tel",
                  is_required: true,
                  placeholder: "+52 55 0000 0000",
                  autocomplete: "tel",
                  width: "half",
                },
                {
                  name: "email",
                  label: "Email",
                  field_type: "email",
                  placeholder: "tu@email.com",
                  autocomplete: "email",
                  width: "half",
                },
                {
                  name: "company_name",
                  label: "Ciudad o referencia",
                  field_type: "text",
                  placeholder: "Ciudad, zona o referencia",
                  width: "full",
                },
              ],
              settings: {
                source_channel: "order_drawer",
                capture_url_context: true,
                tags: ["grand_slam_offer"],
              },
            },
      ),
    [block, captureBlock, ctaLabel, offerName],
  );
  const media = resolveLeadflowBlockMedia({
    runtime,
    block,
    fallbackAlt: offerName || asString(block.headline, "Oferta destacada"),
    preferBlockKeys: [
      "image_url",
      "imageUrl",
      "media_url",
      "mediaUrl",
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

  return (
    <>
      <section
        className={cx(
          "w-full text-[var(--lf-grand-text-main)]",
          variant === "flat" ? "py-6 md:py-8" : "py-6 md:py-8",
        )}
        style={
          {
            "--lf-grand-primary": "#f59e0b",
            "--lf-grand-text-main": variant === "flat" ? "#0f172a" : "#f8fafc",
            "--lf-grand-card-bg": variant === "flat" ? "#ffffff" : "#020617",
          } as CSSProperties
        }
      >
        <div className="space-y-7">
          {asString(block.headline) ? (
            <h3
              className={cx(
                "max-w-4xl leading-tight",
                variant === "flat"
                  ? flatBlockTitleClassName
                  : "text-3xl font-black tracking-tight text-slate-100 md:text-4xl",
              )}
            >
              {renderHighlightedText(asString(block.headline))}
            </h3>
          ) : null}

          {offerName ? (
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              {offerName}
            </p>
          ) : null}

          {asString(block.offer_intro) ? (
            <p className="max-w-3xl text-[15px] leading-relaxed text-slate-700">
              {asString(block.offer_intro)}
            </p>
          ) : null}

          <ValueStackSummary items={valueStackItems} />

          {media ? (
            <div className={hideDesktopMedia ? "overflow-hidden lg:hidden" : "overflow-hidden"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.src}
                alt={media.alt}
                loading="lazy"
                className="h-56 w-full object-cover"
              />
            </div>
          ) : null}

          {includedItems.length > 0 ? (
            <div className="space-y-5">
              {includedItems.map((item, index) => (
                <article
                  key={`${item.name || item.valueText}-${index}`}
                  className="space-y-2"
                >
                  <div>
                    {item.name ? (
                      <h4 className="text-base font-bold leading-snug text-slate-950">
                        {item.name}
                      </h4>
                    ) : null}
                    {item.description ? (
                      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                  {item.valueText ? (
                    <p
                      className="text-xs font-black uppercase tracking-[0.18em]"
                      style={{ color: "var(--lf-grand-primary)" }}
                    >
                      {item.valueText}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          {bonusItems.length > 0 ? (
            <div className="space-y-4">
              {bonusItems.map((item, index) => (
                <article key={`${item.name}-${index}`} className="space-y-2">
                  {item.name ? (
                    <p
                      className="text-xs font-black uppercase tracking-[0.18em]"
                      style={{ color: "var(--lf-grand-primary)" }}
                    >
                      {item.name}
                    </p>
                  ) : null}
                  {item.description ? (
                    <p className="text-[15px] leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            <p
              className="text-xs font-black uppercase tracking-[0.22em]"
              style={{ color: "var(--lf-grand-primary)" }}
            >
              Resumen de la oferta
            </p>
            {anchorPriceText ? (
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 line-through">
                {anchorPriceText}
              </p>
            ) : null}
            {finalPriceText ? (
              <p className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                {finalPriceText}
              </p>
            ) : null}
            {savingsText ? (
              <p className="text-[15px] font-semibold text-slate-700">
                {savingsText}
              </p>
            ) : null}
            {asString(block.payment_terms_text) ? (
              <p className="text-[15px] leading-relaxed text-slate-700">
                {asString(block.payment_terms_text)}
              </p>
            ) : null}
            {asString(block.offer_reason_why) ? (
              <p className="text-sm leading-6 text-slate-500">
                {asString(block.offer_reason_why)}
              </p>
            ) : null}
          </div>

          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className={cx(
                buildCtaClassName("primary"),
                "w-full bg-amber-500 text-black hover:bg-amber-400 focus-visible:outline-amber-400 sm:w-auto",
              )}
            >
              {ctaLabel}
            </button>

            <p className="text-sm leading-6 text-slate-500">
              El CTA abre el formulario de pedido dentro del runtime público
              para mantener la continuidad del funnel.
            </p>
          </div>
        </div>
      </section>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/55 backdrop-blur-sm">
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-[-24px_0_80px_rgba(15,23,42,0.18)]">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Checkout Drawer
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {ctaLabel}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Reserva la oferta sin salir del funnel. El submit sigue
                    usando el flujo estándar de Leadflow.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="p-5">
              <PublicCaptureForm
                publicationId={runtime.publication.id}
                currentStepId={runtime.currentStep.id}
                block={normalizedOrderBlock}
                sectionId="public-order-drawer-form"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
