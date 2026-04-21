import { timingSafeEqual } from 'crypto';

const OPT_OUT_KEYWORD_PATTERNS = [
  /\bSTOP\b/i,
  /\bBAJA\b/i,
  /\bNO\s+MAS\b/i,
] as const;

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const readIncomingWebhookSecret = (
  headers: Record<string, string | string[] | undefined>,
) => {
  const headerValue = headers['x-leadflow-webhook-secret'];
  const apiKeyHeader = headers['x-api-key'];
  const authorization = headers.authorization;

  const candidate =
    (Array.isArray(headerValue) ? headerValue[0] : headerValue) ??
    (Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader) ??
    null;

  if (candidate?.trim()) {
    return candidate.trim();
  }

  const authValue = Array.isArray(authorization)
    ? authorization[0]
    : authorization;

  if (!authValue?.trim()) {
    return null;
  }

  const match = authValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

export const matchesIncomingWebhookSecret = (
  expected: string,
  provided: string | null,
) => {
  if (!provided) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
};

const normalizeKeywordText = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

export const detectOptOutKeyword = (
  value: string | null | undefined,
): string | null => {
  const trimmed = readString(value);

  if (!trimmed) {
    return null;
  }

  const normalized = normalizeKeywordText(trimmed);

  for (const pattern of OPT_OUT_KEYWORD_PATTERNS) {
    const match = normalized.match(pattern);

    if (match?.[0]) {
      return match[0];
    }
  }

  return null;
};

export const extractInboundMessageText = (payload: unknown): string | null => {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const message = asRecord(root?.message) ?? asRecord(data?.message);
  const extendedText = asRecord(message?.extendedTextMessage);

  return (
    readString(root?.text) ??
    readString(root?.body) ??
    readString(data?.text) ??
    readString(data?.body) ??
    readString(message?.conversation) ??
    readString(message?.text) ??
    readString(extendedText?.text) ??
    readString(message?.caption) ??
    readString(data?.caption) ??
    null
  );
};

export const extractInboundMessagePhone = (
  payload: unknown,
): string | null => {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const key = asRecord(root?.key) ?? asRecord(data?.key);

  const phoneCandidate =
    readString(root?.phone) ??
    readString(root?.from) ??
    readString(root?.senderPhone) ??
    readString(data?.phone) ??
    readString(data?.from) ??
    readString(data?.senderPhone) ??
    readString(key?.remoteJid) ??
    readString(key?.participant);

  return phoneCandidate?.split('@')[0] ?? null;
};
