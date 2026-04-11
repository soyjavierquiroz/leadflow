"use client";

import { useMemo, useState } from "react";

import {
  cx,
  flatBlockTitleClassName,
  offerStackPrimaryButtonClassName,
  RichHeadline,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import {
  LeadCaptureModal,
  type LeadCaptureModalConfig,
} from "@/components/public-funnel/lead-capture-modal";
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

type OfferSectionItem = OfferLineItem & {
  kind: "included" | "bonus";
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
      name:
        asString(
          record.bonus_name,
          asString(record.item_name, asString(record.title)),
        ) || undefined,
      description:
        asString(
          record.bonus_description,
          asString(record.item_description, asString(record.description)),
        ) || undefined,
      valueText:
        asString(
          record.bonus_value_text,
          asString(record.item_value_text, asString(record.value)),
        ) || undefined,
    } satisfies OfferLineItem;

    return nextItem.name || nextItem.description || nextItem.valueText
      ? nextItem
      : null;
  });

  return items.filter(
    (item): item is NonNullable<(typeof items)[number]> => Boolean(item),
  );
};

const moneyTokenPattern =
  /([$€£¥]|[A-Za-z]{1,4}\.?)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?:\s*([$€£¥]|[A-Za-z]{1,4}\.?))?/u;

const dedupeOfferItems = (items: OfferSectionItem[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = [
      item.kind,
      item.name?.trim().toLowerCase(),
      item.description?.trim().toLowerCase(),
      item.valueText?.trim().toLowerCase(),
    ].join("::");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

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

function parseAmount(rawValue: string) {
  const compactValue = rawValue.replace(/\s+/g, "");
  const separators = compactValue.match(/[.,]/g) ?? [];
  const lastComma = compactValue.lastIndexOf(",");
  const lastDot = compactValue.lastIndexOf(".");
  let normalizedValue = compactValue;
  let decimalSeparator = "";

  if (lastComma !== -1 && lastDot !== -1) {
    decimalSeparator = lastComma > lastDot ? "," : ".";
    normalizedValue =
      decimalSeparator === ","
        ? compactValue.replace(/\./g, "").replace(",", ".")
        : compactValue.replace(/,/g, "");
  } else if (separators.length === 1) {
    const separator = separators[0] ?? "";
    const separatorIndex = compactValue.indexOf(separator);
    const decimalDigits = compactValue.length - separatorIndex - 1;

    if (decimalDigits > 0 && decimalDigits !== 3) {
      decimalSeparator = separator;
      normalizedValue =
        separator === "," ? compactValue.replace(",", ".") : compactValue;
    } else {
      normalizedValue = compactValue.replace(/[.,]/g, "");
    }
  } else if (separators.length > 1) {
    const separator = lastComma > lastDot ? "," : ".";
    const separatorIndex = Math.max(lastComma, lastDot);
    const decimalDigits = compactValue.length - separatorIndex - 1;

    if (decimalDigits > 0 && decimalDigits !== 3) {
      decimalSeparator = separator;
      normalizedValue =
        separator === ","
          ? compactValue.replace(/\./g, "").replace(",", ".")
          : compactValue.replace(/,/g, "");
    } else {
      normalizedValue = compactValue.replace(/[.,]/g, "");
    }
  }

  const amount = Number.parseFloat(normalizedValue);
  if (!Number.isFinite(amount)) {
    return null;
  }

  return {
    amount,
    decimals:
      decimalSeparator.length > 0
        ? normalizedValue.split(".")[1]?.length ?? 0
        : 0,
    decimalSeparator,
  };
}

function parseMoneyText(text?: string) {
  if (!text) {
    return null;
  }

  const match = moneyTokenPattern.exec(text);
  if (!match) {
    return null;
  }

  const parsedAmount = parseAmount(match[2] ?? "");
  if (!parsedAmount) {
    return null;
  }

  return {
    amount: parsedAmount.amount,
    decimals: parsedAmount.decimals,
    decimalSeparator: parsedAmount.decimalSeparator,
    prefix: (match[1] ?? "").trim(),
    suffix: (match[3] ?? "").trim(),
  };
}

function formatMoneyDisplay(value: {
  amount: number;
  decimals: number;
  decimalSeparator: string;
  prefix: string;
  suffix: string;
}) {
  const absoluteAmount = Math.abs(value.amount);
  const formattedNumber = new Intl.NumberFormat("es-BO", {
    minimumFractionDigits: value.decimals,
    maximumFractionDigits: value.decimals,
  }).format(absoluteAmount);
  const withPreferredSeparator =
    value.decimalSeparator === ","
      ? formattedNumber.replace(/\./g, "_").replace(/,/g, ".").replace(/_/g, ",")
      : formattedNumber;
  const signedNumber =
    value.amount < 0 ? `-${withPreferredSeparator}` : withPreferredSeparator;

  if (value.prefix) {
    const needsSpace = /[A-Za-z]$/.test(value.prefix);
    return `${value.prefix}${needsSpace ? " " : ""}${signedNumber}`;
  }

  if (value.suffix) {
    const needsSpace = /^[A-Za-z]/.test(value.suffix);
    return `${signedNumber}${needsSpace ? " " : ""}${value.suffix}`;
  }

  return signedNumber;
}

function getDisplayValueText(text?: string) {
  const parsed = parseMoneyText(text);
  return parsed ? formatMoneyDisplay(parsed) : text;
}

function deriveTotalValueText(
  items: OfferLineItem[],
  fallbackText?: string,
) {
  const parsedItems = items
    .map((item) => parseMoneyText(item.valueText))
    .filter(
      (
        parsedItem,
      ): parsedItem is NonNullable<ReturnType<typeof parseMoneyText>> =>
        Boolean(parsedItem),
    );

  if (parsedItems.length > 0) {
    const [firstItem] = parsedItems;
    const sameCurrency = parsedItems.every(
      (item) =>
        item.prefix === firstItem.prefix &&
        item.suffix === firstItem.suffix &&
        item.decimals === firstItem.decimals &&
        item.decimalSeparator === firstItem.decimalSeparator,
    );

    if (sameCurrency) {
      const totalAmount = parsedItems.reduce((sum, item) => sum + item.amount, 0);

      return formatMoneyDisplay({
        ...firstItem,
        amount: totalAmount,
      });
    }
  }

  const fallbackMoney = parseMoneyText(fallbackText);
  return fallbackMoney ? formatMoneyDisplay(fallbackMoney) : fallbackText;
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
  const editorialItems = useMemo(
    () =>
      dedupeOfferItems([
        ...includedItems.map(
          (item) =>
            ({
              ...item,
              kind: "included",
            }) satisfies OfferSectionItem,
        ),
        ...bonusItems.map(
          (item) =>
            ({
              ...item,
              kind: "bonus",
            }) satisfies OfferSectionItem,
        ),
      ]),
    [bonusItems, includedItems],
  );
  const priceStack = asRecord(block.price_stack);
  const offerName = asString(block.offer_name);
  const offerIntroText = asString(block.offer_intro, asString(block.description));
  const finalPriceText = asString(
    priceStack?.final_price_text,
    asString(block.final_price_text, asString(block.price_sale_text)),
  );
  const anchorPriceText = asString(
    priceStack?.anchor_price_text,
    asString(
      priceStack?.original_price_text,
      asString(block.price_anchor_text, asString(block.original_price_text)),
    ),
  );
  const anchorValueText = useMemo(
    () => deriveTotalValueText(editorialItems, anchorPriceText),
    [anchorPriceText, editorialItems],
  );
  const finalPriceDisplay = finalPriceText || "¡100% GRATIS!";
  const ctaLabel = asString(
    block.primary_cta_text,
    asString(block.cta_text, "QUIERO VER EL SISTEMA"),
  );
  const ctaAction = asString(block.action);
  const leadCaptureConfigBlock =
    blocks.find(
      (item) => normalizeRuntimeBlockType(item.type) === "lead_capture_config",
    ) ?? null;
  const modalConfig = useMemo(
    () => resolveLeadCaptureModalConfig(leadCaptureConfigBlock),
    [leadCaptureConfigBlock],
  );
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
              headline: ctaLabel || "Completa tu pedido y activamos la oferta",
              subheadline:
                asString(block.headline) ||
                "Usamos el flujo estándar de captura de Leadflow para reservar tu pedido.",
              buttonText: ctaLabel,
            }
          : {
              type: "lead_capture_form",
              variant: "compact_capture",
              eyebrow: offerName || "Formulario de pedido",
              headline: ctaLabel || "Completa tu pedido y activamos la oferta",
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
      <section className="w-full py-6 md:py-8">
        <div className="space-y-8 border px-6 py-8 [background:var(--theme-section-offer-stack-bg)] [border-color:var(--theme-section-offer-stack-border)] [border-radius:var(--theme-section-offer-stack-radius)] [box-shadow:var(--theme-section-offer-stack-shadow)] [color:var(--theme-section-offer-stack-text-color)] md:px-8 md:py-10">
          {asString(block.headline) ? (
            <h3
              className={cx(
                "mx-auto max-w-4xl leading-tight",
                variant === "flat"
                  ? flatBlockTitleClassName
                  : "text-3xl font-black tracking-tight md:text-4xl",
                "text-center font-headline font-black",
                "[color:var(--theme-section-offer-stack-headline-color)]",
              )}
            >
              <RichHeadline text={asString(block.headline)} className="font-black" />
            </h3>
          ) : null}

          {offerName ? (
            <p className="text-center font-headline text-sm font-semibold uppercase tracking-[0.22em] [color:var(--theme-section-offer-stack-supporting-text-color)]">
              {offerName}
            </p>
          ) : null}

          {offerIntroText ? (
            <p className="mx-auto max-w-3xl text-center font-body text-lg leading-relaxed [color:var(--theme-section-offer-stack-text-color)]">
              <RichHeadline text={offerIntroText} fontClassName="" />
            </p>
          ) : null}

          {media ? (
            <div
              className={hideDesktopMedia ? "overflow-hidden lg:hidden" : "overflow-hidden"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.src}
                alt={media.alt}
                loading="lazy"
                className="h-56 w-full rounded-[1.75rem] object-cover md:h-72"
              />
            </div>
          ) : null}

          {editorialItems.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-headline text-xs font-black uppercase tracking-[0.28em] [color:var(--theme-section-offer-stack-supporting-text-color)]">
                  Lo que incluye esta oferta
                </p>
                <p className="font-headline hidden text-xs font-black uppercase tracking-[0.24em] [color:var(--theme-text-subtle)] md:block">
                  Valor desbloqueado hoy
                </p>
              </div>

              <div className="divide-y divide-[var(--theme-base-divider)]">
                {editorialItems.map((item, index) => {
                  const itemTitle = item.name || item.description;
                  const itemDescription =
                    item.name && item.description && item.description !== item.name
                      ? item.description
                      : undefined;
                  const itemValue = getDisplayValueText(item.valueText);

                  if (!itemTitle) {
                    return null;
                  }

                  return (
                    <article
                      key={`${item.kind}-${itemTitle}-${index}`}
                      className="flex flex-col gap-5 py-5 md:flex-row md:items-start md:justify-between md:gap-8"
                    >
                      <div className="flex min-w-0 items-start gap-4">
                        <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[var(--theme-support-validation)] [background:color-mix(in_srgb,var(--theme-support-validation)_14%,white)] [border-color:color-mix(in_srgb,var(--theme-support-validation)_30%,white)]">
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 16 16"
                            className="h-4 w-4"
                            fill="none"
                          >
                            <path
                              d="M4 8.2L6.7 11l5.3-6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>

                        <div className="min-w-0">
                          <h4 className="font-headline text-lg font-black leading-tight [color:var(--theme-section-offer-stack-headline-color)]">
                            <RichHeadline text={itemTitle} className="font-black" />
                          </h4>
                          {itemDescription ? (
                            <p className="font-body mt-2 max-w-2xl text-[15px] leading-7 [color:var(--theme-text-muted)]">
                              {itemDescription}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="shrink-0 md:min-w-[10rem] md:pt-1 md:text-right">
                        {itemValue ? (
                          <p className="font-body text-sm line-through opacity-70 [color:var(--theme-text-body)]">
                            {itemValue}
                          </p>
                        ) : null}
                        <p className="font-headline text-sm font-black uppercase tracking-[0.2em] [color:var(--theme-action-urgency)]">
                          Gratis
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="border-t pt-7 [border-color:var(--theme-base-divider)]">
            <div className="mt-12 flex flex-col items-center text-center">
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--theme-text-body)] opacity-60 md:text-sm">
                  Resumen de la oferta
                </p>
                {anchorValueText ? (
                  <p className="mb-2 text-lg line-through text-[var(--theme-text-body)] opacity-70 md:text-xl">
                    {anchorValueText}
                  </p>
                ) : null}
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--theme-text-body)] opacity-60 md:text-sm">
                  Precio final
                </p>
                <RichHeadline
                  text={finalPriceDisplay}
                  className="my-4 block text-center text-5xl font-black leading-none text-[var(--theme-action-cta)] md:text-7xl"
                />
              </div>

              <div className="mt-4 w-full max-w-md">
                {ctaAction === "open_lead_capture_modal" && modalConfig ? (
                  <LeadCaptureModal
                    publicationId={runtime.publication.id}
                    currentStepId={runtime.currentStep.id}
                    triggerLabel={ctaLabel}
                    triggerClassName={cx(
                      offerStackPrimaryButtonClassName,
                      "w-full text-base [animation:lf-cta-pulse-scale_2.6s_ease-in-out_infinite] transform-gpu motion-reduce:animate-none",
                    )}
                    triggerAction={ctaAction}
                    modalConfig={modalConfig}
                    sourceChannel={normalizedOrderBlock.settings.sourceChannel}
                    tags={normalizedOrderBlock.settings.tags}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(true)}
                    className={cx(
                      offerStackPrimaryButtonClassName,
                      "w-full text-base [animation:lf-cta-pulse-scale_2.6s_ease-in-out_infinite] transform-gpu motion-reduce:animate-none",
                    )}
                  >
                    {ctaLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/55 backdrop-blur-sm">
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-[-24px_0_80px_rgba(15,23,42,0.18)]">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-headline text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Checkout Drawer
                  </p>
                  <h2 className="font-headline mt-2 text-2xl font-semibold text-slate-950">
                    {ctaLabel}
                  </h2>
                  <p className="font-body mt-2 text-sm leading-6 text-slate-600">
                    Reserva la oferta sin salir del funnel. El submit sigue
                    usando el flujo estándar de Leadflow.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="font-headline rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
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

      <style>{`
        @keyframes lf-cta-pulse-scale {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.018);
          }
        }
      `}</style>
    </>
  );
}
