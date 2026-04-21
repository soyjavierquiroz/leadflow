import type { MessagingConnectionStatus } from '@prisma/client';
import { sanitizeToKurukinFormatOrNull } from '../shared/phone-utils';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

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
  return sanitizeToKurukinFormatOrNull(value);
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

export const resolveQrExpiresAt = (input: {
  payload?: unknown;
  now?: Date;
  fallbackTtlMs?: number | null;
}) => {
  const now = input.now ?? new Date();
  const payload = asRecord(input.payload);
  const qrPayload = asRecord(payload?.qrcode) ?? asRecord(payload?.qrCode);

  const ttlCandidates = [
    payload?.ttl,
    payload?.ttlMs,
    payload?.ttl_ms,
    payload?.expiresIn,
    payload?.expires_in,
    payload?.remainingTime,
    payload?.remaining_time,
    payload?.timeLeft,
    payload?.time_left,
    qrPayload?.ttl,
    qrPayload?.ttlMs,
    qrPayload?.ttl_ms,
    qrPayload?.expiresIn,
    qrPayload?.expires_in,
    qrPayload?.remainingTime,
    qrPayload?.remaining_time,
    qrPayload?.timeLeft,
    qrPayload?.time_left,
  ];

  for (const candidate of ttlCandidates) {
    const ttlValue = readFiniteNumber(candidate);

    if (ttlValue !== null && ttlValue > 0) {
      const ttlMs = ttlValue < 1000 ? ttlValue * 1000 : ttlValue;
      return new Date(now.getTime() + ttlMs);
    }
  }

  const expirationCandidates = [
    payload?.expiresAt,
    payload?.expires_at,
    payload?.expiration,
    payload?.expirationDate,
    payload?.expiration_date,
    qrPayload?.expiresAt,
    qrPayload?.expires_at,
    qrPayload?.expiration,
    qrPayload?.expirationDate,
    qrPayload?.expiration_date,
  ];

  for (const candidate of expirationCandidates) {
    if (candidate instanceof Date && !Number.isNaN(candidate.valueOf())) {
      return candidate;
    }

    const numericCandidate = readFiniteNumber(candidate);

    if (numericCandidate !== null && numericCandidate > 0) {
      const timestampMs =
        numericCandidate < 1_000_000_000_000
          ? numericCandidate * 1000
          : numericCandidate;
      const parsed = new Date(timestampMs);

      if (!Number.isNaN(parsed.valueOf())) {
        return parsed;
      }
    }

    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      const parsed = new Date(candidate);

      if (!Number.isNaN(parsed.valueOf())) {
        return parsed;
      }
    }
  }

  if (input.fallbackTtlMs && input.fallbackTtlMs > 0) {
    return new Date(now.getTime() + input.fallbackTtlMs);
  }

  return null;
};

export const isQrExpired = (
  value: string | Date | null | undefined,
  now: Date = new Date(),
) => {
  if (!value) {
    return false;
  }

  const parsed = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(parsed.valueOf())) {
    return false;
  }

  return parsed.getTime() <= now.getTime();
};

export const isDisconnectedEvolutionState = (
  state: string | null | undefined,
) => {
  const normalizedState = state?.trim().toLowerCase() ?? null;

  return Boolean(
    normalizedState &&
      (normalizedState === 'close' ||
        normalizedState === 'closed' ||
        normalizedState === 'disconnected' ||
        normalizedState === 'logout'),
  );
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
