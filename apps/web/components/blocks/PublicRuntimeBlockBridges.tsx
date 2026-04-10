import { PublicBlockAdapter } from "@/components/public-funnel/adapters/public-block-adapters";
import { LeadCaptureModal } from "@/components/public-funnel/lead-capture-modal";
import { PublicAnnouncementBanner } from "@/components/public-funnel/public-announcement-banner";
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

type PublicRuntimeBlockBridgeProps = {
  block: RuntimeBlock;
  blocks: RuntimeBlock[];
  runtime: PublicFunnelRuntimePayload;
};

function renderRuntimeBlockBridge(
  props: PublicRuntimeBlockBridgeProps,
  layoutVariant: "single_column" | "sticky_media" = "sticky_media",
) {
  return <PublicBlockAdapter {...props} layoutVariant={layoutVariant} />;
}

export function PublicStickyRuntimeBlockBridge(
  props: PublicRuntimeBlockBridgeProps,
) {
  return renderRuntimeBlockBridge(props);
}

export function PublicAnnouncementBlockBridge({
  blocks,
}: PublicRuntimeBlockBridgeProps) {
  return <PublicAnnouncementBanner blocks={blocks} />;
}

export function PublicHookAndPromiseBlockBridge(
  props: PublicRuntimeBlockBridgeProps,
) {
  return renderRuntimeBlockBridge(props);
}

export function PublicUniqueMechanismBlockBridge(
  props: PublicRuntimeBlockBridgeProps,
) {
  return renderRuntimeBlockBridge(props);
}

export function PublicGrandSlamOfferBlockBridge(
  props: PublicRuntimeBlockBridgeProps,
) {
  return renderRuntimeBlockBridge(props);
}

export function PublicStepByStepBlockBridge(
  props: PublicRuntimeBlockBridgeProps,
) {
  return renderRuntimeBlockBridge(props);
}

export function PublicLeadCaptureConfigBridge({
  block,
  blocks,
  runtime,
}: PublicRuntimeBlockBridgeProps) {
  const modalConfigRecord = asRecord(block.modal_config);
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
  const modalConfig =
    modalConfigRecord &&
    (modalNameFieldRecord || modalPhoneFieldRecord || modalCtaButtonRecord)
      ? {
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
            block.success_redirect,
            asString(modalConfigRecord.success_redirect),
          ),
        }
      : null;
  const leadCaptureFormBlock =
    blocks.find(
      (candidate) => normalizeRuntimeBlockType(candidate.type) === "lead_capture_form",
    ) ?? null;
  const normalizedLeadCaptureFormBlock = leadCaptureFormBlock
    ? normalizeLeadCaptureFormBlock(leadCaptureFormBlock)
    : null;

  if (!modalConfig) {
    return null;
  }

  return (
    <LeadCaptureModal
      publicationId={runtime.publication.id}
      currentStepId={runtime.currentStep.id}
      triggerLabel="Abrir modal"
      triggerClassName="sr-only"
      triggerAction="open_lead_capture_modal"
      modalConfig={modalConfig}
      sourceChannel={normalizedLeadCaptureFormBlock?.settings.sourceChannel}
      tags={normalizedLeadCaptureFormBlock?.settings.tags}
      renderTrigger={false}
    />
  );
}
