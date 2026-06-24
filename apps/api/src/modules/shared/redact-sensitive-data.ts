const SECRET_KEY_FRAGMENTS = [
  'secret',
  'token',
  'access-token',
  'access_token',
  'accesstoken',
  'authorization',
  'bearer',
  'capi',
  'cookie',
  'api-key',
  'apikey',
] as const;

const PHONE_KEY_FRAGMENTS = ['phone', 'remote_jid', 'remote-jid'] as const;
const BEARER_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const ACCESS_TOKEN_VALUE_PATTERN =
  /\b((?:access[_-]?token|[^&\s="'?]*capi[^&\s="'?]*|[^&\s="'?]*token[^&\s="'?]*)=)[^&\s"']+/gi;

const normalizeKey = (value: string) => value.trim().toLowerCase();

const isSecretLikeKey = (key: string) => {
  const normalizedKey = normalizeKey(key);
  return SECRET_KEY_FRAGMENTS.some((fragment) =>
    normalizedKey.includes(fragment),
  );
};

const isPhoneLikeKey = (key: string) => {
  const normalizedKey = normalizeKey(key);
  return PHONE_KEY_FRAGMENTS.some((fragment) =>
    normalizedKey.includes(fragment),
  );
};

const maskSecret = () => '***';

const redactStringValue = (value: string) =>
  value
    .replace(BEARER_VALUE_PATTERN, 'Bearer ***')
    .replace(ACCESS_TOKEN_VALUE_PATTERN, '$1***');

const maskPhone = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '***';
  }

  const [localPart, ...rest] = trimmed.split('@');
  const suffix = rest.length > 0 ? `@${rest.join('@')}` : '';
  const visibleDigits = localPart.slice(-4);

  return `*******${visibleDigits}${suffix}`;
};

const redactWithContext = (value: unknown, parentKey?: string): unknown => {
  if (typeof parentKey === 'string' && isSecretLikeKey(parentKey)) {
    return maskSecret();
  }

  if (typeof parentKey === 'string' && isPhoneLikeKey(parentKey)) {
    return typeof value === 'string' ? maskPhone(value) : '***';
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactWithContext(entry, parentKey));
  }

  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? redactStringValue(value) : value;
  }

  const entries = Object.entries(value as Record<string, unknown>).map(
    ([key, entryValue]) => [key, redactWithContext(entryValue, key)],
  );

  return Object.fromEntries(entries);
};

export const redactSensitiveData = <T>(payload: T): T =>
  redactWithContext(payload) as T;

export const redactSecrets = redactSensitiveData;
