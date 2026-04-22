import type { MessagingConnectionStatus } from '@prisma/client';
import { sanitizeToKurukinFormatOrNull } from './phone-utils';
import { sanitizeNullableText } from './url.utils';

export const normalizeMessagingPhone = (
  value: string | null | undefined,
): string | null => {
  return sanitizeToKurukinFormatOrNull(value);
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
  assumeProvisioning?: boolean;
}): MessagingConnectionStatus => {
  const state = input.state?.trim().toLowerCase() ?? null;

  if (state === 'open' || state === 'connected') {
    return 'connected';
  }

  if (input.qrCodeData || input.pairingCode) {
    return 'qr_ready';
  }

  if (
    state === 'connecting' ||
    state === 'pairing' ||
    state === 'syncing' ||
    state === 'qrcode' ||
    state === 'scan'
  ) {
    return 'connecting';
  }

  if (
    state === 'startup' ||
    state === 'initializing' ||
    state === 'booting' ||
    state === 'provisioning' ||
    state === 'created'
  ) {
    return 'provisioning';
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
    return input.assumeProvisioning ? 'provisioning' : 'disconnected';
  }

  return input.assumeProvisioning ? 'provisioning' : 'connecting';
};
