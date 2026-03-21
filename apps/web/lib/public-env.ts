type WebPublicConfig = {
  appName: string;
  urls: {
    site: string;
    members: string;
    admin: string;
    api: string;
  };
};

const withFallback = (value: string | undefined, fallback: string) => {
  if (!value) {
    return fallback;
  }
  return value.trim() || fallback;
};

const normalizeUrl = (value: string) => value.replace(/\/+$/, '');

export const webPublicConfig: WebPublicConfig = {
  appName: withFallback(process.env.NEXT_PUBLIC_APP_NAME, 'Leadflow'),
  urls: {
    site: normalizeUrl(
      withFallback(process.env.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000'),
    ),
    members: normalizeUrl(
      withFallback(process.env.NEXT_PUBLIC_MEMBERS_URL, 'http://localhost:3000/members'),
    ),
    admin: normalizeUrl(
      withFallback(process.env.NEXT_PUBLIC_ADMIN_URL, 'http://localhost:3000/admin'),
    ),
    api: normalizeUrl(
      withFallback(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:3001'),
    ),
  },
};

