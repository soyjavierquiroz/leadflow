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
    metaPixelId: string | null;
    tiktokPixelId: string | null;
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
  const withoutQuery = trimmed.split('?')[0] ?? '/';
  const withoutHash = withoutQuery.split('#')[0] ?? '/';
  const normalized = withoutHash.replace(/\/+/g, '/').replace(/\/$/, '');

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

export const resolvePublicPathBasedAttribution = (path: string) => {
  const segments = normalizePublicRuntimePath(path).split('/').filter(Boolean);
  const slug = segments[1]?.trim() || null;

  if (segments[0] === 'promo' && slug) {
    return { type: 'promo' as const, slug };
  }

  if (segments[0] === 'ref' && slug) {
    return { type: 'ref' as const, slug };
  }

  return { type: 'organic' as const, slug: null };
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

  const data = (await response.json()) as PublicRuntimeResolution & {
    blocks?: unknown[];
  };
  console.log('Fired Data:', JSON.stringify(data?.blocks?.[1] ?? null));

  return data as PublicRuntimeResolution;
}
