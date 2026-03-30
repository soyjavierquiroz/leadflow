type WebPublicConfig = {
  appName: string;
  environment: string;
  baseDomain: string | null;
  urls: {
    site: string;
    members: string;
    admin: string;
    api: string;
  };
  saas: {
    customerCnameTarget: string | null;
    fallbackOrigin: string | null;
  };
};

const withFallback = (value: string | undefined, fallback: string) => {
  if (!value) {
    return fallback;
  }
  return value.trim() || fallback;
};

const sanitizeEnv = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeUrl = (value: string) => value.replace(/\/+$/, "");
const toHttpsUrl = (host: string) => `https://${host}`;

const baseDomain = sanitizeEnv(process.env.NEXT_PUBLIC_APP_BASE_DOMAIN);
const siteUrlFallback = baseDomain
  ? toHttpsUrl(baseDomain)
  : "http://localhost:3000";
const siteUrl = normalizeUrl(
  withFallback(process.env.NEXT_PUBLIC_SITE_URL, siteUrlFallback),
);
const customerCnameTarget =
  sanitizeEnv(process.env.NEXT_PUBLIC_SAAS_CUSTOMER_CNAME_TARGET) ?? null;
const fallbackOrigin =
  sanitizeEnv(process.env.NEXT_PUBLIC_SAAS_FALLBACK_ORIGIN) ?? null;

export const webPublicConfig: WebPublicConfig = {
  appName: withFallback(process.env.NEXT_PUBLIC_APP_NAME, "Leadflow"),
  environment: withFallback(
    process.env.NEXT_PUBLIC_APP_ENV,
    process.env.NODE_ENV ?? "development",
  ),
  baseDomain: baseDomain ?? null,
  urls: {
    site: siteUrl,
    members: normalizeUrl(
      withFallback(process.env.NEXT_PUBLIC_MEMBERS_URL, siteUrl),
    ),
    admin: normalizeUrl(
      withFallback(process.env.NEXT_PUBLIC_ADMIN_URL, siteUrl),
    ),
    api: normalizeUrl(
      withFallback(
        process.env.NEXT_PUBLIC_API_URL,
        baseDomain ? toHttpsUrl(`api.${baseDomain}`) : "http://localhost:3001",
      ),
    ),
  },
  saas: {
    customerCnameTarget,
    fallbackOrigin,
  },
};
