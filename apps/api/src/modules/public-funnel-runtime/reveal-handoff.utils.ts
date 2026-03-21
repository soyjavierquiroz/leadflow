import type { Prisma } from '@prisma/client';

type JsonValue = Prisma.JsonValue;

export type PublicHandoffMode =
  | 'thank_you_then_whatsapp'
  | 'immediate_whatsapp';

export type PublicHandoffConfig = {
  mode: PublicHandoffMode | null;
  channel: 'whatsapp' | null;
  buttonLabel: string | null;
  autoRedirect: boolean;
  autoRedirectDelayMs: number | null;
  messageTemplate: string | null;
};

export type PublicVisibleSponsor = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
};

const asRecord = (value: JsonValue | null | undefined) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, JsonValue>;
};

const asString = (value: JsonValue | null | undefined) =>
  typeof value === 'string' ? value.trim() : '';

const asBoolean = (value: JsonValue | null | undefined) =>
  typeof value === 'boolean' ? value : null;

const asPositiveNumber = (value: JsonValue | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;

const toSupportedMode = (value: string): PublicHandoffMode | null => {
  if (value === 'thank_you_then_whatsapp') {
    return value;
  }

  if (value === 'immediate_whatsapp') {
    return value;
  }

  return null;
};

export const resolvePublicHandoffConfig = (
  strategy: {
    type: string;
    settingsJson: JsonValue;
  } | null,
): PublicHandoffConfig => {
  if (!strategy) {
    return {
      mode: null,
      channel: null,
      buttonLabel: null,
      autoRedirect: false,
      autoRedirectDelayMs: null,
      messageTemplate: null,
    };
  }

  const settings = asRecord(strategy.settingsJson);
  const explicitMode = toSupportedMode(asString(settings?.mode));
  const mode =
    explicitMode ??
    (strategy.type === 'immediate_whatsapp'
      ? 'immediate_whatsapp'
      : 'thank_you_then_whatsapp');
  const autoRedirect =
    asBoolean(settings?.autoRedirect) ?? mode === 'immediate_whatsapp';

  return {
    mode,
    channel: mode ? 'whatsapp' : null,
    buttonLabel:
      asString(settings?.buttonLabel) ||
      (mode === 'immediate_whatsapp'
        ? 'Abrir WhatsApp ahora'
        : 'Continuar por WhatsApp'),
    autoRedirect,
    autoRedirectDelayMs: autoRedirect
      ? (asPositiveNumber(settings?.autoRedirectDelayMs) ?? 1200)
      : null,
    messageTemplate:
      asString(settings?.messageTemplate) ||
      'Hola {{sponsorName}}, soy {{leadName}}. Acabo de completar el formulario de {{funnelName}} y quiero continuar por WhatsApp.',
  };
};

export const normalizeWhatsappPhone = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D+/g, '');
  if (!digits) {
    return null;
  }

  return digits.startsWith('00') ? digits.slice(2) : digits;
};

const fillTemplate = (
  template: string,
  replacements: Record<string, string>,
) => {
  return Object.entries(replacements).reduce((result, [key, value]) => {
    return result.replaceAll(`{{${key}}}`, value);
  }, template);
};

export const buildPublicWhatsappMessage = (input: {
  template: string | null;
  sponsorName: string;
  leadName: string | null;
  leadEmail: string | null;
  leadPhone: string | null;
  funnelName: string;
  publicationPath: string;
}): string | null => {
  if (!input.template) {
    return null;
  }

  const message = fillTemplate(input.template, {
    sponsorName: input.sponsorName,
    leadName: input.leadName?.trim() || 'un nuevo lead',
    leadEmail: input.leadEmail?.trim() || 'sin email',
    leadPhone: input.leadPhone?.trim() || 'sin telefono',
    funnelName: input.funnelName,
    publicationPath: input.publicationPath,
  }).trim();

  return message || null;
};

export const buildPublicWhatsappUrl = (
  phone: string | null,
  message: string | null,
) => {
  if (!phone) {
    return null;
  }

  if (!message) {
    return `https://wa.me/${phone}`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

export const toPublicVisibleSponsor = (input: PublicVisibleSponsor) => ({
  id: input.id,
  displayName: input.displayName,
  email: input.email,
  phone: input.phone,
});
