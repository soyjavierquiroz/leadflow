import type { MessagingConnectionStatus } from '@prisma/client';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

export const normalizeMessagingPhone = (
  value: string | null | undefined,
): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[^\d]/g, '').trim();
  return normalized ? normalized : null;
};

export const sanitizeNullableText = (
  value: string | null | undefined,
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const buildEvolutionInstanceId = (input: {
  prefix: string;
  teamCode: string;
  sponsorDisplayName: string;
  sponsorId: string;
}) => {
  const prefix = slugify(input.prefix) || 'leadflow';
  const teamCode = slugify(input.teamCode) || 'team';
  const sponsor = slugify(input.sponsorDisplayName) || 'member';
  const sponsorId = slugify(input.sponsorId).slice(0, 8) || 'sponsor';

  return [prefix, teamCode, sponsor.slice(0, 24), sponsorId]
    .filter(Boolean)
    .join('-')
    .slice(0, 63);
};

export const normalizeQrCodeData = (
  value: string | null | undefined,
): string | null => {
  const trimmed = sanitizeNullableText(value);

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  return `data:image/png;base64,${trimmed}`;
};

export const buildAutomationWebhookUrl = (
  baseUrl: string | null | undefined,
  instanceId: string,
) => {
  const sanitizedBaseUrl = sanitizeNullableText(baseUrl);

  if (!sanitizedBaseUrl) {
    return null;
  }

  const normalizedBaseUrl = sanitizedBaseUrl.replace(/\/+$/, '');

  if (normalizedBaseUrl.endsWith('/leadflow')) {
    return `${normalizedBaseUrl}/${instanceId}`;
  }

  return `${normalizedBaseUrl}/leadflow/${instanceId}`;
};

export const resolveMessagingConnectionStatus = (input: {
  state?: string | null;
  qrCodeData?: string | null;
  pairingCode?: string | null;
}): MessagingConnectionStatus => {
  const state = input.state?.trim().toLowerCase() ?? null;

  if (state === 'open' || state === 'connected') {
    return 'connected';
  }

  if (state === 'connecting' || state === 'pairing' || state === 'startup') {
    return 'provisioning';
  }

  if (input.qrCodeData || input.pairingCode) {
    return 'qr_ready';
  }

  if (
    state === 'close' ||
    state === 'closed' ||
    state === 'disconnected' ||
    state === 'logout'
  ) {
    return 'disconnected';
  }

  if (!state) {
    return 'disconnected';
  }

  return 'provisioning';
};
