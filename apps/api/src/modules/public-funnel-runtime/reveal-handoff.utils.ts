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
  avatarUrl: string | null;
};

const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE =
  'Hola {{sponsorName}}, soy {{leadName}}. Acabo de completar el formulario de {{funnelName}} y quiero continuar por WhatsApp.';

const OWNERSHIP_REF_PLACEHOLDER_REGEX = /\{\{\s*ownership\.ref\s*\}\}/i;
const VISIBLE_REF_REGEX = /\bref\s*:/i;

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
      DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
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
  return template.replace(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g, (match, key) =>
    replacements[key] ?? match,
  );
};

const getFirstName = (value: string | null | undefined) =>
  value?.trim().split(/\s+/)[0] ?? '';

export const buildPublicWhatsappMessage = (input: {
  template: string | null;
  sponsorName: string;
  leadName: string | null;
  leadEmail: string | null;
  leadPhone: string | null;
  funnelName: string;
  publicationPath: string;
  teamName?: string | null;
  ownershipKey?: string | null;
}): string | null => {
  if (!input.template) {
    return null;
  }

  const advisorFirstName = getFirstName(input.sponsorName);
  const leadName = input.leadName?.trim() || 'un nuevo lead';
  const leadFirstName = getFirstName(leadName) || leadName;
  const ownershipRef = formatOwnershipRefForMessage(input.ownershipKey) ?? '';
  const message = fillTemplate(input.template, {
    sponsorName: input.sponsorName,
    advisorName: input.sponsorName,
    'advisor.name': input.sponsorName,
    'advisor.first_name': advisorFirstName,
    'advisor.firstName': advisorFirstName,
    leadName,
    'lead.name': leadName,
    'lead.first_name': leadFirstName,
    'lead.firstName': leadFirstName,
    leadEmail: input.leadEmail?.trim() || 'sin email',
    leadPhone: input.leadPhone?.trim() || 'sin telefono',
    funnelName: input.funnelName,
    'team.name': input.teamName?.trim() || input.funnelName,
    publicationPath: input.publicationPath,
    'ownership.key': input.ownershipKey?.trim() || '',
    'ownership.ref': ownershipRef,
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

export const formatOwnershipRefForMessage = (
  ownershipKey?: string | null,
): string | null => {
  const normalized = ownershipKey?.trim();
  if (!normalized) {
    return null;
  }

  const withoutPrefix = normalized.startsWith('lf_own_')
    ? normalized.slice('lf_own_'.length)
    : normalized;
  const shortRef = withoutPrefix.slice(0, 8).toUpperCase();

  return shortRef || null;
};

const appendShortOwnershipRefToMessage = (
  message: string | null,
  ownershipKey?: string | null,
  input?: {
    skipAppend?: boolean;
  },
) => {
  const shortRef = formatOwnershipRefForMessage(ownershipKey);
  if (!message || !shortRef) {
    return message;
  }

  if (input?.skipAppend || VISIBLE_REF_REGEX.test(message)) {
    return message;
  }

  return `${message}\n\nRef: ${shortRef}`;
};

export const resolveAssignedWhatsappMessageTemplate = (
  value: JsonValue | null | undefined,
): string | null => {
  const visit = (node: JsonValue | null | undefined): string | null => {
    if (!node) {
      return null;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found) {
          return found;
        }
      }
      return null;
    }

    const record = asRecord(node);
    if (!record) {
      return null;
    }

    if (asString(record.type) === 'hero_vsl_delayed_cta') {
      const behavior = asRecord(record.behavior);
      const content = asRecord(record.content);
      const ctaMode =
        asString(behavior?.cta_mode) || asString(record.cta_mode);
      const whatsappMessage = asString(content?.whatsapp_message);

      if (ctaMode === 'assigned_whatsapp' && whatsappMessage) {
        return whatsappMessage;
      }
    }

    for (const child of Object.values(record)) {
      const found = visit(child);
      if (found) {
        return found;
      }
    }

    return null;
  };

  return visit(value);
};

export const buildPublicWhatsappHandoff = (input: {
  handoff: Pick<PublicHandoffConfig, 'messageTemplate'>;
  customMessageTemplate?: string | null;
  sponsor: {
    displayName: string;
    phone: string | null;
  } | null;
  leadName: string | null;
  leadEmail: string | null;
  leadPhone: string | null;
  funnelName: string;
  teamName?: string | null;
  publicationPath: string;
  ownershipKey?: string | null;
}) => {
  const whatsappPhone = normalizeWhatsappPhone(input.sponsor?.phone ?? null);
  const messageTemplate =
    input.customMessageTemplate ??
    input.handoff.messageTemplate ??
    DEFAULT_WHATSAPP_MESSAGE_TEMPLATE;
  const hasOwnershipRefPlaceholder =
    OWNERSHIP_REF_PLACEHOLDER_REGEX.test(messageTemplate);
  const whatsappMessage = input.sponsor
    ? buildPublicWhatsappMessage({
        template: messageTemplate,
        sponsorName: input.sponsor.displayName,
        leadName: input.leadName,
        leadEmail: input.leadEmail,
        leadPhone: input.leadPhone,
        funnelName: input.funnelName,
        teamName: input.teamName,
        publicationPath: input.publicationPath,
        ownershipKey: input.ownershipKey,
      })
    : null;
  const whatsappMessageWithRef = appendShortOwnershipRefToMessage(
    whatsappMessage,
    input.ownershipKey,
    {
      skipAppend: hasOwnershipRefPlaceholder,
    },
  );

  return {
    whatsappPhone,
    whatsappMessage: whatsappMessageWithRef,
    whatsappUrl: buildPublicWhatsappUrl(whatsappPhone, whatsappMessageWithRef),
  };
};

export const toPublicVisibleSponsor = (input: PublicVisibleSponsor) => ({
  id: input.id,
  displayName: input.displayName,
  email: input.email,
  phone: input.phone,
  avatarUrl: input.avatarUrl,
});
