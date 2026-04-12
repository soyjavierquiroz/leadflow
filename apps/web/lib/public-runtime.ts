import 'server-only';
import { webPublicConfig } from '@/lib/public-env';
import type { JsonValue } from '@/lib/public-funnel-runtime.types';

export type PublicRuntimeResolution = {
  request: {
    hostname: string;
    path: string;
  };
  publication: {
    id: string;
    path: string;
    isActive: boolean;
  };
  domain: {
    id: string;
    hostname: string;
    normalizedHostname: string;
  };
  funnelInstance: {
    id: string;
    name: string;
    code: string;
  };
  funnel: {
    id: string;
    name: string;
    description: string | null;
    config: JsonValue;
  };
};

export const normalizePublicRuntimePath = (value?: string | null) => {
  if (!value) {
    return '/';
  }

  const trimmed = value.trim();
  const normalized = trimmed.replace(/\/+/g, '/').replace(/\/$/, '');

  if (!normalized || normalized === '.') {
    return '/';
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

export const resolvePublicRuntimePath = (slug: string[] | undefined) => {
  if (!slug || slug.length === 0) {
    return '/';
  }

  return normalizePublicRuntimePath(
    slug.map((segment) => segment.trim()).filter(Boolean).join('/'),
  );
};

export async function fetchPublicRuntimeResolution(params: {
  hostname: string;
  path: string;
}): Promise<PublicRuntimeResolution | null> {
  const endpoint = new URL('/v1/public/runtime/resolve', webPublicConfig.urls.api);
  endpoint.searchParams.set('hostname', params.hostname);
  endpoint.searchParams.set('path', params.path);

  const response = await fetch(endpoint, {
    cache: 'no-store',
    next: { revalidate: 0 },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Public runtime resolution failed with ${response.status}.`);
  }

  return (await response.json()) as PublicRuntimeResolution;
}
