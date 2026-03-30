import { timingSafeEqual } from 'crypto';

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
