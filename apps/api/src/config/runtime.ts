export type ApiRuntimeConfig = {
  appName: string;
  appVersion: string;
  environment: string;
  appEnv: string;
  baseDomain: string | null;
  host: string;
  port: number;
  globalPrefix: string;
  baseUrl: string;
  corsAllowedOrigins: string[];
  authCookieName: string;
  authCookieDomain?: string;
  authCookieSecure: boolean;
  authSessionTtlDays: number;
  n8nDispatcherWebhookUrl: string | null;
  n8nDispatcherApiKey: string | null;
  n8nOutboundWebhookUrl: string | null;
  walletEngineInternalUrl: string | null;
};

const parseCsv = (value: string | undefined) => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const sanitizeEnv = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toHttpsUrl = (host: string) => `https://${host}`;

const normalizeUrl = (value: string | undefined, field: string) => {
  const sanitized = sanitizeEnv(value);

  if (!sanitized) {
    return undefined;
  }

  try {
    const url = new URL(sanitized);
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new Error(`${field} must be a valid URL.`);
  }
};

export const validateApiEnvironment = (env: NodeJS.ProcessEnv) => {
  const walletEngineInternalUrl = normalizeUrl(
    env.WALLET_ENGINE_INTERNAL_URL,
    'WALLET_ENGINE_INTERNAL_URL',
  );
  const walletEngineApiKey = sanitizeEnv(env.WALLET_ENGINE_API_KEY);
  const walletEngineConfigured = Boolean(
    walletEngineInternalUrl && walletEngineApiKey,
  );

  return {
    ...env,
    WALLET_ENGINE_INTERNAL_URL: walletEngineConfigured
      ? walletEngineInternalUrl
      : undefined,
    WALLET_ENGINE_API_KEY: walletEngineConfigured
      ? walletEngineApiKey
      : undefined,
  };
};

export const getApiRuntimeConfig = (
  env: NodeJS.ProcessEnv = process.env,
): ApiRuntimeConfig => {
  const port = parseNumber(env.API_PORT, 3001);
  const baseDomain = sanitizeEnv(env.APP_BASE_DOMAIN);
  const siteUrlFallback = baseDomain
    ? toHttpsUrl(baseDomain)
    : 'http://localhost:3000';

  const siteUrl = sanitizeEnv(env.SITE_URL) ?? siteUrlFallback;
  const membersUrl = sanitizeEnv(env.MEMBERS_URL) ?? siteUrl;
  const adminUrl = sanitizeEnv(env.ADMIN_URL) ?? siteUrl;
  const apiUrl =
    env.API_BASE_URL ??
    (baseDomain ? toHttpsUrl(`api.${baseDomain}`) : `http://localhost:${port}`);
  const explicitOrigins = parseCsv(env.CORS_ALLOWED_ORIGINS);
  const appEnv = env.APP_ENV ?? env.NODE_ENV ?? 'development';
  const authCookieName = env.AUTH_COOKIE_NAME?.trim() || 'leadflow_session';
  const authSessionTtlDays = parseNumber(env.AUTH_SESSION_TTL_DAYS, 7);
  const authCookieSecure =
    (env.NODE_ENV ?? 'development') === 'production' || Boolean(baseDomain);
  const n8nDispatcherWebhookUrl = sanitizeEnv(env.N8N_DISPATCHER_WEBHOOK_URL);
  const n8nDispatcherApiKey = sanitizeEnv(env.N8N_DISPATCHER_API_KEY);
  const n8nOutboundWebhookUrl = sanitizeEnv(env.N8N_OUTBOUND_WEBHOOK_URL);
  const walletEngineInternalUrl =
    normalizeUrl(
      env.WALLET_ENGINE_INTERNAL_URL,
      'WALLET_ENGINE_INTERNAL_URL',
    ) ?? null;

  return {
    appName: env.API_NAME ?? 'leadflow-api',
    appVersion: env.API_VERSION ?? '0.2.0',
    environment: env.NODE_ENV ?? 'development',
    appEnv,
    baseDomain: baseDomain ?? null,
    host: env.API_HOST ?? '0.0.0.0',
    port,
    globalPrefix: env.API_GLOBAL_PREFIX ?? 'v1',
    baseUrl: apiUrl,
    corsAllowedOrigins:
      explicitOrigins.length > 0
        ? explicitOrigins
        : [siteUrl, membersUrl, adminUrl],
    authCookieName,
    authCookieDomain: baseDomain ?? undefined,
    authCookieSecure,
    authSessionTtlDays,
    n8nDispatcherWebhookUrl: n8nDispatcherWebhookUrl ?? null,
    n8nDispatcherApiKey: n8nDispatcherApiKey ?? null,
    n8nOutboundWebhookUrl: n8nOutboundWebhookUrl ?? null,
    walletEngineInternalUrl,
  };
};
