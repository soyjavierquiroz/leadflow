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

export const getApiRuntimeConfig = (
  env: NodeJS.ProcessEnv = process.env,
): ApiRuntimeConfig => {
  const port = parseNumber(env.API_PORT, 3001);
  const baseDomain = sanitizeEnv(env.APP_BASE_DOMAIN);

  const siteUrl =
    env.SITE_URL ??
    (baseDomain ? toHttpsUrl(baseDomain) : 'http://localhost:3000');
  const membersUrl =
    env.MEMBERS_URL ??
    (baseDomain
      ? toHttpsUrl(`members.${baseDomain}`)
      : 'http://localhost:3000/members');
  const adminUrl =
    env.ADMIN_URL ??
    (baseDomain
      ? toHttpsUrl(`admin.${baseDomain}`)
      : 'http://localhost:3000/admin');
  const apiUrl =
    env.API_BASE_URL ??
    (baseDomain ? toHttpsUrl(`api.${baseDomain}`) : `http://localhost:${port}`);
  const explicitOrigins = parseCsv(env.CORS_ALLOWED_ORIGINS);
  const appEnv = env.APP_ENV ?? env.NODE_ENV ?? 'development';

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
  };
};
