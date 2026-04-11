import type { LeadCaptureModalConfig } from "@/components/public-funnel/lead-capture-modal";
import {
  asRecord,
  asString,
} from "@/components/public-funnel/runtime-block-utils";
import type { RuntimeBlock } from "@/lib/public-funnel-runtime.types";

export function resolveLeadCaptureModalConfig(
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
