export type ApiRuntimeConfig = {
  appName: string;
  appVersion: string;
  environment: string;
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

export const getApiRuntimeConfig = (
  env: NodeJS.ProcessEnv = process.env,
): ApiRuntimeConfig => {
  const siteUrl = env.SITE_URL ?? 'http://localhost:3000';
  const membersUrl = env.MEMBERS_URL ?? 'http://localhost:3000/members';
  const adminUrl = env.ADMIN_URL ?? 'http://localhost:3000/admin';
  const explicitOrigins = parseCsv(env.CORS_ALLOWED_ORIGINS);

  return {
    appName: env.API_NAME ?? 'leadflow-api',
    appVersion: env.API_VERSION ?? '0.2.0',
    environment: env.NODE_ENV ?? 'development',
    host: env.API_HOST ?? '0.0.0.0',
    port: parseNumber(env.API_PORT, 3001),
    globalPrefix: env.API_GLOBAL_PREFIX ?? 'v1',
    baseUrl:
      env.API_BASE_URL ?? `http://localhost:${parseNumber(env.API_PORT, 3001)}`,
    corsAllowedOrigins:
      explicitOrigins.length > 0
        ? explicitOrigins
        : [siteUrl, membersUrl, adminUrl],
  };
};
